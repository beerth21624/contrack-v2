'use client';

import { useTranslations } from 'next-intl';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { BoqItemRow } from '@/domain/boq/types';
import { useProjectStore } from '@/store/project-store';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';

/**
 * Rows a level fills that have a quantity but no price in the standard price list (e.g. fill soil): without a
 * price the level would come to 0 บาท. The price typed here is the same one as on the BOQ page.
 */
export function MissingPrices({ rows }: { rows: BoqItemRow[] }) {
    const t = useTranslations('journeyUi.missingPrices');
    const overrides = useProjectStore(s => s.project.boqOverrides);
    const setOverride = useProjectStore(s => s.setBoqOverride);
    const shown = rows.filter(r => {
        const ov = overrides[r.key];
        const priced = ov?.mat !== undefined || ov?.lab !== undefined;
        return r.qty > 0 && (priced || (r.matUnit === 0 && r.labUnit === 0 && !r.fromCalc.mat && !r.fromCalc.lab));
    });
    if (shown.length === 0) return null;
    const missing = shown.some(r => r.total === 0);
    return (
        <div className={`rounded-lg border px-4 py-3 ${missing ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-white'}`}>
            <div className={`flex items-center gap-2 text-[13px] font-semibold ${missing ? 'text-orange-800' : 'text-gray-700'}`}>
                {missing && <ExclamationCircleOutlined />} {t('title')}
            </div>
            <div className="text-[12px] text-gray-600 mb-2">
                {missing
                    ? t('hintMissing')
                    : t('hintOk')}
            </div>
            <div className="flex flex-col gap-2">
                {shown.map(r => (
                    <div key={r.key} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_120px_120px] items-center gap-x-3 gap-y-1">
                        <div className="col-span-2 sm:col-span-1 text-[13px] text-gray-800">
                            {r.desc}{' '}
                            <span className="text-gray-500 tabular-nums">
                                {t(r.grossQty !== null && r.grossQty !== r.qty ? 'qtyWithWaste' : 'qty', { qty: formatNumber(r.grossQty ?? r.qty), unit: r.unit })}
                            </span>
                        </div>
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-gray-500">{t('matLabel', { unit: r.unit })}</span>
                            <NumberCell value={r.matUnit} blankZero ariaLabel={t('matAria', { desc: r.desc })}
                                onCommit={v => setOverride(r.key, 'mat', v)} />
                        </label>
                        <label className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-gray-500">{t('labLabel', { unit: r.unit })}</span>
                            <NumberCell value={r.labUnit} blankZero ariaLabel={t('labAria', { desc: r.desc })}
                                onCommit={v => setOverride(r.key, 'lab', v)} />
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}
