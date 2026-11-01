'use client';

// ─── Projected profit of the project: signed contract value less the forecast cost at completion ───
import { Alert } from 'antd';
import { useTranslations } from 'next-intl';
import { JOB_COST_MARGIN_DROP_TOLERANCE, type JobCostProfitDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="text-[12px] text-gray-500">{label}</div>
            <div className="text-[18px] font-semibold text-gray-900 break-words">{children}</div>
        </div>
    );
}

export function ProfitCard({ profit }: { profit: JobCostProfitDto }) {
    const t = useTranslations('jobCost.profit');
    const fmt = useFormat();
    const margin = profit.marginPct;
    const quoted = profit.quotedMarginPct;
    const dropped = margin !== null && quoted !== null && margin < quoted - JOB_COST_MARGIN_DROP_TOLERANCE;
    const loss = profit.profit !== null && profit.profit < 0;
    return (
        <SectionCard title={t('title')}>
            {profit.revenue === null && <Alert type="info" showIcon title={t('noContract')} className="!mb-3" />}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label={t('revenue')}><MoneyText value={profit.revenue} /></Stat>
                <Stat label={t('cost')}><MoneyText value={profit.cost} /></Stat>
                <Stat label={t('profit')}><MoneyText value={profit.profit} className={loss ? 'text-red-600' : ''} /></Stat>
                <Stat label={t('margin')}>
                    <span className={dropped || loss ? 'text-red-600' : ''}>{margin === null ? '–' : fmt.percent(margin, 1)}</span>
                </Stat>
                {quoted !== null && <Stat label={t('quotedMargin')}>{fmt.percent(quoted, 1)}</Stat>}
                {profit.billed !== null && <Stat label={t('billed')}><MoneyText value={profit.billed} /></Stat>}
                {profit.received !== null && <Stat label={t('received')}><MoneyText value={profit.received} /></Stat>}
            </div>
        </SectionCard>
    );
}
