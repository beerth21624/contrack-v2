'use client';

import { Select } from 'antd';
import {
    roofing, roofingOp, ROOFING_BOQ_ROWS, ROOFING_BOQ_UNITS, ROOFING_FACTOR_UNITS, ROOFING_ITEMS, ROOFING_TAKEOFF_UNITS,
    type RoofingRow, type RoofingTakeoff,
} from '@/domain/calculators/roofing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { LengthsCell } from '@/components/sheet/LengthsCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import RoofingJourney from './RoofingJourney';
import { useTranslations } from 'next-intl';

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));

/** Where E ปริมาณถอดแบบ comes from, as one select value. */
const sourceOf = (t: RoofingTakeoff) => (t.kind === 'row' ? `row:${t.ref}` : t.kind);

function TakeoffCell({ row, index, rows, value, onChange }: {
    row: RoofingRow; index: number; rows: RoofingRow[]; value: number; onChange: (t: RoofingTakeoff) => void;
}) {
    const t = useTranslations('calculators');
    const tk = row.takeoff;
    const lengths = tk.kind === 'lengths' || tk.kind === 'rake' ? tk.lengths : [value];
    const options = [
        { value: 'lengths', label: t('roofing.enterManually') },
        { value: 'rake', label: t('roofing.enterManuallyCosDegrees') },
        { value: 'slope', label: t('roofing.slopedAreaK7') },
        ...rows.flatMap((r, j) => (j === index ? [] : [{ value: `row:${r.key}`, label: t('roofing.row', { v: String(j + 1), item: r.item }) }])),
    ];
    const setSource = (s: string) => {
        if (s === 'slope') onChange({ kind: 'slope' });
        else if (s === 'lengths') onChange({ kind: 'lengths', lengths });
        else if (s === 'rake') onChange({ kind: 'rake', lengths, deg: tk.kind === 'rake' ? tk.deg : 40 });
        else onChange({ kind: 'row', ref: s.slice(4) });
    };
    return (
        <div className="flex flex-col gap-0.5">
            <Select size="small" variant="borderless" value={sourceOf(tk)} options={options} onChange={setSource}
                popupMatchSelectWidth={false} className="text-[11px]" style={{ width: '100%' }} aria-label={t('roofing.sourceOfTheTakeOff')} />
            {tk.kind === 'lengths' && (
                <LengthsCell lengths={tk.lengths} ariaLabel={t('roofing.takeOffQuantity')} onChange={ls => onChange({ kind: 'lengths', lengths: ls })} />
            )}
            {tk.kind === 'rake' && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_56px] items-center gap-1">
                    <LengthsCell lengths={tk.lengths} ariaLabel={t('roofing.horizontalLength')} onChange={ls => onChange({ ...tk, lengths: ls })} />
                    <span className="text-[11px] text-gray-500">÷cos</span>
                    <NumberCell value={tk.deg} digits={0} ariaLabel={t('common.degrees')} onCommit={v => onChange({ ...tk, deg: v ?? 40 })} />
                </div>
            )}
            {(tk.kind !== 'lengths' || tk.lengths.length > 1) && (
                <span className="text-right tabular-nums px-1 rounded-sm" style={{ background: SHEET_COLORS.calc }}>
                    {formatNumber(value)}
                </span>
            )}
        </div>
    );
}

export default function RoofingPage() {
    return useJourneyMode() ? <RoofingJourney /> : <RoofingSheet />;
}

