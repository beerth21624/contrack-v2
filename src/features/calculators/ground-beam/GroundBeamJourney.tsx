'use client';

// Guided-journey view of the ground-beam sheet: one card per beam type of the ground-beam plan (one row of the
// sheet = every span of that type, lengths added up). Same input and calculation as the Excel-mirror table.
import {
    groundBeamRebar, groundBeamRow, groundBeamTotals, newGroundBeamRow, BEAM_BAR_SIZES, type GroundBeamRow,
} from '@/domain/calculators/ground-beam';
import { totalKg } from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, EmptyState, JGroup, JText, PlanCard, PlanGroup, PlanNumber, ResultSummary, insertAfter, isPositive,
    planChecks, removeAt, resultText,
} from '@/components/sheet/journey';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const label = (t: CalcT, r: GroundBeamRow, i: number) => (r.name.trim() === '' ? t('common.typeV', { v: i + 1 }) : r.name.trim());

const labelsOf = (t: CalcT) => ({
    length: t('groundBeam.totalLengthOfAllSpans'), width: t('common.width2'), depth: t('common.depth'), main: t('groundBeam.mainReinforcementTopBottom'), stirrup: t('common.stirrups'),
}) as const;
type Labels = ReturnType<typeof labelsOf>;

const checksOf = (L: Labels, r: GroundBeamRow) => planChecks([
    { label: L.length, ok: isPositive(r.length) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The stirrups come pre-set (RB6 @0.15): only a typed size, length or bar count marks the beam as started.
], [r.length, r.width, r.depth, r.mainCount].some(isPositive));

export function GroundBeamJourney({ beams, onChange }: { beams: GroundBeamRow[]; onChange: (beams: GroundBeamRow[]) => void }) {
    const t = useTranslations('calculators');
    const L = labelsOf(t);
    const set = (i: number, patch: Partial<GroundBeamRow>) => onChange(beams.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...beams, newGroundBeamRow(beams)]);
    /** Same section and bars, next free name, the length to fill. */
    const duplicate = (r: GroundBeamRow, i: number) => onChange(insertAfter(beams, i, { ...r, name: newGroundBeamRow(beams).name, length: 0 }));

    if (beams.length === 0) {
        return (
            <EmptyState
                text={<>{t('groundBeam.noGroundBeamsYetOpen')}</>}
                addLabel={t('groundBeam.addTheFirstGroundBeam')} onAdd={add} />
        );
    }

    const tot = groundBeamTotals({ beams });
    const nextName = newGroundBeamRow(beams).name;

    return (
        <div className="flex flex-col gap-4">
            {beams.map((r, i) => {
                const c = groundBeamRow(r);
                const k = checksOf(L, r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'beams', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={t('groundBeam.groundBeamV', { v: label(t, r, i) })}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: t('common.concrete'), value: c.concrete, unit: t('common.cuM') },
                            { label: t('common.steel'), value: c.mainWeight + c.stirrupWeight, unit: t('common.kg'), digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(beams, i))} deleteTitle={t('groundBeam.deleteBeamV', { v: label(t, r, i) })}>
                        <PlanGroup title={t('groundBeam.fromTheGroundBeamPlan')}>
                            <JText label={t('common.beamName')} value={r.name} placeholder={t('groundBeam.eGB1')} onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit={t('common.m')} placeholder={t('groundBeam.eG435')}
                                hint={t('groundBeam.addUpAllSpansOf')} onChange={v => set(i, { length: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('common.beamSizeFromTheBeam')}>
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit={t('common.m')} range={[0.1, 1]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit={t('common.m')} range={[0.15, 1.5]} onChange={v => set(i, { depth: v })} />
                        </PlanGroup>
                        <PlanGroup title={t('groundBeam.reinforcementFromTheBeamSection')} hint={t('groundBeam.eGTop2Db12')} layout="wide">
                            <BarField label={L.main} sizes={BEAM_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={BEAM_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel={t('common.spacing')}
                                amountUnit={t('common.m')} amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? t('groundBeam.addTheNextGroundBeam') : t('groundBeam.addGroundBeamNextname', { nextName })} onClick={add} />

            <AdvancedSection title={t('common.defaultValues')}>
                <div className="flex flex-col gap-3">
                    <JGroup title={t('groundBeam.leanConcreteUnderTheBeam')}>
                        {beams.map((r, i) => (
                            <PlanNumber key={i} label={t('groundBeam.beamV', { v: label(t, r, i) })} value={r.leanThickness} unit={t('common.m')} presets={[0.05]}
                                onChange={v => set(i, { leanThickness: v })} />
                        ))}
                    </JGroup>
                    <ul className="text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                        <li>{t('groundBeam.mainReinforcementIsCountedOver')}</li>
                        <li>{t('groundBeam.numberOfStirrupsBeamLength')}</li>
                    </ul>
                </div>
            </AdvancedSection>

            <ResultSummary items={[
                { label: t('groundBeam.beamConcrete'), value: tot.concrete, unit: t('common.cuM') },
                { label: t('common.reinforcement'), value: totalKg(groundBeamRebar({ beams })), unit: t('common.kg') },
                { label: t('common.formwork'), value: tot.formwork, unit: t('common.sqM') },
                { label: t('common.leanConcrete'), value: tot.lean, unit: t('common.cuM') },
            ]} note={t('groundBeam.theBackfillOfThisSection')} />
        </div>
    );
}
