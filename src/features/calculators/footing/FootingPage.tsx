'use client';

import Link from 'next/link';
import {
    footing, footingRow, footingTotals, emptyFootingRow, FOOTING_BAR_SIZES, FOOTING_NAMES,
    type FootingRow, type RebarWeights,
} from '@/domain/calculators/footing';
import { footingBackfillKey, pedestal, remapPedestalFootings } from '@/domain/calculators/pedestal';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { FootingJourney } from './FootingJourney';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { GROUP_COLORS, StructureTable, TotalValue, type StructColumn, type StructGroup } from '@/components/sheet/StructureTable';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeOptions = FOOTING_BAR_SIZES.map(s => ({ value: s }));

/** The 5 columns of one bar group (ขนาด, จำนวน, ความยาว/เส้น, ความยาว รวม, น้ำหนัก) with sizes RB6…DB20 and their SUMIF totals above. */
function barGroup(t: CalcT, 
    prefix: string, lengthTitle: string, totals: RebarWeights,
    size: (r: FootingRow) => string, setSize: (r: FootingRow, v: string) => FootingRow,
    count: (r: FootingRow) => number, setCount: (r: FootingRow, v: number) => FootingRow,
    calc: (r: FootingRow) => { len: number; total: number; kg: number },
): StructColumn<FootingRow>[] {
    const cols: StructColumn<FootingRow>[] = [
        {
            kind: 'select', key: `${prefix}Size`, title: t('common.size'), width: 84, options: sizeOptions, allowClear: true,
            get: size, set: (r, v) => setSize(r, typeof v === 'string' ? v : ''),
        },
        { kind: 'number', key: `${prefix}Count`, title: t('common.numberBars'), width: 64, digits: 0, get: count, set: setCount },
        { kind: 'calc', key: `${prefix}Len`, title: lengthTitle, get: r => calc(r).len },
        { kind: 'calc', key: `${prefix}Total`, title: t('common.totalLengthM'), get: r => calc(r).total },
        { kind: 'calc', key: `${prefix}Kg`, title: t('common.weightKg'), digits: 2, get: r => calc(r).kg },
    ];
    return cols.map((c, i) => {
        const s = REBAR_SIZES[i];
        return s === undefined ? c : { ...c, sub: s, total: <TotalValue value={totals[s]} /> };
    });
}

