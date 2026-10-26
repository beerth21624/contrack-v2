'use client';

// ─── Summary before the award (plan §4.6): winners, value, lines, payment stages, note → POST award ───
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Modal, Radio } from 'antd';
import type { AwardResponse, BuyerPackageDto, LevelingDto } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { money, pct } from '../format';
import { scKeys } from '../api';
import { useAward } from '../hooks';
import { awardErrorInfo, buildAwardRequest, installmentsText, type Winner } from './model';

export function AwardModal({ open, onClose, pkg, leveling, allocation, winners, onAwarded }: {
    open: boolean;
    onClose: () => void;
    pkg: BuyerPackageDto;
    leveling: LevelingDto;
    allocation: ReadonlyMap<number, string>;
    winners: readonly Winner[];
    onAwarded: (res: AwardResponse) => void;
}) {
    return (
        <Modal open={open} onCancel={onClose} title="สรุปก่อนตกลงจ้าง" width={640} destroyOnHidden footer={null}>
            <Summary pkg={pkg} leveling={leveling} allocation={allocation} winners={winners} onClose={onClose} onAwarded={onAwarded} />
        </Modal>
    );
}

function Summary({ pkg, leveling, allocation, winners, onClose, onAwarded }: {
    pkg: BuyerPackageDto;
    leveling: LevelingDto;
    allocation: ReadonlyMap<number, string>;
    winners: readonly Winner[];
    onClose: () => void;
    onAwarded: (res: AwardResponse) => void;
}) {
    const { message } = App.useApp();
    const qc = useQueryClient();
    const award = useAward(pkg.id);
    const [from, setFrom] = useState<Record<string, 'package' | 'bid'>>({});
    const [note, setNote] = useState('');
    const total = winners.reduce((s, w) => s + w.value, 0);
    const leftOut = leveling.lines.length - allocation.size;
    const packageStages = installmentsText(pkg.installments);

    const submit = async () => {
        try {
            const res = await award.mutateAsync(buildAwardRequest(leveling, allocation, from, note));
            onAwarded(res);
        } catch (e) {
            const info = awardErrorInfo(e);
            void message.error(info?.text ?? thaiErrorMessage(e));
            if (info?.refetch === true) {
                // The package or a bid changed under us: reload the table (package, invitations, bids, leveling) and start over.
                void qc.invalidateQueries({ queryKey: scKeys.package(pkg.id) });
                onClose();
            }
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-card">
                {winners.map(w => {
                    const proposal = w.bidder.installmentsProposal;
                    return (
                        <div key={w.bidId} className="p-3 flex flex-col gap-2">
                            <div className="flex items-baseline gap-2">
                                <span className="font-medium text-gray-900 flex-1 min-w-0 truncate">{w.bidder.displayName}</span>
                                <span className="tabular-nums font-medium">{money(w.value)} บาท</span>
                            </div>
                            <div className="text-secondary text-gray-600">
                                {w.idxs.length === leveling.lines.length ? 'ทุกแถว' : `${String(w.idxs.length)} แถว`}
                                {w.bidder.mode === 'lump' ? ' · ราคาเหมารวม' : ''}
                                {w.bidder.days !== null ? ` · ${String(w.bidder.days)} วัน` : ''}
                                {` · เงินประกันผลงาน ${pct(pkg.terms.retentionPct)}`}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-secondary">
                                <span className="text-gray-600">งวดจ่าย</span>
                                {proposal === null
                                    ? <span>{packageStages} (ตามที่เรากำหนด)</span>
                                    : (
                                        <Radio.Group size="small" value={from[w.bidId] ?? 'package'}
                                            onChange={e => setFrom(prev => ({ ...prev, [w.bidId]: e.target.value as 'package' | 'bid' }))}
                                            options={[
                                                { value: 'package', label: `ของเรา ${packageStages}` },
                                                { value: 'bid', label: `ที่ผู้รับเสนอ ${installmentsText(proposal)}` },
                                            ]} />
                                    )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-baseline justify-between">
                <span className="text-gray-600">มูลค่ารวม</span>
                <span className="text-card-title font-semibold tabular-nums">{money(total)} บาท</span>
            </div>
            {leftOut > 0 && (
                <div className="text-secondary text-gray-600">
                    อีก {leftOut} แถวไม่ได้จ้างใคร จะกลับเป็น &quot;ยังไม่จัดหา&quot; ทำแพ็กเกจใหม่ได้ภายหลัง
                </div>
            )}
            <Input.TextArea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder="หมายเหตุ (ไม่บังคับ)" />
            <div className="text-secondary text-gray-500">
                ระบบจะสร้างสัญญาให้ผู้รับกดยอมรับ รายอื่นจะได้รับแจ้งว่าแพ็กเกจปิดแล้ว โดยไม่เห็นผู้ชนะหรือราคา
            </div>
            <div className="flex justify-end gap-2">
                <Button onClick={onClose}>ยกเลิก</Button>
                <Button type="primary" loading={award.isPending} onClick={() => { void submit(); }}>ตกลงจ้าง</Button>
            </div>
        </div>
    );
}
