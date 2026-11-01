'use client';

import type { ReactNode } from 'react';
import {
    roofSlab, roofSlabRow, roofSlabTotals, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabRow,
} from '@/domain/calculators/roof-slab';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '@/components/sheet/RebarSummary';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { RoofSlabJourney } from './RoofSlabJourney';
import { useTranslations } from 'next-intl';

const sizeOptions = ROOF_SLAB_BAR_SIZES.map(value => ({ value }));
const nameOptions = ROOF_SLAB_NAMES.map(value => ({ value }));
const layerOptions = ROOF_SLAB_LAYERS.map(n => ({ value: String(n) }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

export default function RoofSlabPage() {
    const t = useTranslations('calculators');
    const REBAR = t('common.mainReinforcement');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofSlab);
    const inJourney = useJourneyMode();
    if (inJourney) {
        return (
            <CalculatorShell def={roofSlab} result={result} isDefault={isDefault} onReset={reset}>
                <RoofSlabJourney input={input} outputs={outputs} onChange={next => update({ rows: next })} />
            </CalculatorShell>
        );
    }
    const rows = input.rows.map(roofSlabRow);
    const totals = roofSlabTotals(input);
    const res = (i: number) => rows[i];

    return (
        <CalculatorShell def={roofSlab} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('roofSlab.roofSlabQuantitySummary')}>
                <RebarSummary groups={[{ label: t('common.mainReinforcementQuantityKg'), kg: totals.rebar }]} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label={t('common.propsPcs')} value={outputs.props} unit={t('common.pcs')} digits={0} strong />
                    <CalcField label={t('common.formworkSqM')} value={outputs.formwork} unit={t('common.sqM')} strong />
                    <CalcField label={t('common.structuralConcreteCuM')} value={outputs.concrete} unit={t('common.cuM')} digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title={t('roofSlab.roofSlabTable')}>
                <EditableTable<RoofSlabRow>
                    rows={input.rows}
                    onChange={next => update({ rows: next })}
                    newRow={() => ({ name: '', width: 0, length: 0, thickness: 0, size: '', layers: 2, spacing: 0 })}
                    addLabel={t('roofSlab.addSlab')}
                    columns={[
                        { kind: 'select', key: 'name', title: t('common.slabName'), width: 80, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'thickness', title: t('common.thicknessM'), width: 70,
                            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'select', key: 'size', title: head(REBAR, t('common.size')), width: 90, options: sizeOptions,
                            get: r => r.size, set: (r, v) => ({ ...r, size: v }) },
                        { kind: 'select', key: 'layers', title: head(REBAR, t('common.barLayers2')), width: 70, options: layerOptions,
                            get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                        { kind: 'number', key: 'spacing', title: head(REBAR, t('common.spacingM')), width: 70,
                            get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                        { kind: 'calc', key: 'barLength', title: head(REBAR, t('roofSlab.totalLengthM')), width: 90, get: (_, i) => res(i)?.barLength ?? null },
                        { kind: 'calc', key: 'kg', title: head(REBAR, t('common.weightKg')), width: 90, get: (_, i) => res(i)?.kg ?? null },
                        { kind: 'calc', key: 'props', title: head(t('common.formwork'), t('common.propsPcs')), width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
                        { kind: 'calc', key: 'formwork', title: head(t('common.formwork'), t('common.formworkSqM')), width: 80, get: (_, i) => res(i)?.formwork ?? null },
                        { kind: 'calc', key: 'concrete', title: head(t('common.concrete'), t('common.structuralConcreteCuM')), width: 90, digits: 3,
                            get: (_, i) => res(i)?.concrete ?? null },
                    ]}
                />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>{t('roofSlab.totalLengthWidthLengthSpacing')}</p>
                    <p>{t('roofSlab.propsRoundUpArea0')}</p>
                    <p>{t('roofSlab.reinforcementIsSentToThe')}</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
