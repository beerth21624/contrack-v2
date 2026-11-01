'use client';

import type { ReactNode } from 'react';
import {
    roofBeam, roofBeamRow, roofBeamTotals, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamRow,
} from '@/domain/calculators/roof-beam';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '@/components/sheet/RebarSummary';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { RoofBeamJourney } from './RoofBeamJourney';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeOptions = ROOF_BEAM_BAR_SIZES.map(value => ({ value }));
const nameOptions = ROOF_BEAM_NAMES.map(value => ({ value }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

const main = (t: CalcT) => t('common.mainReinforcement');
const stirrup = (t: CalcT) => t('common.stirrups');

export default function RoofBeamPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofBeam);
    const inJourney = useJourneyMode();
    if (inJourney) {
        return (
            <CalculatorShell def={roofBeam} result={result} isDefault={isDefault} onReset={reset}>
                <RoofBeamJourney input={input} outputs={outputs} onChange={next => update({ rows: next })} />
            </CalculatorShell>
        );
    }
    const rows = input.rows.map(roofBeamRow);
    const totals = roofBeamTotals(input);
    const res = (i: number) => rows[i];

    return (
        <CalculatorShell def={roofBeam} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('roofBeam.roofBeamQuantitySummary')}>
                <RebarSummary groups={[
                    { label: t('common.mainReinforcementQuantityKg'), kg: totals.main },
                    { label: t('common.stirrupQuantityKg'), kg: totals.stirrup },
                ]} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label={t('roofBeam.propsPcs')} value={outputs.props} unit={t('common.pcs')} digits={0} strong />
                    <CalcField label={t('common.formworkSqM')} value={outputs.formwork} unit={t('common.sqM')} strong />
                    <CalcField label={t('common.structuralConcreteCuM')} value={outputs.concrete} unit={t('common.cuM')} digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title={t('roofBeam.roofBeamTable')}>
                <EditableTable<RoofBeamRow>
                    rows={input.rows}
                    onChange={next => update({ rows: next })}
                    newRow={() => ({
                        name: '', width: 0, depth: 0, length: 0, mainSize: '', mainCount: 0, stirrupSize: '', stirrupSpacing: 0,
                    })}
                    addLabel={t('common.addBeam')}
                    columns={[
                        { kind: 'select', key: 'name', title: t('common.beamName'), width: 80, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: t('common.widthM'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: t('common.depthM'), width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'length', title: t('common.lengthM2'), width: 80, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'select', key: 'mainSize', title: head(main(t), t('common.size')), width: 90, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head(main(t), t('common.numberBars')), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainLength', title: head(main(t), t('common.totalLengthM')), width: 90, get: (_, i) => res(i)?.mainLength ?? null },
                        { kind: 'calc', key: 'mainKg', title: head(main(t), t('common.weightKg')), width: 90, get: (_, i) => res(i)?.mainKg ?? null },
                        { kind: 'select', key: 'stirrupSize', title: head(stirrup(t), t('common.size')), width: 90, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head(stirrup(t), t('roofBeam.spacingM')), width: 80,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head(stirrup(t), t('common.numberStirrups')), width: 70, digits: 0,
                            get: (_, i) => res(i)?.stirrupCount ?? null },
                        { kind: 'calc', key: 'stirrupPerimeter', title: head(stirrup(t), t('common.lengthBarM')), width: 80,
                            get: (_, i) => res(i)?.stirrupPerimeter ?? null },
                        { kind: 'calc', key: 'stirrupLength', title: head(stirrup(t), t('common.totalLengthM')), width: 90,
                            get: (_, i) => res(i)?.stirrupLength ?? null },
                        { kind: 'calc', key: 'stirrupKg', title: head(stirrup(t), t('common.weightKg')), width: 90, get: (_, i) => res(i)?.stirrupKg ?? null },
                        { kind: 'calc', key: 'props', title: head(t('common.formwork'), t('roofBeam.propsPcs')), width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
                        { kind: 'calc', key: 'formwork', title: head(t('common.formwork'), t('common.formworkSqM')), width: 80, get: (_, i) => res(i)?.formwork ?? null },
                        { kind: 'calc', key: 'concrete', title: head(t('common.concrete'), t('common.structuralConcreteCuM')), width: 90, digits: 3,
                            get: (_, i) => res(i)?.concrete ?? null },
                    ]}
                />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>{t('roofBeam.numberOfStirrupsRoundUp')}</p>
                    <p>
                        {t('roofBeam.formwork2DepthLengthWidth')}
                    </p>
                    <p>{t('roofBeam.reinforcementIsSentToThe')}</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
