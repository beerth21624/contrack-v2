'use client';

// Journey-mode body of the slab-on-grade level: one card per panel read off the slab plan, the sub-base
// (backfill depth, sand bed) folded away, and a short result at the end. Same input and formulas as /calc.
import {
    newSlabRow, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabOnGradeInput, type SlabRow,
} from '@/domain/calculators/slab-on-grade';
import { EditableTable } from '@/components/sheet/EditableTable';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, FillProgress, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    blankIfZero, countFill, insertAfter, isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const nameOptions = SLAB_NAMES.map(v => ({ value: v as string, label: v }));
const layerOptionsOf = (t: CalcT) => SLAB_LAYERS.map(v => ({ value: v as number, label: t('common.layers', { v: String(v) }) }));
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const labelsOf = (t: CalcT) => ({ width: t('common.width2'), length: t('common.length'), thickness: t('common.thickness'), bars: t('common.reinforcement') }) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: SlabRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.thickness, ok: isPositive(r.thickness) },
    { label: L.bars, ok: r.barSize !== '' && isPositive(r.spacing) && isPositive(r.layers) },
// Thickness and bars are copied from the previous panel: the panel's own size marks it as started.
], isPositive(r.width) || isPositive(r.length));

export function SlabOnGradeJourney({ input, outputs, onChange }: {
    input: SlabOnGradeInput; outputs: Record<string, number>; onChange: (slabs: SlabRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const rows = input.slabs;
    const set = (i: number, patch: Partial<SlabRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newSlabRow(rows[rows.length - 1])]);
    /** A panel of the same size and spec (each panel is its own card). */
    const duplicate = (r: SlabRow, i: number) => onChange(insertAfter(rows, i, { ...r }));

    if (rows.length === 0) {
        return (
            <EmptyState text={t('slabOnGrade.noSlabYetCheckThe')}
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
                const c = slabRowCalc(r);
                const k = checks[i] ?? checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'slabs', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={t('common.panel', { v: String(i + 1) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.weight, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('common.deleteSlabPanel', { v: String(i + 1) })}>
                        <PlanGroup title={t('slabOnGrade.panelSizeFromTheSlab')}>
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
                            <BarField label={L.bars} sizes={SLAB_BAR_SIZES} size={r.barSize} onSize={v => set(i, { barSize: v })}
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

            <AdvancedSection title={t('slabOnGrade.backfillUnderTheSlabAnd')}>
                <EditableTable<SlabRow>
                    rows={rows}
                    onChange={onChange}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'panel', title: t('common.slab'), width: 120,
                            get: (r, i) => t('slabOnGrade.m', { v: String(i + 1), name: r.name, v2: formatNumber(r.width), v3: formatNumber(r.length) }) },
                        { kind: 'number', key: 'fillDepth', title: t('slabOnGrade.backfillUnderTheSlabDepth'), width: 110,
                            get: r => r.fillDepth, set: (r, v) => ({ ...r, fillDepth: v }) },
                        { kind: 'calc', key: 'backfill', title: t('slabOnGrade.backfillCuM'), width: 90, get: r => blankIfZero(slabRowCalc(r).backfill) },
                        { kind: 'number', key: 'sandThickness', title: t('slabOnGrade.coarseSandBeddingThicknessM'), width: 110,
                            get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                        { kind: 'calc', key: 'sand', title: t('slabOnGrade.sandCuM'), width: 90, get: r => blankIfZero(slabRowCalc(r).sand) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('slabOnGrade.concreteWidthLengthThickness')}</li>
                    <li>{t('common.reinforcementWidthLengthSpacing2')}</li>
                    <li>{t('slabOnGrade.backfillWidthLengthDepthCoarse')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('common.concrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                    rebarSummaryItem(outputs),
                ]}
                minor={[
                    { label: t('slabOnGrade.coarseSand'), value: outputs.sand ?? 0, unit: t('common.cuM') },
                    { label: t('slabOnGrade.backfill'), value: outputs.backfill ?? 0, unit: t('common.cuM') },
                    { label: t('slabOnGrade.moistureBarrier'), value: outputs.plastic ?? 0, unit: t('common.sqM') },
                ]}
            />
        </div>
    );
}
