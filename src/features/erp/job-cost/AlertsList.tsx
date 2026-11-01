'use client';

// ─── Open job-cost alerts of the project (cost over budget, commitments over budget, margin drop, negative cash) ───
import { Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { JobCostAlertDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';

export function AlertsList({ alerts, onOpenCode }: { alerts: readonly JobCostAlertDto[]; onOpenCode?: (costCodeId: string) => void }) {
    const t = useTranslations('jobCost.alerts');
    const te = useTranslations('enums.alertKind');
    const fmt = useFormat();
    return (
        <SectionCard title={t('title')} extra={alerts.length > 0 ? <Tag color="error" className="!m-0">{alerts.length}</Tag> : undefined}>
            {alerts.length === 0 ? <div className="text-gray-500 text-[13px]">{t('none')}</div> : (
                <ul className="list-none m-0 p-0 flex flex-col gap-3">
                    {alerts.map(a => (
                        <li key={a.id} className="flex flex-wrap items-start gap-2">
                            <StatusTag enumName="alertLevel" value={a.level} tones={{ warning: 'warning', critical: 'error' }} />
                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] text-gray-900">
                                    <span className="font-medium">{te(a.kind)}</span>
                                    {a.code !== null && (
                                        <>
                                            {' · '}
                                            {a.costCodeId !== null && onOpenCode !== undefined
                                                ? <button type="button" className="text-blue-600 hover:underline bg-transparent border-0 p-0 cursor-pointer" onClick={() => onOpenCode(a.costCodeId ?? '')}>{a.code}</button>
                                                : a.code}
                                            {a.descTh !== null ? ` ${a.descTh}` : ''}
                                        </>
                                    )}
                                </div>
                                <div className="text-[12px] text-gray-500">
                                    {a.kind === 'margin_drop'
                                        ? t('marginDetail', { value: fmt.percent(a.value, 1), threshold: fmt.percent(a.threshold, 1) })
                                        : a.kind === 'negative_cash'
                                            ? t('cashDetail', { value: fmt.money(a.value) })
                                            : <>{t('valueOf')} <MoneyText value={a.value} /> {t('against')} <MoneyText value={a.threshold} /></>}
                                    {' · '}{t('since')} <DateText value={a.firstSeenAt} />
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
