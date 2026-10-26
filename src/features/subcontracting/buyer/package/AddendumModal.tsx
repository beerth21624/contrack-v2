'use client';

// ─── ออกฉบับแก้ไข (addendum): a new version of the lines with today's BOQ quantities; every invitee is told ───
import { useState } from 'react';
import { App, Button, Checkbox, Input, Modal } from 'antd';
import type { BuyerPackageDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useAddendum } from '../hooks';
import { qty } from '../format';
import { addendumBody } from './helpers';

export function AddendumModal({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg: BuyerPackageDto }) {
    return (
        <Modal open={open} onCancel={onClose} footer={null} width={720} destroyOnHidden title={`ออกฉบับแก้ไข (ฉบับที่ ${String(pkg.version + 1)})`}>
            {open && <AddendumBody pkg={pkg} onClose={onClose} />}
        </Modal>
    );
}

function AddendumBody({ pkg, onClose }: { pkg: BuyerPackageDto; onClose: () => void }) {
    const { message } = App.useApp();
    const addendum = useAddendum(pkg.id);
    const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
    const [note, setNote] = useState(() => (pkg.boqDrift.length > 0 ? `ปริมาณงานใน BOQ เปลี่ยน ${String(pkg.boqDrift.length)} รายการ` : ''));
    const drift = new Map(pkg.boqDrift.map(d => [d.idx, d]));
    const keptCount = pkg.lines.length - removed.size;

    const toggle = (idx: number, keep: boolean) => {
        setRemoved(prev => {
            const next = new Set(prev);
            if (keep) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const submit = async () => {
        try {
            await addendum.mutateAsync(addendumBody(pkg, removed, note));
            void message.success('ออกฉบับแก้ไขแล้ว ผู้รับคำเชิญได้รับแจ้งให้ยืนยันหรือส่งราคาใหม่');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-secondary text-gray-600 m-0">
                ระบบใช้ปริมาณล่าสุดจาก BOQ ราคาที่ส่งมาแล้วจะติดป้าย &quot;อิงฉบับเก่า&quot; ผู้รับต้องยืนยันหรือส่งใหม่
            </p>
            <div className="max-h-[360px] overflow-y-auto border border-gray-200 rounded-card">
                <table className="w-full text-body">
                    <thead className="bg-gray-50 text-secondary text-gray-600 sticky top-0">
                        <tr>
                            <th className="w-10 px-3 py-2" />
                            <th className="text-left font-medium px-3 py-2">รายการ</th>
                            <th className="text-right font-medium px-3 py-2 w-28">เดิม</th>
                            <th className="text-right font-medium px-3 py-2 w-28">ตอนนี้</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pkg.lines.map(l => {
                            const d = drift.get(l.idx);
                            return (
                                <tr key={l.idx} className={`border-t border-gray-100 ${removed.has(l.idx) ? 'text-gray-400 line-through' : ''}`}>
                                    <td className="px-3 py-2"><Checkbox checked={!removed.has(l.idx)} onChange={e => toggle(l.idx, e.target.checked)} /></td>
                                    <td className="px-3 py-2">{l.desc}</td>
                                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{qty(l.qtyNet)} {l.unit}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${d !== undefined ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                                        {d !== undefined ? `${qty(d.now)} ${l.unit}` : 'เท่าเดิม'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <label className="flex flex-col gap-1">
                <span className="text-secondary text-gray-600">แจ้งผู้รับว่าเปลี่ยนอะไร</span>
                <Input.TextArea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
                <Button onClick={onClose}>ยกเลิก</Button>
                <Button type="primary" loading={addendum.isPending} disabled={note.trim() === '' || keptCount === 0}
                    onClick={() => { void submit(); }}>
                    ออกฉบับแก้ไข ({String(keptCount)} แถว)
                </Button>
            </div>
        </div>
    );
}
