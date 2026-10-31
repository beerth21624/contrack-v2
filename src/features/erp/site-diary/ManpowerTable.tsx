'use client';

// ─── Who worked today: a card per crew / subcontractor (stacks on a phone) ───
import { Button, Input, InputNumber, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { CrewDto } from '@/shared/contract';
import { CostCodePicker } from '../shared/CostCodePicker';
import { type ManpowerRow, nextKey } from './form';

const field = 'flex min-w-0 flex-col gap-1 text-[13px] text-gray-600';

export function ManpowerTable({ projectId, rows, crews, disabled, onChange }: {
    projectId: string;
    rows: readonly ManpowerRow[];
    crews: readonly CrewDto[];
    disabled: boolean;
    onChange: (rows: ManpowerRow[]) => void;
}) {
    const t = useTranslations('siteDiary.manpower');
    const set = (key: string, patch: Partial<ManpowerRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
    const total = rows.reduce((s, r) => s + r.skilledCount + r.labourerCount, 0);

    const pickCrew = (key: string, crewId: string | undefined) => {
        const crew = crews.find(c => c.id === crewId);
        if (crew === undefined) {
            set(key, { crewId: null });
            return;
        }
        set(key, { crewId: crew.id, crewName: crew.name, trade: crew.trade, skilledCount: crew.skilledCount, labourerCount: crew.labourerCount });
    };

    return (
        <div className="flex flex-col gap-3">
            {rows.length === 0 && <div className="text-[13px] text-gray-500">{t('empty')}</div>}
            {rows.map(r => (
                <div key={r.key} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
                    {crews.length > 0 && (
                        <label className={`${field} col-span-2 sm:col-span-6`}>
                            {t('crew')}
                            <Select allowClear showSearch={{ optionFilterProp: 'label' }} value={r.crewId ?? undefined} disabled={disabled} placeholder={t('crewPlaceholder')}
                                options={crews.map(c => ({ value: c.id, label: c.name }))} onChange={(v: string | undefined) => pickCrew(r.key, v)} />
                        </label>
                    )}
                    <label className={`${field} col-span-2 sm:col-span-3`}>
                        {t('name')}
                        <Input value={r.crewName} disabled={disabled} maxLength={200} onChange={e => set(r.key, { crewName: e.target.value })} />
                    </label>
                    <label className={`${field} col-span-2 sm:col-span-3`}>
                        {t('trade')}
                        <Input value={r.trade} disabled={disabled} maxLength={60} onChange={e => set(r.key, { trade: e.target.value })} />
                    </label>
                    <label className={field}>
                        {t('skilled')}
                        <InputNumber className="!w-full" min={0} max={10000} precision={0} inputMode="numeric" value={r.skilledCount} disabled={disabled}
                            onChange={v => set(r.key, { skilledCount: v ?? 0 })} />
                    </label>
                    <label className={field}>
                        {t('labourer')}
                        <InputNumber className="!w-full" min={0} max={10000} precision={0} inputMode="numeric" value={r.labourerCount} disabled={disabled}
                            onChange={v => set(r.key, { labourerCount: v ?? 0 })} />
                    </label>
                    <label className={field}>
                        {t('hours')}
                        <InputNumber className="!w-full" min={0} max={24} step={0.5} inputMode="decimal" value={r.hours} disabled={disabled}
                            onChange={v => set(r.key, { hours: v ?? 0 })} />
                    </label>
                    <label className={`${field} col-span-2 sm:col-span-3`}>
                        {t('costCode')}
                        <CostCodePicker projectId={projectId} value={r.costCodeId} disabled={disabled}
                            onChange={id => set(r.key, { costCodeId: id })} />
                    </label>
                    <label className={`${field} col-span-2 sm:col-span-5`}>
                        {t('note')}
                        <Input value={r.note} disabled={disabled} maxLength={2000} onChange={e => set(r.key, { note: e.target.value })} />
                    </label>
                    <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                        <Button danger type="text" icon={<DeleteOutlined />} disabled={disabled} aria-label={t('remove')}
                            onClick={() => onChange(rows.filter(x => x.key !== r.key))}>{t('remove')}</Button>
                    </div>
                </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button icon={<PlusOutlined />} disabled={disabled}
                    onClick={() => onChange([...rows, { key: nextKey(), crewId: null, supplierId: null, crewName: '', trade: '', skilledCount: 0, labourerCount: 0, hours: 8, costCodeId: null, note: '' }])}>
                    {t('add')}
                </Button>
                <span className="text-[13px] text-gray-600">{t('total', { count: total })}</span>
            </div>
        </div>
    );
}
