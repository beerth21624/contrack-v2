'use client';

// ─── The warranty period: start / end dates, days left (counting down) and the claims still open ───
import { Alert, Progress } from 'antd';
import { useTranslations } from 'next-intl';
import type { WarrantyDto } from '@/shared/contract';
import { DateText } from '../shared/DateText';
import { StatusTag } from '../shared/StatusTag';
import { WARRANTY_STATUS_TONES } from './status';

const MS_DAY = 24 * 60 * 60 * 1000;
const dayNumber = (d: string): number => Math.round(Date.parse(`${d}T00:00:00Z`) / MS_DAY);

export function WarrantyCountdown({ warranty }: { warranty: WarrantyDto }) {
    const t = useTranslations('handover');
    const total = Math.max(1, dayNumber(warranty.endDate) - dayNumber(warranty.startDate));
    const elapsed = Math.min(total, Math.max(0, total - warranty.daysLeft));
    const over = warranty.daysLeft < 0;

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                    <div className="text-[13px] text-gray-500">{t('warranty.daysLeft')}</div>
                    <div className={`text-3xl font-semibold tabular-nums ${over ? 'text-red-600' : warranty.daysLeft <= 30 ? 'text-orange-500' : 'text-gray-900'}`}>
                        {over ? t('warranty.overBy', { days: Math.abs(warranty.daysLeft) }) : t('warranty.days', { days: warranty.daysLeft })}
                    </div>
                </div>
                <div className="text-[13px]">
                    <div className="text-gray-500">{t('warranty.period')}</div>
                    <div><DateText value={warranty.startDate} /> – <DateText value={warranty.endDate} /></div>
                </div>
                <div className="text-[13px]">
                    <div className="text-gray-500">{t('warranty.status')}</div>
                    <StatusTag enumName="warrantyStatus" value={warranty.status} tones={WARRANTY_STATUS_TONES} />
                </div>
                <div className="text-[13px]">
                    <div className="text-gray-500">{t('warranty.openClaims')}</div>
                    <div className="font-semibold tabular-nums">{warranty.openClaimCount}</div>
                </div>
            </div>
            <Progress percent={Math.round((elapsed / total) * 100)} showInfo={false} status={over ? 'exception' : 'active'} />
            {warranty.status === 'active' && !over && warranty.daysLeft <= 30 && <Alert type="warning" showIcon title={t('warranty.endingSoon', { days: warranty.daysLeft })} />}
            {warranty.status === 'expired' && <Alert type="info" showIcon title={t('warranty.expiredNote')} />}
        </div>
    );
}
