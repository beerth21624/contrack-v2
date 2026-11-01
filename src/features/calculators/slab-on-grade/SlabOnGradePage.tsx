'use client';

import type { ReactNode } from 'react';
import {
    slabOnGrade, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabRow,
} from '@/domain/calculators/slab-on-grade';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { SlabOnGradeJourney } from './SlabOnGradeJourney';
import { useTranslations } from 'next-intl';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

/** Column header with the sheet's group header (row 3/4) above the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <span className="flex flex-col leading-tight">
        <span className="text-[10px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);

const nameOptions = SLAB_NAMES.map(v => ({ value: v }));
const sizeOptions = SLAB_BAR_SIZES.map(v => ({ value: v }));
const layerOptions = SLAB_LAYERS.map(v => ({ value: String(v) }));

/** A new row keeps the previous row's thickness / fill / sand / bar settings, with no size yet. */
const newSlab = (prev: SlabRow | undefined): SlabRow => ({
    name: prev?.name ?? 'S1',
    width: 0,
    length: 0,
    thickness: prev?.thickness ?? 0.1,
    fillDepth: prev?.fillDepth ?? 0.4,
    sandThickness: prev?.sandThickness ?? 0.05,
    barSize: prev?.barSize ?? 'RB9',
    layers: prev?.layers ?? 2,
    spacing: prev?.spacing ?? 0.2,
});

export default function SlabOnGradePage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(slabOnGrade);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={slabOnGrade} result={result} isDefault={isDefault} onReset={reset}>
                <SlabOnGradeJourney input={input} outputs={outputs} onChange={slabs => update({ slabs })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={slabOnGrade} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('slabOnGrade.slabOnGradeQuantitySummary')}>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} colSpan={3}>{t('slabOnGrade.beddingMaterial')}</th>
                                <th className={th} colSpan={REBAR_SIZES.length}>{t('slabOnGrade.reinforcementMainReinforcementQuantityKg')}</th>
                                <th className={th}>{t('common.concrete')}</th>
                            </tr>
                            <tr>
                                <th className={th}>{t('slabOnGrade.backfillCuM2')}</th>
                                <th className={th}>{t('slabOnGrade.coarseSandCuM')}</th>
                                <th className={th}>{t('slabOnGrade.moistureBarrierSqM')}</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                                <th className={th}>{t('common.structuralConcreteCuM')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ background: SHEET_COLORS.calc }}>
                                <td className={td}>{formatNumber(outputs.backfill)}</td>
                                <td className={td}>{formatNumber(outputs.sand)}</td>
                                <td className={td}>{formatNumber(outputs.plastic)}</td>
                                {REBAR_SIZES.map(s => <td key={s} className={td}>{formatNumber(outputs[`rebar.${s}`])}</td>)}
                                <td className={td}>{formatNumber(outputs.concrete)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title={t('slabOnGrade.slabOnGradeData')}>
                <EditableTable<SlabRow>
                    rows={input.slabs}
                    onChange={slabs => update({ slabs })}
                    newRow={i => newSlab(input.slabs[i - 1])}
                    addLabel={t('slabOnGrade.addSlab')}
                    columns={[
                        { kind: 'select', key: 'name', title: t('common.slabName'), width: 70, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'thickness', title: t('common.thicknessM'), width: 70, get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'number', key: 'fillDepth', title: head(t('slabOnGrade.backfill'), t('slabOnGrade.fillDepthM')), width: 70,
                            get: r => r.fillDepth, set: (r, v) => ({ ...r, fillDepth: v }) },
                        { kind: 'calc', key: 'backfill', title: head(t('slabOnGrade.backfill'), t('common.quantityCuM')), width: 80, get: r => slabRowCalc(r).backfill },
                        { kind: 'number', key: 'sandThickness', title: head(t('slabOnGrade.coarseSand'), t('common.thicknessM')), width: 70,
                            get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                        { kind: 'calc', key: 'sand', title: head(t('slabOnGrade.coarseSand'), t('common.quantityCuM')), width: 80, get: r => slabRowCalc(r).sand },
                        { kind: 'calc', key: 'plastic', title: head(t('slabOnGrade.moistureBarrier2'), t('common.quantitySqM')), width: 80, get: r => slabRowCalc(r).plastic },
                        { kind: 'select', key: 'barSize', title: head(t('common.reinforcement'), t('common.size')), width: 80, options: sizeOptions,
                            get: r => r.barSize, set: (r, v) => ({ ...r, barSize: v }) },
                        { kind: 'select', key: 'layers', title: head(t('common.reinforcement'), t('common.barLayers2')), width: 70, options: layerOptions,
                            get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                        { kind: 'number', key: 'spacing', title: head(t('common.reinforcement'), t('common.spacingM')), width: 70,
                            get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                        { kind: 'calc', key: 'barLength', title: head(t('common.reinforcement'), t('slabOnGrade.totalM')), width: 80, get: r => slabRowCalc(r).barLength },
                        { kind: 'calc', key: 'weight', title: head(t('common.reinforcement'), t('common.weightKg')), width: 80, get: r => slabRowCalc(r).weight },
                        { kind: 'calc', key: 'concrete', title: head(t('common.structuralConcrete'), t('slabOnGrade.cuM')), width: 80, get: r => slabRowCalc(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('slabOnGrade.backfillWidthLengthFillDepth')}</li>
                    <li>{t('slabOnGrade.coarseSandWidthLengthThickness')}</li>
                    <li>{t('slabOnGrade.moistureBarrierWidthLengthBOQ')}</li>
                    <li>{t('slabOnGrade.totalReinforcementMWidthLength')}</li>
                    <li>{t('slabOnGrade.structuralConcreteWidthLengthThickness')}</li>
                    <li>{t('slabOnGrade.drainPipesBOQ9Item')}</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
