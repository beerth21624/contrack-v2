'use client';

import type { ReactNode } from 'react';
import {
    stair, stairRow, stairTotals, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_GROUPS, STAIR_NAMES, type StairRow,
} from '@/domain/calculators/stair';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '@/components/sheet/RebarSummary';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { StairJourney } from './StairJourney';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeOptions = STAIR_BAR_SIZES.map(value => ({ value }));
const nameOptions = STAIR_NAMES.map(value => ({ value }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

/** Short group names for the column headers of the rebar table. */
const groupShortOf = (t: CalcT) => ({
    waistMain: t('stair.mainReinforcementStringer'),
    waistTemp: t('stair.crackControlBarsStringer'),
    stepMain: t('stair.mainReinforcementSteps'),
    stepTemp: t('stair.crackControlBarsSteps'),
}) as const;

const emptyRow = (): StairRow => ({
    name: '', width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0,
    waistMainSize: '', waistMainSpacing: 0, waistTempSize: '', waistTempSpacing: 0,
    stepMainSize: '', stepMainSpacing: 0, stepTempSize: '', stepTempSpacing: 0,
});

export default function StairPage() {
    const t = useTranslations('calculators');
    const { input, update, reset, outputs, result, isDefault } = useCalculator(stair);
    const inJourney = useJourneyMode();
    if (inJourney) {
        return (
            <CalculatorShell def={stair} result={result} isDefault={isDefault} onReset={reset}>
                <StairJourney input={input} outputs={outputs} onChange={next => update({ rows: next })} />
            </CalculatorShell>
        );
    }
    const rows = input.rows.map(stairRow);
    const totals = stairTotals(input);
    const res = (i: number) => rows[i];
    const onChange = (next: StairRow[]) => update({ rows: next });

    const W = t('stair.stringerSize');
    const S = t('stair.stepSize');
    const groupShort = groupShortOf(t);
    const sizeColumns: SheetColumn<StairRow>[] = [
        { kind: 'select', key: 'name', title: t('stair.stairName'), width: 130, options: nameOptions,
            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
        { kind: 'number', key: 'width', title: head(W, t('common.widthM')), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
        { kind: 'number', key: 'waist', title: head(W, t('common.thicknessM')), width: 70, get: r => r.waist, set: (r, v) => ({ ...r, waist: v }) },
        { kind: 'number', key: 'rise', title: head(W, t('common.heightM')), width: 70, get: r => r.rise, set: (r, v) => ({ ...r, rise: v }) },
        { kind: 'number', key: 'run', title: head(W, t('common.horizontalRunM')), width: 70, get: r => r.run, set: (r, v) => ({ ...r, run: v }) },
        { kind: 'calc', key: 'inclined', title: head(W, t('stair.slopedLengthM')), width: 80, get: (_, i) => res(i)?.inclined ?? null },
        { kind: 'number', key: 'steps', title: head(S, t('stair.quantitySteps')), width: 70, digits: 0, get: r => r.steps, set: (r, v) => ({ ...r, steps: v }) },
        { kind: 'number', key: 'riser', title: head(S, t('stair.riserHeightM')), width: 70, get: r => r.riser, set: (r, v) => ({ ...r, riser: v }) },
        { kind: 'number', key: 'tread', title: head(S, t('stair.treadWidthM')), width: 70, get: r => r.tread, set: (r, v) => ({ ...r, tread: v }) },
    ];

    const rebarColumns: SheetColumn<StairRow>[] = [
        { kind: 'label', key: 'name', title: t('stair.stairName'), width: 110, get: r => r.name },
        ...STAIR_GROUPS.flatMap((grp): SheetColumn<StairRow>[] => {
            const g = groupShort[grp.key];
            return [
                { kind: 'select', key: `${grp.key}-size`, title: head(g, t('common.size')), width: 85, options: sizeOptions,
                    get: r => r[grp.size], set: (r, v) => ({ ...r, [grp.size]: v }) },
                { kind: 'number', key: `${grp.key}-spacing`, title: head(g, t('common.spacingM')), width: 70,
                    get: r => r[grp.spacing], set: (r, v) => ({ ...r, [grp.spacing]: v }) },
                { kind: 'calc', key: `${grp.key}-count`, title: head(g, t('common.numberBars')), width: 65, digits: 0,
                    get: (_, i) => res(i)?.[grp.key].count ?? null },
                { kind: 'calc', key: `${grp.key}-length`, title: head(g, t('common.totalLengthM2')), width: 75,
                    get: (_, i) => res(i)?.[grp.key].length ?? null },
                { kind: 'calc', key: `${grp.key}-kg`, title: head(g, t('common.weightKg')), width: 75,
                    get: (_, i) => res(i)?.[grp.key].kg ?? null },
            ];
        }),
    ];

    const FW = t('common.formworkSqM');
    const CO = t('stair.structuralConcreteCuM');
    const formworkColumns: SheetColumn<StairRow>[] = [
        { kind: 'label', key: 'name', title: t('stair.stairName'), width: 110, get: r => r.name },
        { kind: 'calc', key: 'props', title: t('common.propsPcs'), width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
        { kind: 'calc', key: 'soffit', title: head(FW, t('stair.soffitOfStringer')), width: 80, get: (_, i) => res(i)?.soffit ?? null },
        { kind: 'calc', key: 'waistSides', title: head(FW, t('stair.sidesOfStringer')), width: 80, get: (_, i) => res(i)?.waistSides ?? null },
        { kind: 'calc', key: 'stepSides', title: head(FW, t('stair.sidesOfSteps')), width: 80, get: (_, i) => res(i)?.stepSides ?? null },
        { kind: 'calc', key: 'risers', title: head(FW, t('stair.stepRisers')), width: 80, get: (_, i) => res(i)?.risers ?? null },
        { kind: 'calc', key: 'formwork', title: head(FW, t('common.total')), width: 80, get: (_, i) => res(i)?.formwork ?? null },
        { kind: 'calc', key: 'waistConcrete', title: head(CO, t('stair.stringer')), width: 80, digits: 3, get: (_, i) => res(i)?.waistConcrete ?? null },
        { kind: 'calc', key: 'stepConcrete', title: head(CO, t('stair.steps2')), width: 80, digits: 3, get: (_, i) => res(i)?.stepConcrete ?? null },
        { kind: 'calc', key: 'concrete', title: head(CO, t('common.total')), width: 80, digits: 3, get: (_, i) => res(i)?.concrete ?? null },
    ];

    return (
        <CalculatorShell def={stair} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('stair.stairQuantitySummary')}>
                <RebarSummary groups={STAIR_GROUPS.map(grp => ({ label: grp.title, kg: totals.groups[grp.key] }))} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label={t('common.propsPcs')} value={outputs.props} unit={t('common.pcs')} digits={0} strong />
                    <CalcField label={t('common.formworkSqM')} value={outputs.formwork} unit={t('common.sqM')} strong />
                    <CalcField label={t('stair.structuralConcreteCuM')} value={outputs.concrete} unit={t('common.cuM')} digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title={t('stair.stairSize')}>
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} newRow={emptyRow} addLabel={t('stair.addStair')}
                    columns={sizeColumns} />
            </SheetCard>

            <SheetCard title={t('common.reinforcement')}>
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} canDelete={false} columns={rebarColumns} />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>{t('stair.mainReinforcementStringerQuantityRound')}{STAIR_ANCHORAGE}{t('stair.mQuantity')}</p>
                    <p>{t('stair.crackControlBarsStringerQuantity')}</p>
                    <p>{t('stair.mainReinforcementStepsQuantityRound')}</p>
                    <p>{t('stair.crackControlBarsStepsQuantity')}</p>
                    <p>{t('stair.reinforcementIsSentToThe')}</p>
                </div>
            </SheetCard>

            <SheetCard title={t('stair.formworkConcrete')}>
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} canDelete={false} columns={formworkColumns} />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>{t('stair.propsRoundUpStringerSoffit')}</p>
                    <p>{t('stair.stepSides2RiserHeight')}</p>
                    <p>{t('stair.stringerConcreteThicknessSlopedLength')}</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
