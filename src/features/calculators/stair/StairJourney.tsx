'use client';

// Journey-mode body of the stair level: one card per stair, sizes read off the stair detail (total rise and run
// follow steps × riser / tread), then the bars of the waist slab and steps, the formulas folded away, and a short
// result at the end. Same input and formulas as /calc.
import {
    newStairRow, stairRow, withStepChange, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_NAMES, type StairInput, type StairRow,
} from '@/domain/calculators/stair';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, isPositive,
    nextFreeName, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const nameOptions = STAIR_NAMES.map(v => ({ value: v as string, label: v }));
const sizeOptions = STAIR_BAR_SIZES.map(s => ({ value: s as string, label: s }));
const labelOf = (t: CalcT, r: StairRow, i: number) => (r.name === '' ? t('stair.stair', { v: String(i + 1) }) : r.name);

const rowKg = (r: StairRow) => {
    const c = stairRow(r);
    return c.waistMain.kg + c.waistTemp.kg + c.stepMain.kg + c.stepTemp.kg;
};

const labelsOf = (t: CalcT) => ({
    steps: t('stair.numberOfSteps'), riser: t('stair.riserHeight'), tread: t('stair.treadWidth'), width: t('stair.stairWidth'), waist: t('stair.waistSlabThickness'),
    rise: t('stair.totalRise'), run: t('stair.horizontalRun'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: StairRow) => planChecks([
    { label: L.steps, ok: isPositive(r.steps) },
    { label: L.riser, ok: isPositive(r.riser) },
    { label: L.tread, ok: isPositive(r.tread) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.waist, ok: isPositive(r.waist) },
    { label: L.rise, ok: isPositive(r.rise) },
    { label: L.run, ok: isPositive(r.run) },
// The bars come pre-set (RB9 @0.15): the sizes of the stair mark it as started.
], [r.steps, r.riser, r.tread, r.width, r.waist, r.rise, r.run].some(isPositive));

export function StairJourney({ input, outputs, onChange }: {
    input: StairInput; outputs: Record<string, number>; onChange: (rows: StairRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const rows = input.rows;
    const replace = (i: number, row: StairRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
    const set = (i: number, patch: Partial<StairRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, { ...newStairRow(rows[rows.length - 1]), name: nextFreeName(STAIR_NAMES, rows.map(r => r.name)) }]);

    if (rows.length === 0) {
        return (
            <EmptyState text={t('stair.noStairsYetCheckThe')}
                addLabel={t('stair.addTheFirstStair')} onAdd={add} />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = stairRow(r);
                const k = checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={labelOf(t, r, i)}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: rowKg(r), unit: t('common.kg'), digits: 1 },
                        ])}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('stair.delete', { v: labelOf(t, r, i) })}>
                        <PlanGroup title={t('stair.stepsFromTheStairDetail')}>
                            <PlanField label={t('stair.stairName')} className="col-span-2 sm:col-span-3 lg:col-span-4">
                                <ChoiceButtons<string> size="small" ariaLabel={t('stair.stairName')} value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.steps} fieldKey="steps" value={r.steps} unit={t('stair.steps')} digits={0}
                                onChange={v => replace(i, withStepChange(r, { steps: v }))} />
                            <PlanNumber label={L.riser} value={r.riser} unit={t('common.m')} range={[0.1, 0.3]}
                                onChange={v => replace(i, withStepChange(r, { riser: v }))} />
                            <PlanNumber label={L.tread} value={r.tread} unit={t('common.m')} range={[0.15, 0.5]}
                                onChange={v => replace(i, withStepChange(r, { tread: v }))} />
                        </PlanGroup>
                        <PlanGroup title={t('stair.stringer')} hint={t('stair.totalRiseAndHorizontalRun')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.5, 5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.waist} value={r.waist} unit={t('common.m')} range={[0.05, 0.4]} onChange={v => set(i, { waist: v })} />
                            <PlanNumber label={L.rise} value={r.rise} unit={t('common.m')} onChange={v => set(i, { rise: v })} />
                            <PlanNumber label={L.run} value={r.run} unit={t('common.m')} onChange={v => set(i, { run: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.reinforcement')} hint={t('stair.presetToRB9015')} layout="wide">
                            <BarField label={t('stair.waistSlabMainBars')} sizes={STAIR_BAR_SIZES} size={r.waistMainSize}
                                onSize={v => set(i, { waistMainSize: v })} amount={r.waistMainSpacing}
                                onAmount={v => set(i, { waistMainSpacing: v })} amountLabel={t('common.spacing')} amountUnit={t('common.m')} amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <BarField label={t('stair.waistSlabCrackControlBars')} sizes={STAIR_BAR_SIZES} size={r.waistTempSize}
                                onSize={v => set(i, { waistTempSize: v })} amount={r.waistTempSpacing}
                                onAmount={v => set(i, { waistTempSpacing: v })} amountLabel={t('common.spacing')} amountUnit={t('common.m')} amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <BarField label={t('stair.stepMainBars')} sizes={STAIR_BAR_SIZES} size={r.stepMainSize}
                                onSize={v => set(i, { stepMainSize: v })} amount={r.stepMainSpacing}
                                onAmount={v => set(i, { stepMainSpacing: v })} amountLabel={t('common.spacing')} amountUnit={t('common.m')} amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <PlanField label={t('stair.stepCrackControlBars')} hint={t('stair.n2BarsPerStep')}>
                                <ChoiceButtons<string> size="small" ariaLabel={t('stair.stepCrackControlBarsBar')}
                                    value={r.stepTempSize === '' ? undefined : r.stepTempSize} options={sizeOptions}
                                    onChange={v => set(i, { stepTempSize: v })} />
                            </PlanField>
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={t('stair.addAnotherStair')} onClick={add} />

            <AdvancedSection title={t('common.howItIsCalculated')} hint={t('common.calculatedAutomatically')}>
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('stair.slopedLengthHorizontalRunTotal')}</li>
                    <li>{t('stair.concreteWaistSlabThicknessSloped')}</li>
                    <li>{t('stair.formworkSoffitWaistSlabSides')}</li>
                    <li>{t('stair.waistSlabMainBarsRound')}{STAIR_ANCHORAGE}{t('stair.mEmbedment')}</li>
                    <li>{t('stair.waistSlabCrackControlBars2')}</li>
                    <li>{t('stair.stepMainBarsRoundUp')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('common.concrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                { label: t('common.formwork'), value: outputs.formwork ?? 0, unit: t('common.sqM') },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
