'use client';

// ─── ออกฉบับแก้ไข (addendum): a new version of the lines with today's BOQ quantities; every invitee is told ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useState } from 'react';
import { App, Button, Checkbox, Input, Modal } from 'antd';
import type { BuyerPackageDto } from '@/shared/contract';

import { useAddendum } from '../hooks';
import { qty } from '../format';
import { addendumBody } from './helpers';

export function AddendumModal({ open, onClose, pkg }: { open: boolean; onClose: () => void; pkg: BuyerPackageDto }) {
    const t = useTranslations('subcontracting');
    return (
        <Modal open={open} onCancel={onClose} footer={null} width={720} destroyOnHidden title={t('buyer.addendum.issueAnAddendumVersion', { value: pkg.version + 1 })}>
            {open && <AddendumBody pkg={pkg} onClose={onClose} />}
        </Modal>
    );
}

function AddendumBody({ pkg, onClose }: { pkg: BuyerPackageDto; onClose: () => void }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const addendum = useAddendum(pkg.id);
    const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
    const [note, setNote] = useState(() => (pkg.boqDrift.length > 0 ? t('buyer.addendum.boqQuantitiesChangedOn', { count: pkg.boqDrift.length }) : ''));
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
            void message.success(t('buyer.addendum.addendumIssuedInviteesWereAsked'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-secondary text-gray-600 m-0">
                {t('buyer.addendum.theSystemUsesTheLatest')}
            </p>
            <div className="max-h-[360px] overflow-y-auto border border-gray-200 rounded-card">
                <table className="w-full text-body">
                    <thead className="bg-gray-50 text-secondary text-gray-600 sticky top-0">
                        <tr>
                            <th className="w-10 px-3 py-2" />
                            <th className="text-left font-medium px-3 py-2">{t('buyer.addendum.item')}</th>
                            <th className="text-right font-medium px-3 py-2 w-28">{t('buyer.addendum.before')}</th>
                            <th className="text-right font-medium px-3 py-2 w-28">{t('buyer.addendum.now')}</th>
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
                                        {d !== undefined ? `${qty(d.now)} ${l.unit}` : t('buyer.addendum.unchanged')}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <label className="flex flex-col gap-1">
                <span className="text-secondary text-gray-600">{t('buyer.addendum.tellRecipientsWhatChanged')}</span>
                <Input.TextArea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
                <Button onClick={onClose}>{t('buyer.addendum.cancel')}</Button>
                <Button type="primary" loading={addendum.isPending} disabled={note.trim() === '' || keptCount === 0}
                    onClick={() => { void submit(); }}>
                    {t('buyer.addendum.issueAddendum')}{String(keptCount)} {t('buyer.addendum.rows')}
                </Button>
            </div>
        </div>
    );
}
