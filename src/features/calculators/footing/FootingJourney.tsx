'use client';

// Guided-journey view of the footing sheet: one card per footing type of the plan (F1, F2 …), filled from the
// foundation plan and the footing detail. Same input and calculation as the Excel-mirror table.
import {
    footingRow, footingTotals, newFootingRow, totalKg, EXCAVATION_MARGIN, FOOTING_BAR_SIZES, SAND_FACTOR, type FootingRow,
} from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, EmptyState, JGroup, JText, PlanCard, PlanGroup, PlanNumber, ResultSummary, isPositive,
    nextCopyName, planChecks, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const label = (t: CalcT, r: FootingRow, i: number) => (r.name.trim() === '' ? t('common.typeV', { v: i + 1 }) : r.name.trim());

const labelsOf = (t: CalcT) => ({
    count: t('footing.numberOfFootingsOfThis'), width: t('common.width2'), length: t('common.length'), depth: t('footing.footingThickness'), pit: t('footing.excavationDepth'),
    short: t('footing.shortDirectionBars'), long: t('footing.longDirectionBars'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

/** The plan values a footing type needs (bar sizes come pre-chosen, so they do not mark the card as started). */
const checksOf = (L: Labels, r: FootingRow) => planChecks([
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.pit, ok: isPositive(r.excavationDepth) },
    { label: L.short, ok: isPositive(r.shortBarCount) && r.shortBarSize !== '' },
    { label: L.long, ok: isPositive(r.longBarCount) && r.longBarSize !== '' },
], [r.count, r.width, r.length, r.depth, r.excavationDepth, r.shortBarCount, r.longBarCount, r.ringBarCount].some(isPositive));

/** A pit shallower than the footing and its bed digs a negative volume: ask to check the depth. */
function depthWarning(t: CalcT, r: FootingRow): string | undefined {
    const c = footingRow(r);
    if (c.concrete <= 0 || !(r.excavationDepth > 0) || c.backfillGross >= 0) return undefined;
    return t('footing.theExcavationIsShallowerThan');
}

export function FootingJourney({ rows, onChange, backfillTotal }: {
    rows: FootingRow[];
    onChange: (rows: FootingRow[]) => void;
    /** Backfill after the pedestals (once the pedestal level is filled). */
    backfillTotal: number;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const tot = footingTotals(rows);
    const set = (i: number, patch: Partial<FootingRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newFootingRow(rows)]);
    // Copies go to the end of the list: pedestals point at footing rows by position.
    const duplicate = (r: FootingRow) => onChange([...rows, { ...r, name: nextCopyName(r.name, rows.map(x => x.name)), count: 0 }]);

    if (rows.length === 0) {
        return (
            <EmptyState
                text={<>{t('footing.noFootingsYetOpenThe')}</>}
                addLabel={t('footing.addFootingF1')} onAdd={add} />
        );
    }

    const nextName = newFootingRow(rows).name;

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = footingRow(r);
                const k = checksOf(L, r);
                const warning = depthWarning(t, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={t('footing.footingV', { v: label(t, r, i) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.shortKg + c.longKg + c.ringKg, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('footing.deleteFootingV', { v: label(t, r, i) })}>
                        <PlanGroup title={t('footing.fromTheFootingPlan')}>
                            <JText label={t('footing.footingName')} value={r.name} placeholder={t('footing.eGF1')} onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.count} fieldKey="count" value={r.count} unit={t('footing.footings')} digits={0} onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('footing.footingSizeFromTheFooting')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.3, 5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} range={[0.3, 5]} onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit={t('common.m')} range={[0.15, 2]} onChange={v => set(i, { depth: v })} />
                            <PlanNumber label={L.pit} fieldKey="excavationDepth" value={r.excavationDepth} unit={t('common.m')} range={[0.3, 5]}
                                hint={t('footing.groundLevelToTheBottom')} onChange={v => set(i, { excavationDepth: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('footing.reinforcementPerFooting')} hint={t('footing.eG5Db12Db12')} layout="wide">
                            <BarField label={L.short} sizes={FOOTING_BAR_SIZES} size={r.shortBarSize} onSize={v => set(i, { shortBarSize: v })}
                                amount={r.shortBarCount} onAmount={v => set(i, { shortBarCount: v })} />
                            <BarField label={L.long} sizes={FOOTING_BAR_SIZES} size={r.longBarSize} onSize={v => set(i, { longBarSize: v })}
                                amount={r.longBarCount} onAmount={v => set(i, { longBarCount: v })} />
                            <BarField label={t('footing.ringBars')} sizes={FOOTING_BAR_SIZES} size={r.ringBarSize} onSize={v => set(i, { ringBarSize: v })}
                                amount={r.ringBarCount} onAmount={v => set(i, { ringBarCount: v })} amountUnit={t('footing.rings')} />
                        </PlanGroup>
                        {warning !== undefined && <div className="mt-3 text-[12px] text-orange-600">{warning}</div>}
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? t('footing.addTheNextFootingType') : t('footing.addFootingNextname', { nextName })} onClick={add} />

            <AdvancedSection title={t('common.defaultValues')}>
                <div className="flex flex-col gap-3">
                    {rows.map((r, i) => (
                        <JGroup key={i} title={t('footing.layersUnderThePitBottom', { v: label(t, r, i) })}>
                            <PlanNumber label={t('footing.coarseSandThickness')} value={r.sandThickness} unit={t('common.m')} presets={[0.05]}
                                onChange={v => set(i, { sandThickness: v })} />
                            <PlanNumber label={t('footing.leanConcreteThickness')} value={r.leanThickness} unit={t('common.m')} presets={[0.05]}
                                onChange={v => set(i, { leanThickness: v })} />
                        </JGroup>
                    ))}
                    <ul className="text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                        <li>{t('footing.excavationWorkingSpaceAroundThe')}{EXCAVATION_MARGIN.toFixed(2)} {t('common.m')}</li>
                        <li>{t('footing.coarseSandSettlementAllowance')}{Math.round((SAND_FACTOR - 1) * 100)}%</li>
                        <li>{t('footing.shortLongBarsAreAs')}</li>
                    </ul>
                </div>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('footing.footingConcrete'), value: tot.concrete, unit: t('common.cuM') },
                { label: t('common.reinforcement'), value: totalKg(tot.rebar), unit: t('common.kg') },
                { label: t('common.formwork'), value: tot.formwork, unit: t('common.sqM') },
                { label: t('footing.excavatedSoil'), value: tot.excavation, unit: t('common.cuM') },
                { label: t('footing.coarseSand'), value: tot.sand, unit: t('common.cuM') },
                { label: t('common.leanConcrete'), value: tot.lean, unit: t('common.cuM') },
            ]} note={backfillTotal > 0
                ? t('footing.backfillVCuMThe', { v: formatNumber(backfillTotal) })
                : undefined} />
        </div>
    );
}
