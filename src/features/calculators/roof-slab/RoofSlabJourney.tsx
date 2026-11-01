'use client';

// Journey-mode body of the roof-slab level: one card per panel read off the roof-slab plan, the formulas folded
// away, and a short result at the end. Same input and formulas as /calc.
import {
    newRoofSlabRow, roofSlabRow, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabInput, type RoofSlabRow,
} from '@/domain/calculators/roof-slab';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, FillProgress, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    countFill, insertAfter, isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const nameOptions = ROOF_SLAB_NAMES.map(v => ({ value: v as string, label: v }));
const layerOptionsOf = (t: CalcT) => ROOF_SLAB_LAYERS.map(v => ({ value: v as number, label: t('common.layers', { v: String(v) }) }));
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const labelsOf = (t: CalcT) => ({ width: t('common.width2'), length: t('common.length'), thickness: t('common.thickness'), bars: t('common.reinforcement') }) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: RoofSlabRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.thickness, ok: isPositive(r.thickness) },
    { label: L.bars, ok: r.size !== '' && isPositive(r.spacing) && isPositive(r.layers) },
// Thickness and bars are copied from the previous panel: the panel's own size marks it as started.
], isPositive(r.width) || isPositive(r.length));

export function RoofSlabJourney({ input, outputs, onChange }: {
    input: RoofSlabInput; outputs: Record<string, number>; onChange: (rows: RoofSlabRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const rows = input.rows;
    const set = (i: number, patch: Partial<RoofSlabRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newRoofSlabRow(rows[rows.length - 1])]);
    /** A panel of the same size and spec (each panel is its own card). */
    const duplicate = (r: RoofSlabRow, i: number) => onChange(insertAfter(rows, i, { ...r }));

    if (rows.length === 0) {
        return (
            <EmptyState text={t('roofSlab.noRoofSlabYetCheck')}
                addLabel={t('common.addTheFirstSlabPanel')} onAdd={add} />
        );
    }

    const L = labelsOf(t);
    const layerOptions = layerOptionsOf(t);
    const checks = rows.map(r => checksOf(L, r));

    return (
        <div className="flex flex-col gap-3">
            {rows.length >= PROGRESS_FROM && (
                <FillProgress {...countFill(checks.map(c => c.state))} noun={t('common.panels')} doneText={t('common.allPanelsAreComplete')} />
            )}

            {rows.map((r, i) => {
                const c = roofSlabRow(r);
                const k = checks[i] ?? checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={t('common.panel', { v: String(i + 1) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.kg, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('common.deleteSlabPanel', { v: String(i + 1) })}>
                        <PlanGroup title={t('roofSlab.panelSizeFromTheRoof')}>
                            <PlanField label={t('common.slabName')}>
                                <ChoiceButtons<string> size="small" ariaLabel={t('common.slabName')} value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.thickness} fieldKey="thickness" value={r.thickness} unit={t('common.m')} presets={[0.1, 0.12, 0.15]} range={[0.05, 0.4]}
                                onChange={v => set(i, { thickness: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.reinforcement')} hint={t('common.eGRB9020')} layout="wide">
                            <BarField label={L.bars} sizes={ROOF_SLAB_BAR_SIZES} size={r.size} onSize={v => set(i, { size: v })}
                                amount={r.spacing} onAmount={v => set(i, { spacing: v })} amountLabel={t('common.spacing')} amountUnit={t('common.m')}
                                amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <PlanField label={t('common.barLayers')}>
                                <ChoiceButtons<number> size="small" ariaLabel={t('common.barLayers')} value={r.layers} options={layerOptions}
                                    onChange={v => set(i, { layers: v })} />
                            </PlanField>
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={t('common.addAnotherSlabPanel')} onClick={add} />

            <AdvancedSection title={t('common.howItIsCalculated')} hint={t('common.calculatedAutomatically')}>
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('roofSlab.concreteWidthLengthThicknessSoffit')}</li>
                    <li>{t('common.reinforcementWidthLengthSpacing2')}</li>
                    <li>{t('roofSlab.reinforcementIsCountedBySize')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('common.concrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                { label: t('common.formwork'), value: outputs.formwork ?? 0, unit: t('common.sqM') },
                { label: t('roofSlab.props'), value: outputs.props ?? 0, unit: t('common.pcs'), digits: 0 },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
