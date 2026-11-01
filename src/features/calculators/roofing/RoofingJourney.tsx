'use client';

import {
    roofing, withRoofSlope, ROOFING_BOQ_UNITS, ROOFING_FACTOR_UNITS, ROOFING_ITEMS, type RoofingRow,
} from '@/domain/calculators/roofing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { LengthsCell, formatLengths, parseLengths } from '@/components/sheet/LengthsCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { Hint, LabelWithHint, PlanNumber, ResultSummary, blankIfZero } from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

/** What to measure on the roof plan for each material row (by the row's stable key). */
const measureHints = (t: CalcT): Record<string, string> => ({
    ridge: t('roofing.lengthOfAllRidges'),
    rake: t('roofing.gableEdgeLengthMeasuredHorizontally'),
    wall: t('roofing.lengthWhereTheRoofMeets'),
    'eave-end': t('roofing.numberOfRidgeEndsAt'),
    'gable-end': t('roofing.numberOfRidgeEndsAt2'),
    'two-way': t('roofing.numberOfPointsWhereRidges'),
    valley: t('roofing.valleyGutterLengthGutterBetween'),
    'bird-stop': t('roofing.eavesLengthThatNeedsBird'),
    fascia: t('roofing.fasciaLengthAroundTheRoof'),
});

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));

