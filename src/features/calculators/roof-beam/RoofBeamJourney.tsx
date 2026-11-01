'use client';

// Journey-mode body of the roof-beam level: one card per beam (or per group of alike beams, lengths added up)
// read off the roof-beam plan, the formulas folded away, and a short result at the end. Same input and
// formulas as /calc.
import {
    newRoofBeamRow, roofBeamRow, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamInput, type RoofBeamRow,
} from '@/domain/calculators/roof-beam';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, insertAfter,
    isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const nameOptions = ROOF_BEAM_NAMES.map(v => ({ value: v as string, label: v }));
const label = (t: CalcT, r: RoofBeamRow, i: number) => (r.name === '' ? t('roofBeam.beamV', { v: i + 1 }) : t('roofBeam.beamName', { name: r.name }));

const labelsOf = (t: CalcT) => ({
    width: t('common.width2'), depth: t('common.depth'), length: t('roofBeam.totalLength'), main: t('roofBeam.coreBarsTopBottom'), stirrup: t('common.stirrups'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: RoofBeamRow) => planChecks([
    { label: L.length, ok: isPositive(r.length) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The stirrups come pre-set (RB6 @0.15): only a typed size, length or bar count marks the beam as started.
], [r.length, r.width, r.depth, r.mainCount].some(isPositive));

export function RoofBeamJourney({ input, outputs, onChange }: {
    input: RoofBeamInput; outputs: Record<string, number>; onChange: (rows: RoofBeamRow[]) => void;
}) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const rows = input.rows;
    const set = (i: number, patch: Partial<RoofBeamRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newRoofBeamRow(rows[rows.length - 1])]);
    /** Same section and bars as this beam; the length to fill. */
    const duplicate = (r: RoofBeamRow, i: number) => onChange(insertAfter(rows, i, newRoofBeamRow(r)));

    if (rows.length === 0) {
        return (
            <EmptyState text={t('roofBeam.noBeamsYetCheckThe')}
                addLabel={t('roofBeam.addTheFirstBeam')} onAdd={add} />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = roofBeamRow(r);
                const k = checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={label(t, r, i)}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.mainKg + c.stirrupKg, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={t('roofBeam.deleteV', { v: label(t, r, i) })}>
                        <PlanGroup title={t('roofBeam.fromTheRoofBeamPlan')}>
                            <PlanField label={t('common.beamName')} className="col-span-2">
                                <ChoiceButtons<string> size="small" ariaLabel={t('common.beamName')} value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} placeholder={t('roofBeam.eG445')}
                                hint={t('roofBeam.addAllSpansOfBeams')} onChange={v => set(i, { length: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.beamSizeFromTheBeam')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.1, 1]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit={t('common.m')} range={[0.15, 1.5]} onChange={v => set(i, { depth: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.reinforcement')} hint={t('roofBeam.eGTop3Db12')} layout="wide">
                            <BarField label={L.main} sizes={ROOF_BEAM_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={ROOF_BEAM_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel={t('common.spacing')}
                                amountUnit={t('common.m')} amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={t('roofBeam.addAnotherBeamSize')} onClick={add} />

            <AdvancedSection title={t('common.howItIsCalculated')} hint={t('common.calculatedAutomatically')}>
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>{t('roofBeam.concreteWidthDepthLengthFormwork')}</li>
                    <li>{t('roofBeam.propsRoundUpLength0')}</li>
                    <li>{t('roofBeam.coreBarsNumberOfBars')}</li>
                    <li>{t('roofBeam.reinforcementIsCountedBySize')}</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('common.concrete'), value: outputs.concrete ?? 0, unit: t('common.cuM') },
                { label: t('common.formwork'), value: outputs.formwork ?? 0, unit: t('common.sqM') },
                { label: t('roofBeam.props'), value: outputs.props ?? 0, unit: t('common.pcs'), digits: 0 },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
