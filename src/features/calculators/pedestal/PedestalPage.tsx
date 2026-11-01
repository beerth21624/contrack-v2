'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { footing } from '@/domain/calculators/footing';
import {
    pedestal, pedestalRow, pedestalTotals, footingRefFor, emptyPedestalRow, PEDESTAL_BAR_SIZES, PEDESTAL_NAMES,
    type PedestalRow,
} from '@/domain/calculators/pedestal';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PedestalJourney } from './PedestalJourney';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import {
    GROUP_COLORS, StructureTable, TotalValue, type StructColumn, type StructGroup,
} from '@/components/sheet/StructureTable';
import { useTranslations } from 'next-intl';

const sizeOptions = PEDESTAL_BAR_SIZES.map(s => ({ value: s }));

/** Puts the bar sizes RB6…DB20 (sheet row 5) and their SUMIF totals (row 6) over the first five columns of a bar group. */
function withSizeTotals(cols: StructColumn<PedestalRow>[], totals: Record<string, number>): StructColumn<PedestalRow>[] {
    return cols.map((c, i) => {
        const s = REBAR_SIZES[i];
        return s === undefined ? { ...c, sub: '-', total: '-' } : { ...c, sub: s, total: <TotalValue value={totals[s]} /> };
    });
}

export default function PedestalPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(pedestal);
    const project = useProjectStore(s => s.project);
    const footingRows = useMemo(() => calculatorInput(project, footing).rows, [project]);
    const fo = result.calcOutputs.footing;
    const inJourney = useJourneyMode();
    const tot = pedestalTotals(input.rows, fo);
    const calc = (r: PedestalRow) => pedestalRow(r, footingRefFor(fo, r.footing));

    const footingOptions = footingRows.map((f, i) => ({ value: i, label: `${i + 1}${f.name ? ` · ${f.name}` : ''}` }));

    const groups: StructGroup<PedestalRow>[] = [
        {
            title: t('pedestal.pedestalQuantitySummary'), color: GROUP_COLORS.info,
            columns: [
                {
                    kind: 'select', key: 'name', title: t('common.columnName'), width: 72,
                    options: PEDESTAL_NAMES.map(n => ({ value: n })), allowClear: true,
                    get: r => r.name, set: (r, v) => ({ ...r, name: typeof v === 'string' ? v : '' }),
                },
                {
                    kind: 'select', key: 'footing', title: t('pedestal.standingOnFootingRow'), width: 88, options: footingOptions,
                    placeholder: t('pedestal.select'), get: r => r.footing,
                    set: (r, v) => ({ ...r, footing: typeof v === 'number' ? v : -1 }),
                },
                { kind: 'number', key: 'count', title: t('common.numberOfColumnsPcs'), width: 64, digits: 0, get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                { kind: 'number', key: 'width', title: t('common.widthM'), width: 64, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 64, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                { kind: 'number', key: 'height', title: t('common.heightM'), width: 64, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
            ],
        },
        {
            band: t('common.reinforcement'), title: t('common.mainReinforcementQuantityKg'), color: GROUP_COLORS.rebar,
            columns: withSizeTotals([
                {
                    kind: 'select', key: 'mainBarSize', title: t('common.size'), width: 84, options: sizeOptions, allowClear: true,
                    get: r => r.mainBarSize, set: (r, v) => ({ ...r, mainBarSize: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'mainBarCount', title: t('common.numberBars'), width: 64, digits: 0, get: r => r.mainBarCount, set: (r, v) => ({ ...r, mainBarCount: v }) },
                { kind: 'calc', key: 'mainLength', title: t('common.lengthBarM'), get: r => calc(r).mainLength },
                { kind: 'calc', key: 'mainTotal', title: t('common.totalLengthM'), get: r => calc(r).mainTotal },
                { kind: 'calc', key: 'mainKg', title: t('common.weightKg'), get: r => calc(r).mainKg },
            ], tot.main),
        },
        {
            band: t('common.reinforcement'), title: t('common.stirrupQuantityKg'), color: GROUP_COLORS.rebar,
            columns: withSizeTotals([
                {
                    kind: 'select', key: 'stirrupSize', title: t('common.size'), width: 84, options: sizeOptions, allowClear: true,
                    get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: typeof v === 'string' ? v : '' }),
                },
                { kind: 'number', key: 'stirrupSpacing', title: t('common.spacingM'), width: 64, get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                { kind: 'calc', key: 'stirrupCount', title: t('common.numberStirrups'), digits: 0, get: r => calc(r).stirrupCount },
                { kind: 'calc', key: 'stirrupLength', title: t('common.lengthBarM'), get: r => calc(r).stirrupLength },
                { kind: 'calc', key: 'stirrupTotal', title: t('common.totalLengthM'), get: r => calc(r).stirrupTotal },
                { kind: 'calc', key: 'stirrupKg', title: t('common.weightKg'), get: r => calc(r).stirrupKg },
            ], tot.stirrup),
        },
        {
            band: t('common.formwork'), title: t('common.formworkSqM'), color: GROUP_COLORS.concrete, total: <TotalValue value={tot.formwork} />,
            columns: [{ kind: 'calc', key: 'formwork', title: t('common.formworkSqM'), get: r => calc(r).formwork }],
        },
        {
            band: t('common.concrete'), title: t('common.structuralConcreteCuM'), color: GROUP_COLORS.concrete, total: <TotalValue value={tot.concrete} />,
            columns: [{ kind: 'calc', key: 'concrete', title: t('common.structuralConcreteCuM'), get: r => calc(r).concrete }],
        },
    ];

    const summary = (
        <SheetCard title={t('pedestal.sentToTheStructuralMaterial')}>
            {REBAR_SIZES.map(s => (
                <CalcField key={s} label={t('pedestal.reinforcementSBoq66', { s })} value={outputs[`rebar.${s}`]} unit={t('common.kg')} digits={4} />
            ))}
            <CalcField label={t('pedestal.formworkBoq71')} value={outputs.formwork} unit={t('common.sqM')} digits={4} />
            <CalcField label={t('pedestal.structuralConcreteBoq72')} value={outputs.concrete} unit={t('common.cuM')} digits={4} />
            <CalcField label={t('pedestal.footingBackfillBoq81')} value={outputs.backfill} unit={t('common.cuM')} digits={4} strong />
        </SheetCard>
    );

    if (inJourney) {
        return (
            <CalculatorShell def={pedestal} result={result} isDefault={isDefault} onReset={reset}>
                <PedestalJourney rows={input.rows} onChange={rows => update({ rows })} footings={footingRows}
                    footingSkipped={project.journey?.footing === 'skipped'} footingOutputs={fo} backfill={outputs.backfill} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={pedestal} result={result} isDefault={isDefault} onReset={reset} aside={summary}>
            <SheetCard title={t('pedestal.pedestalQuantitySummary')}>
                <StructureTable<PedestalRow>
                    rows={input.rows}
                    groups={groups}
                    onChange={rows => update({ rows })}
                    // D13: a new pedestal sits on the footing row with the same number (row 1 if there is none).
                    newRow={i => emptyPedestalRow(i < footingRows.length ? i : 0)}
                    addLabel={t('pedestal.addPedestal')}
                />
                <ul className="mt-3 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>
                        {t('pedestal.standingOnFootingTheRow')}<Link className="text-blue-600 underline" href="/calc/footing">{t('pedestal.footingProgram')}</Link> {t('pedestal.thatThisPedestalStandsOn')}
                    </li>
                    <li>{t('pedestal.mainReinforcementLengthPerBar')}</li>
                    <li>
                        {t('pedestal.numberOfStirrupsRoundUp')}
                    </li>
                    <li>{t('pedestal.formworkNumber2WidthLength')}</li>
                    <li>{t('pedestal.thePedestalConcreteIsDeducted')}</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