export default function RoofingJourney() {
    const t = useTranslations('calculators');
    const hints = measureHints(t);
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofing);
    const setRow = (i: number, patch: Partial<RoofingRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const itemOf = (key: string) => input.rows.find(r => r.key === key)?.item ?? '';
    const qtyOf = (key: string) => {
        const i = input.rows.findIndex(r => r.key === key);
        return i < 0 ? undefined : outputs[`qty.${i}`];
    };
    const rakeOffSlope = input.rows.filter(r => r.takeoff.kind === 'rake' && r.takeoff.deg !== input.slopeDeg);
    // Roof area typed but no pitch: the slope area would silently equal the plan area.
    const slopeMissing = input.planArea > 0 && input.slopeDeg === 0;

    const measure = (r: RoofingRow, i: number) => {
        const tk = r.takeoff;
        switch (tk.kind) {
            case 'lengths':
                // Points are counted, not measured: a count example instead of a sum of lengths.
                // eslint-disable-next-line no-restricted-syntax -- stored take-off unit value, not UI text
                if (r.takeoffUnit === 'จุด') {
                    return (
                        <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                            <TextCell value={formatLengths(tk.lengths)} ariaLabel={`${r.item} (${r.takeoffUnit})`} placeholder={t('roofing.eG4')}
                                onCommit={v => {
                                    const parsed = parseLengths(v ?? '');
                                    if (parsed) setRow(i, { takeoff: { kind: 'lengths', lengths: parsed } });
                                }} />
                        </div>
                    );
                }
                return <LengthsCell lengths={tk.lengths} ariaLabel={`${r.item} (${r.takeoffUnit})`}
                    onChange={lengths => setRow(i, { takeoff: { kind: 'lengths', lengths } })} />;
            case 'rake':
                return <LengthsCell lengths={tk.lengths} ariaLabel={t('roofing.horizontalLengthM', { item: r.item })}
                    onChange={lengths => setRow(i, { takeoff: { ...tk, lengths } })} />;
            case 'slope':
                return <span className="px-1 text-[12px] text-gray-500">{t('roofing.calculatedFromTheRoofArea')}</span>;
            case 'row':
                return <span className="px-1 text-[12px] text-gray-500">{t('roofing.useTheSameValueAs')}{itemOf(tk.ref)}</span>;
        }
    };

    return (
        <CalculatorShell def={roofing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('roofing.roofSize')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 items-start">
                    <PlanNumber label={t('roofing.horizontalRoofArea')} fieldKey="planArea" value={input.planArea} unit={t('common.sqM')} range={[10, 2000]}
                        hint={t('roofing.seenFromAboveIncludingThe')} onChange={v => update({ planArea: v })} />
                    <PlanNumber label={t('common.roofPitch')} fieldKey="slopeDeg" value={input.slopeDeg} unit={t('common.degrees')} digits={0} range={[5, 60]}
                        presets={[30, 35, 40]} presetFormat={v => `${String(v)}°`} missing={slopeMissing}
                        hint={t('roofing.readFromTheSection')} onChange={v => update(p => withRoofSlope(p, v))} />
                    {(outputs.slopeArea ?? 0) > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-gray-600 leading-tight">{t('roofing.slopedRoofArea')}</span>
                            <span className="text-[14px] font-semibold tabular-nums">{formatNumber(outputs.slopeArea)}{t('common.sqM2')}</span>
                        </div>
                    )}
                </div>
            </SheetCard>

            <SheetCard title={t('roofing.measuredFromTheRoofPlan')}>
                <Hint>{t('roofing.youCanTypeTheLength')}</Hint>
                <div className="mt-2">
                    <EditableTable<RoofingRow>
                        rows={input.rows}
                        onChange={rows => update({ rows })}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'item', title: t('roofing.material'), width: 260,
                                get: r => <LabelWithHint label={r.item} hint={hints[r.key]} /> },
                            { kind: 'label', key: 'measure', title: t('roofing.measuredFromTheDrawing'), width: 200, get: (r, i) => measure(r, i) },
                            { kind: 'label', key: 'takeoffUnit', title: t('common.unit'), width: 60,
                                get: r => <span className="px-1 text-gray-600">{r.takeoffUnit}</span> },
                            { kind: 'calc', key: 'qty', title: t('roofing.needed'), width: 80, digits: 0, get: (_, i) => blankIfZero(outputs[`qty.${i}`] ?? 0) },
                            { kind: 'label', key: 'unit', title: '', width: 50, get: r => <span className="px-1 text-gray-600">{r.unit}</span> },
                        ]}
                    />
                </div>
            </SheetCard>

            <AdvancedSection title={t('roofing.materialUsageRateSCGTiles')}>
                <EditableTable<RoofingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    canDelete={false}
                    columns={[
                        { kind: 'select', key: 'item', title: t('roofing.material'), width: 240, options: opts(ROOFING_ITEMS),
                            get: r => r.item, set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'factor', title: t('roofing.rate'), width: 80, get: r => r.factor, set: (r, v) => ({ ...r, factor: v }) },
                        { kind: 'select', key: 'factorUnit', title: t('roofing.rateUnit'), width: 110, options: opts(ROOFING_FACTOR_UNITS),
                            get: r => r.factorUnit, set: (r, v) => ({ ...r, factorUnit: v }) },
                        { kind: 'select', key: 'unit', title: t('roofing.purchaseUnit'), width: 80, options: opts(ROOFING_BOQ_UNITS),
                            get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                        { kind: 'label', key: 'deg', title: t('roofing.pitchUsedDegrees'), width: 110,
                            get: (r, i) => {
                                const tk = r.takeoff;
                                if (tk.kind !== 'rake') return <span className="block text-center text-gray-400">-</span>;
                                return <NumberCell value={tk.deg} digits={0} ariaLabel={t('roofing.gableVergePitchDegrees')}
                                    onCommit={v => setRow(i, { takeoff: { ...tk, deg: v ?? input.slopeDeg } })} />;
                            } },
                    ]}
                />
                <div className="mt-2 text-[12px] text-gray-500">
                    {t('roofing.ratesInSheetsSqM')}
                </div>
                {rakeOffSlope.length > 0 && (
                    <div className="mt-1 text-[12px] text-orange-600">
                        {t('roofing.theGableVergeIsCalculated')}{rakeOffSlope.map(r => (r.takeoff.kind === 'rake' ? `${r.takeoff.deg}°` : '')).join(', ')})
                    </div>
                )}
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('roofing.slopedRoofArea2'), value: outputs.slopeArea, unit: t('common.sqM') },
                    { label: itemOf('tile') === '' ? t('roofing.tiles') : itemOf('tile'), value: qtyOf('tile'), unit: t('roofing.sheets'), digits: 0 },
                    { label: t('roofing.fasciaLength'), value: outputs.fasciaLength, unit: t('common.m') },
                ]}
                note={t('roofing.theSlopedRoofAreaIs')} />
        </CalculatorShell>
    );
}
