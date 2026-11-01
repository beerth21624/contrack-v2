'use client';

// Journey-mode body of the precast-slab level: one short card per span read off the slab plan, the shear-key
// bar and topping (standard values) folded away, and a short result at the end. Same input and formulas as /calc.
import {
    newPrecastPanel, precastPanel, PS_BAR_SIZES, type PrecastPanelRow, type PrecastSlabInput,
} from '@/domain/calculators/precast-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, EmptyState, FillProgress, PlanCard, PlanNumber, ResultSummary, countFill, insertAfter, isPositive, planChecks,
    removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeOptions = PS_BAR_SIZES.map(v => ({ value: v }));
const labelsOf = (t: CalcT) => ({ width: t('precastSlab.spanWidth'), length: t('precastSlab.spanLength') }) as const;
type Labels = ReturnType<typeof labelsOf>;
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const checksOf = (L: Labels, r: PrecastPanelRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
]);

export function PrecastSlabJourney({ input, outputs, onChange }: {
    input: PrecastSlabInput; outputs: Record<string, number>; onChange: (panels: PrecastPanelRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const rows = input.panels;
    const set = (i: number, patch: Partial<PrecastPanelRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newPrecastPanel(rows[rows.length - 1])]);
    /** A span of the same size (rooms of one size are common). */
    const duplicate = (r: PrecastPanelRow, i: number) => onChange(insertAfter(rows, i, { ...r }));
    const shearKey = REBAR_SIZES.reduce((s, size) => s + (outputs[`rebar.${size}`] ?? 0), 0);

    if (rows.length === 0) {
        return (
            <EmptyState text={t('precastSlab.noPrecastSlabsYetCheck')}
                addLabel={t('precastSlab.addTheFirstSpan')} onAdd={add} />
        );
    }

    const checks = rows.map(r => checksOf(L, r));

    return (
        <div className="flex flex-col gap-3">
            {rows.length >= PROGRESS_FROM && (
                <FillProgress {...countFill(checks.map(c => c.state))} noun={t('precastSlab.spans')} doneText={t('precastSlab.allSpansComplete')} />
            )}

            {rows.map((r, i) => {
                const c = precastPanel(r);
                const k = checks[i] ?? checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'panels', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={t('precastSlab.spanV', { v: String(i + 1) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('precastSlab.area'), value: c.area, unit: t('common.sqM') },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('precastSlab.deleteSpanV', { v: i + 1 })}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} onChange={v => set(i, { length: v })} />
                        </div>
                    </PlanCard>
                );
            })}

            <AddButton label={t('precastSlab.addTheNextSpan')} onClick={add} />

            <AdvancedSection title={t('precastSlab.slabEndLockBarsAnd')}>
                <EditableTable<PrecastPanelRow>
                    rows={rows}
                    onChange={onChange}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'panel', title: t('precastSlab.spans'), width: 100,
                            get: (r, i) => t('precastSlab.vV2V3M', { v: String(i + 1), v2: formatNumber(r.width), v3: formatNumber(r.length) }) },
                        { kind: 'select', key: 'keySize', title: t('precastSlab.slabEndLockBars'), width: 90, options: sizeOptions,
                            get: r => r.keySize, set: (r, v) => ({ ...r, keySize: v }) },
                        { kind: 'number', key: 'keySpacing', title: t('common.spacingM'), width: 80,
                            get: r => r.keySpacing, set: (r, v) => ({ ...r, keySpacing: v }) },
                        { kind: 'number', key: 'keyBarLength', title: t('precastSlab.lengthPerBarM'), width: 80,
                            get: r => r.keyBarLength, set: (r, v) => ({ ...r, keyBarLength: v }) },
                        { kind: 'number', key: 'topping', title: t('precastSlab.toppingConcreteThicknessM'), width: 100,
                            get: r => r.topping, set: (r, v) => ({ ...r, topping: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('precastSlab.precastSlabAndWireMesh')}</li>
                    <li>{t('precastSlab.slabEndLockBarsNumber')}</li>
                    <li>{t('precastSlab.toppingConcreteAreaThicknessEdge')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: t('precastSlab.precastSlab'), value: outputs.area ?? 0, unit: t('common.sqM') },
                    { label: t('precastSlab.toppingConcrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                ]}
                minor={[
                    { label: t('precastSlab.wireMesh'), value: outputs.wiremesh ?? 0, unit: t('common.sqM') },
                    { label: t('common.formwork'), value: outputs.formwork ?? 0, unit: t('common.sqM') },
                    { label: t('precastSlab.slabEndLockBars'), value: shearKey, unit: t('common.kg'), digits: 1 },
                ]}
            />
        </div>
    );
}