export default function FootingPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(footing);
    const tot = footingTotals(input.rows);
    const ped = result.calcOutputs.pedestal;
    /** Column AI: the pedestal sheet subtracts its concrete (shown without it until that sheet is available). */
    const backfillOf = (r: FootingRow, i: number) => ped?.[footingBackfillKey(i)] ?? footingRow(r).backfillGross;
    const backfillTotal = ped?.backfill ?? tot.backfillGross;
    const setCalculatorInput = useProjectStore(s => s.setCalculatorInput);
    const inJourney = useJourneyMode();
    /** Deleting a footing row shifts the rows below it: keep every pedestal on the footing it sat on (D13). */
    const onRowsChange = (rows: FootingRow[]) => {
        const moved = remapPedestalFootings(calculatorInput(useProjectStore.getState().project, pedestal), input.rows, rows);
        if (moved) setCalculatorInput(pedestal.id, moved);
        update({ rows });
    };

    const groups: StructGroup<FootingRow>[] = [
        {
            title: t('footing.footingData'), color: GROUP_COLORS.info,
            columns: [
                {
                    kind: 'select', key: 'name', title: t('footing.footingName2'), width: 76,
                    options: FOOTING_NAMES.map(n => ({ value: n })), allowClear: true,
                    get: r => r.name, set: (r, v) => ({ ...r, name: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'count', title: t('footing.numberOfFootings'), width: 70, digits: 0, get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                { kind: 'number', key: 'width', title: t('common.widthM'), width: 64, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 64, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                { kind: 'number', key: 'depth', title: t('common.depthM'), width: 64, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
            ],
        },
        {
            band: t('footing.beddingMaterial'), title: t('footing.excavatedSoilCuM'), color: GROUP_COLORS.base, total: <TotalValue value={tot.excavation} />,
            columns: [
                { kind: 'number', key: 'excavationDepth', title: t('common.depthM'), width: 64, get: r => r.excavationDepth, set: (r, v) => ({ ...r, excavationDepth: v }) },
                { kind: 'calc', key: 'excavation', title: t('common.quantityCuM'), get: r => footingRow(r).excavation },
            ],
        },
        {
            band: t('footing.beddingMaterial'), title: t('footing.coarseSandCuM'), color: GROUP_COLORS.base, total: <TotalValue value={tot.sand} />,
            columns: [
                { kind: 'number', key: 'sandThickness', title: t('common.thicknessM'), width: 64, get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                { kind: 'calc', key: 'sand', title: t('common.quantityCuM'), get: r => footingRow(r).sand },
            ],
        },
        {
            band: t('footing.beddingMaterial'), title: t('footing.leanConcreteCuM'), color: GROUP_COLORS.base, total: <TotalValue value={tot.lean} />,
            columns: [
                { kind: 'number', key: 'leanThickness', title: t('common.thicknessM'), width: 64, get: r => r.leanThickness, set: (r, v) => ({ ...r, leanThickness: v }) },
                { kind: 'calc', key: 'lean', title: t('common.quantityCuM'), get: r => footingRow(r).lean },
            ],
        },
        {
            band: t('common.reinforcement'), title: t('footing.mainReinforcementShortDirectionKg'), color: GROUP_COLORS.rebar,
            columns: barGroup(t, 'short', t('common.lengthBarM'), tot.short,
                r => r.shortBarSize, (r, v) => ({ ...r, shortBarSize: v }),
                r => r.shortBarCount, (r, v) => ({ ...r, shortBarCount: v }),
                r => { const c = footingRow(r); return { len: c.shortLength, total: c.shortTotal, kg: c.shortKg }; }),
        },
        {
            band: t('common.reinforcement'), title: t('footing.mainReinforcementLongDirectionKg'), color: GROUP_COLORS.rebar,
            columns: barGroup(t, 'long', t('common.lengthBarM'), tot.long,
                r => r.longBarSize, (r, v) => ({ ...r, longBarSize: v }),
                r => r.longBarCount, (r, v) => ({ ...r, longBarCount: v }),
                r => { const c = footingRow(r); return { len: c.longLength, total: c.longTotal, kg: c.longKg }; }),
        },
        {
            band: t('common.reinforcement'), title: t('footing.ringBarsKg'), color: GROUP_COLORS.rebar,
            columns: barGroup(t, 'ring', t('footing.lengthPerBarM'), tot.ring,
                r => r.ringBarSize, (r, v) => ({ ...r, ringBarSize: v }),
                r => r.ringBarCount, (r, v) => ({ ...r, ringBarCount: v }),
                r => { const c = footingRow(r); return { len: c.ringLength, total: c.ringTotal, kg: c.ringKg }; }),
        },
        {
            band: t('common.formwork'), title: t('common.formworkSqM'), color: GROUP_COLORS.concrete, total: <TotalValue value={tot.formwork} />,
            columns: [{ kind: 'calc', key: 'formwork', title: t('common.quantitySqM'), get: r => footingRow(r).formwork }],
        },
        {
            band: t('common.concrete'), title: t('common.structuralConcreteCuM'), color: GROUP_COLORS.concrete, total: <TotalValue value={tot.concrete} />,
            columns: [{ kind: 'calc', key: 'concrete', title: t('common.quantityCuM'), get: r => footingRow(r).concrete }],
        },
        {
            band: t('footing.backfill'), title: t('footing.backfillCuM'), color: GROUP_COLORS.fill, total: <TotalValue value={backfillTotal} />,
            columns: [{ kind: 'calc', key: 'backfill', title: t('common.quantity'), get: (r, i) => backfillOf(r, i) }],
        },
    ];

    const summary = (
        <SheetCard title={t('footing.sentToTheStructuralMaterial')}>
            <CalcField label={t('footing.excavatedSoil')} value={outputs.excavation} unit={t('common.cuM')} digits={4} />
            <CalcField label={t('footing.coarseSand')} value={outputs.sand} unit={t('common.cuM')} digits={4} />
            <CalcField label={t('common.leanConcrete')} value={outputs.lean} unit={t('common.cuM')} digits={4} />
            {REBAR_SIZES.map(s => (
                <CalcField key={s} label={t('footing.reinforcementS', { s })} value={outputs[`rebar.${s}`]} unit={t('common.kg')} digits={4} />
            ))}
            <CalcField label={t('common.formwork')} value={outputs.formwork} unit={t('common.sqM')} digits={4} />
            <CalcField label={t('common.structuralConcrete')} value={outputs.concrete} unit={t('common.cuM')} digits={4} />
            <CalcField label={t('footing.backfillBoq81')} value={backfillTotal} unit={t('common.cuM')} digits={4} strong />
        </SheetCard>
    );

    if (inJourney) {
        return (
            <CalculatorShell def={footing} result={result} isDefault={isDefault} onReset={reset}>
                <FootingJourney rows={input.rows} onChange={onRowsChange} backfillTotal={backfillTotal} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={footing} result={result} isDefault={isDefault} onReset={reset} aside={summary}>
            <SheetCard title={t('footing.footingData')}>
                <StructureTable<FootingRow>
                    rows={input.rows}
                    groups={groups}
                    onChange={onRowsChange}
                    newRow={() => emptyFootingRow()}
                    addLabel={t('footing.addFooting')}
                />
                <ul className="mt-3 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>{t('footing.excavatedSoilCoarseSandLean')}</li>
                    <li>{t('footing.coarseSandWith25Allowance')}</li>
                    <li>{t('footing.mainReinforcementLengthPerBar')}</li>
                    <li>{t('footing.formworkNumberPerimeterDepthSides')}</li>
                    <li>
                        {t('footing.backfillExcavatedSoilCoarseSand')}<Link className="text-blue-600 underline" href="/calc/pedestal">{t('footing.pedestalProgram')}</Link>{t('footing.boq81Backfill')}
                    </li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
