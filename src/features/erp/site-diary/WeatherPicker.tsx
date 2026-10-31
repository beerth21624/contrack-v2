'use client';

import { InputNumber, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { SITE_WEATHERS, type SiteWeather } from '@/shared/contract';

export function WeatherPicker({ morning, afternoon, rainHours, disabled, onChange }: {
    morning: SiteWeather | null;
    afternoon: SiteWeather | null;
    rainHours: number;
    disabled: boolean;
    onChange: (patch: { weatherMorning?: SiteWeather | null; weatherAfternoon?: SiteWeather | null; rainHours?: number }) => void;
}) {
    const t = useTranslations('siteDiary.weather');
    const te = useTranslations('enums.siteWeather');
    const options = SITE_WEATHERS.map(w => ({ value: w, label: te(w) }));
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                {t('morning')}
                <Select<SiteWeather> allowClear value={morning ?? undefined} disabled={disabled} placeholder={t('placeholder')} options={options}
                    onChange={(v: SiteWeather | undefined) => onChange({ weatherMorning: v ?? null })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                {t('afternoon')}
                <Select<SiteWeather> allowClear value={afternoon ?? undefined} disabled={disabled} placeholder={t('placeholder')} options={options}
                    onChange={(v: SiteWeather | undefined) => onChange({ weatherAfternoon: v ?? null })} />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                {t('rainHours')}
                <InputNumber className="!w-full" min={0} max={24} step={0.5} value={rainHours} disabled={disabled} inputMode="decimal"
                    onChange={v => onChange({ rainHours: v ?? 0 })} />
            </label>
        </div>
    );
}
