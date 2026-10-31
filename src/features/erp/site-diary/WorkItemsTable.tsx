'use client';

// ─── What got done today: a cost code, the cumulative progress at the end of the day (%), the quantity done ───
import { App, Button, Input, InputNumber, Progress } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { CostCodePicker } from '../shared/CostCodePicker';
import { type WorkRow, nextKey } from './form';

export function WorkItemsTable({ projectId, rows, disabled, onChange }: {
    projectId: string;
    rows: readonly WorkRow[];
    disabled: boolean;
    onChange: (rows: WorkRow[]) => void;
}) {
    const t = useTranslations('siteDiary.work');
    const locale = useLocale();
    const { message } = App.useApp();
    const set = (key: string, patch: Partial<WorkRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

    return (
        <div className="flex flex-col gap-3">
            {rows.length === 0 && <div className="text-[13px] text-gray-500">{t('empty')}</div>}
            {rows.map(r => (
                <div key={r.key} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
                    <div className="col-span-2 min-w-0 sm:col-span-6">
                        <span className="font-semibold tabular-nums">{r.code}</span>
                        <span className="ml-2 break-words text-[13px] text-gray-700">{locale === 'en' && r.descEn !== '' ? r.descEn : r.descTh}</span>
                    </div>
                    <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('after')}
                        <InputNumber className="!w-full" min={0} max={100} step={5} precision={1} inputMode="decimal" suffix="%" disabled={disabled}
                            value={Math.round(r.progressAfter * 1000) / 10}
                            onChange={v => set(r.key, { progressAfter: Math.min(1, Math.max(0, (v ?? 0) / 100)) })} />
                        <span className="text-[12px] text-gray-500">{t('before', { pct: Math.round(r.progressBefore * 1000) / 10 })}</span>
                    </label>
                    <div className="col-span-2 flex min-w-0 items-center sm:col-span-4">
                        <Progress percent={Math.round(r.progressAfter * 1000) / 10} success={{ percent: Math.round(r.progressBefore * 1000) / 10 }} size="small" className="!m-0" />
                    </div>
                    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('qty')}{r.unit !== '' ? ` (${r.unit})` : ''}
                        <InputNumber className="!w-full" min={0} inputMode="decimal" disabled={disabled} value={r.qtyDone}
                            onChange={v => set(r.key, { qtyDone: v })} />
                    </label>
                    <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-3">
                        {t('note')}
                        <Input value={r.note} disabled={disabled} maxLength={2000} onChange={e => set(r.key, { note: e.target.value })} />
                    </label>
                    <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                        <Button danger type="text" icon={<DeleteOutlined />} disabled={disabled} aria-label={t('remove')}
                            onClick={() => onChange(rows.filter(x => x.key !== r.key))}>{t('remove')}</Button>
                    </div>
                </div>
            ))}
            {!disabled && (
                <CostCodePicker projectId={projectId} value={null} allowClear={false} placeholder={t('addPlaceholder')}
                    onChange={(id, code) => {
                        if (id === null || code === undefined) return;
                        if (rows.some(r => r.costCodeId === id)) {
                            void message.warning(t('duplicate'));
                            return;
                        }
                        onChange([...rows, {
                            key: nextKey(), costCodeId: id, code: code.code, descTh: code.descTh, descEn: code.descEn, unit: code.unit, qtyDone: null,
                            progressBefore: code.reportedProgress, progressAfter: code.reportedProgress, note: '',
                        }]);
                    }} />
            )}
        </div>
    );
}