/** The Excel-mirror sheet (/calc/roofing). */
function RoofingSheet() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofing);

    const setRow = (i: number, patch: Partial<RoofingRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const newKey = () => {
        let n = input.rows.length + 1;
        while (input.rows.some(r => r.key === `row-${n}`)) n++;
        return `row-${n}`;
    };

    return (
        <CalculatorShell def={roofing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('roofing.addOnRoofAreaCalculation')}>
                <div className="max-w-lg">
                    <InputNumberField label={t('roofing.horizontalAreaSqM')} value={input.planArea} unit={t('common.sqM')}
                        onChange={v => update({ planArea: v })} />
                    <InputNumberField label={t('roofing.roofPitchDegrees')} value={input.slopeDeg} unit={t('common.degrees')}
                        onChange={v => update({ slopeDeg: v })} />
                    <CalcField label={t('roofing.slopedAreaSqM')} value={outputs.slopeArea} unit={t('common.sqM')} strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    {t('roofing.slopedAreaHorizontalAreaCos')}
                </p>
            </SheetCard>

            <SheetCard title={t('roofing.roofingMaterialQuantityCalculationTable')}>
                <EditableTable<RoofingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    lockedRows={ROOFING_BOQ_ROWS}
                    newRow={() => ({
                        key: newKey(), item: '', factor: 0, factorUnit: '', takeoff: { kind: 'lengths', lengths: [] },
                        takeoffUnit: '', unit: '',
                    })}
                    addLabel={t('common.addItem')}
                    columns={[
                        {
                            kind: 'select', key: 'item', title: t('roofing.roofingAndCappingMaterials'), width: 230, options: opts(ROOFING_ITEMS),
                            get: r => r.item, set: (r, v) => ({ ...r, item: v }),
                        },
                        { kind: 'number', key: 'factor', title: t('roofing.quantityPerUnit'), width: 80, get: r => r.factor, set: (r, v) => ({ ...r, factor: v }) },
                        {
                            kind: 'select', key: 'factorUnit', title: t('common.unit'), width: 105, options: opts(ROOFING_FACTOR_UNITS),
                            get: r => r.factorUnit, set: (r, v) => ({ ...r, factorUnit: v }),
                        },
                        {
                            kind: 'label', key: 'takeoff', title: t('roofing.takeOffQuantity2'), width: 190,
                            get: (r, i) => (
                                <TakeoffCell row={r} index={i} rows={input.rows} value={outputs[`takeoff.${i}`] ?? 0}
                                    onChange={takeoff => setRow(i, { takeoff })} />
                            ),
                        },
                        {
                            kind: 'select', key: 'takeoffUnit', title: t('common.unit'), width: 80, options: opts(ROOFING_TAKEOFF_UNITS),
                            get: r => r.takeoffUnit, set: (r, v) => ({ ...r, takeoffUnit: v }),
                        },
                        {
                            kind: 'calc', key: 'qty', title: t('roofing.bOQQuantity'), width: 80, digits: 0,
                            get: (_, i) => outputs[`qty.${i}`] ?? 0,
                        },
                        {
                            kind: 'select', key: 'unit', title: t('common.unit'), width: 80, options: opts(ROOFING_BOQ_UNITS),
                            get: r => r.unit, set: (r, v) => ({ ...r, unit: v }),
                        },
                    ]}
                />
                <ul className="mt-2 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>
                        {t('roofing.bOQQuantityROUNDUPTakeOff')}
                    </li>
                    <li>{t('common.rows1')}{ROOFING_BOQ_ROWS}{t('roofing.areSentToBOQSection')}</li>
                    <li>
                        {t('roofing.roofingLabourSlopedArea')}{formatNumber(outputs.R175)}{t('roofing.sqMFasciaBoardInstallation')}{input.rows[11]?.item ?? t('roofing.fasciaBoard')}) {formatNumber(outputs.R176)}{t('common.m3')}
                    </li>
                    <li>
                        {t('roofing.gableVergeHorizontalLengthCos')}
                    </li>
                </ul>
                {input.rows.some(r => r.factorUnit !== '' && roofingOp(r.factorUnit) === 'div' && r.factor === 0) && (
                    <p className="mt-1 text-[12px] text-red-500">{t('roofing.aRowDividesButIts')}</p>
                )}
            </SheetCard>
        </CalculatorShell>
    );
}
