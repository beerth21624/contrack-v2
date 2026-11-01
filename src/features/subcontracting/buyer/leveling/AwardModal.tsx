'use client';

// ─── Summary before the award (plan §4.6): winners, value, lines, payment stages, note → POST award ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Button, Input, Modal, Radio } from 'antd';
import type { AwardResponse, BuyerPackageDto, LevelingDto } from '@/shared/contract';

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
    const t = useTranslations('subcontracting');
    return (
        <Modal open={open} onCancel={onClose} title={t('buyer.award.summaryBeforeAwarding')} width={640} destroyOnHidden footer={null}>
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
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
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
            void message.error(info?.text ?? toText(e));
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
                                <span className="tabular-nums font-medium">{money(w.value)} {t('buyer.award.thb')}</span>
                            </div>
                            <div className="text-secondary text-gray-600">
                                {w.idxs.length === leveling.lines.length ? t('buyer.award.allRows') : t('buyer.award.rows', { count: w.idxs.length })}
                                {w.bidder.mode === 'lump' ? t('buyer.award.lumpSum') : ''}
                                {w.bidder.days !== null ? t('buyer.award.days', { days: w.bidder.days }) : ''}
                                {t('buyer.award.retention', { retentionPct: pct(pkg.terms.retentionPct) })}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-secondary">
                                <span className="text-gray-600">{t('buyer.award.paymentStages')}</span>
                                {proposal === null
                                    ? <span>{packageStages} {t('buyer.award.asWeSet')}</span>
                                    : (
                                        <Radio.Group size="small" value={from[w.bidId] ?? 'package'}
                                            onChange={e => setFrom(prev => ({ ...prev, [w.bidId]: e.target.value as 'package' | 'bid' }))}
                                            options={[
                                                { value: 'package', label: t('buyer.award.ours', { packageStages }) },
                                                { value: 'bid', label: t('buyer.award.proposedByTheRecipient', { proposal: installmentsText(proposal) }) },
                                            ]} />
                                    )}
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-baseline justify-between">
                <span className="text-gray-600">{t('buyer.award.totalValue')}</span>
                <span className="text-card-title font-semibold tabular-nums">{money(total)} {t('buyer.award.thb')}</span>
            </div>
            {leftOut > 0 && (
                <div className="text-secondary text-gray-600">
                    {t('buyer.award.theOther')} {leftOut} {t('buyer.award.rowsGoToNobodyAnd')}
                </div>
            )}
            <Input.TextArea value={note} onChange={e => setNote(e.target.value)} maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }}
                placeholder={t('buyer.award.noteOptional')} />
            <div className="text-secondary text-gray-500">
                {t('buyer.award.theSystemWillCreateA')}
            </div>
            <div className="flex justify-end gap-2">
                <Button onClick={onClose}>{t('buyer.award.cancel')}</Button>
                <Button type="primary" loading={award.isPending} onClick={() => { void submit(); }}>{t('buyer.award.award')}</Button>
            </div>
        </div>
    );
}
