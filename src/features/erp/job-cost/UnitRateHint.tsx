'use client';

// ─── "ราคาจริงล่าสุด" on a BOQ row (WP-55): the mean actual unit rates of the latest closed projects, one click to use them ───
import { Button, Popover, Tag } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { UnitRateDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';

export function UnitRateHint({ rate, unit, locked, onUse }: {
    rate: UnitRateDto;
    /** The BOQ row's unit (the rate's unit is shown when it differs). */
    unit: string;
    /** BOQ locked by a baseline / read-only: the hint shows, the button does not apply. */
    locked: boolean;
    onUse: (matUnit: number, labUnit: number) => void;
}) {
    const t = useTranslations('jobCost.unitRateHint');
    const fmt = useFormat();
    const shownUnit = rate.unit !== '' ? rate.unit : unit;
    const content = (
        <div className="flex max-w-72 flex-col gap-2 text-[13px]">
            <div className="text-gray-600">
                {t('tip', {
                    count: rate.projectCount, date: fmt.date(rate.lastObservedDate), mat: fmt.money(rate.matUnit), lab: fmt.money(rate.labUnit),
                    unit: shownUnit,
                })}
            </div>
            {locked && <div className="text-[12px] text-amber-700">{t('locked')}</div>}
            <div>
                <Button size="small" type="primary" disabled={locked} onClick={() => onUse(rate.matUnit, rate.labUnit)}>{t('use')}</Button>
            </div>
        </div>
    );
    return (
        <Popover content={content} title={t('label')} trigger="click">
            <Tag color="geekblue" icon={<HistoryOutlined />} className="!m-0 cursor-pointer whitespace-nowrap !text-[11px]">
                {t('label')} {fmt.money(rate.matUnit + rate.labUnit)}
            </Tag>
        </Popover>
    );
}
