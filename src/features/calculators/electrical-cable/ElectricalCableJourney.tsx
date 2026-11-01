'use client';

import { Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
    BLANK_WIRING, circuitsToSuggest, CONDUCTOR_COUNTS, fillSuggestedWiring, sizeKey, WIRE_SIZES, type CircuitWiring,
} from '@/domain/calculators/electrical-cable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    ChoiceButtons, EmptyState, FillProgress, FromLevel, PlanCard, PlanField, ResultSummary, countFill,
    fillState, type FillState,
} from '@/components/sheet/journey';
import { useCableRows, type Calc, type Row } from './cableRows';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

const sizeLabel = (s: string) => s.replace(/^THW\s*/, '');
const MAIN_SIZE_CHOICES = WIRE_SIZES.map(value => ({ value: value as string, label: sizeLabel(value) }));
const deviceSizeChoices = (t: CalcT) => [...MAIN_SIZE_CHOICES, { value: '', label: t('common.none') }];
const conductorChoices = (t: CalcT) => CONDUCTOR_COUNTS.map(n => ({ value: n as number, label: n === 3 ? t('electricalCable.n3WiresWithEarth') : t('electricalCable.vWires', { v: String(n) }) }));

const rowTotal = (r: Row) => (r.cable ? WIRE_SIZES.reduce((s, size) => s + (r.cable?.bySize[size] ?? 0), 0) : 0);
const lengthOf = (r: Row) => (r.cable?.main ?? 0) + (r.cable?.device ?? 0);
const stateOf = (r: Row): FillState => fillState([lengthOf(r) > 0 && (r.cable?.unassigned ?? 0) === 0], lengthOf(r) > 0);

/**
 * Guided journey: one card per circuit of the conduit step — its run lengths (carried from that step), the wire
 * sizes and number of wires as buttons (pre-selected from the circuit kind), and the metres of wire it comes to.
 */
export function ElectricalCableJourney({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;
    const { rows, circuits } = useCableRows(calc);
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;
    const toSuggest = circuitsToSuggest(input, circuits);
    const setWiring = (r: Row, patch: Partial<CircuitWiring>) => update(p => ({
        ...p, wiring: { ...p.wiring, [r.circuit.id]: { ...(p.wiring[r.circuit.id] ?? BLANK_WIRING), ...patch } },
    }));

    if (rows.length === 0) {
        return (
            <SheetCard>
                <EmptyState text={t('common.noCircuitsYet')} note={t('electricalCable.theCircuitsAndCableRuns')}
                    goToLevel="electrical-pipe" />
            </SheetCard>
        );
    }

    const states = rows.map(stateOf);
    const progress = countFill(states);

    const card = (r: Row, i: number) => {
        const state = states[i] ?? 'empty';
        const main = r.cable?.main ?? 0;
        const device = r.cable?.device ?? 0;
        const w = r.wiring;
        const sum = rowTotal(r);
        const unassigned = r.cable?.unassigned ?? 0;
        const showDevice = device > 0 || w.deviceSize.trim() !== '';
        return (
            <PlanCard key={r.circuit.id} index={i + 1} state={state} compact scope={{ listKey: 'circuits', itemIndex: i, itemKey: r.circuit.id }}
                title={r.circuit.name.trim() === '' ? t('common.circuitV', { v: String(i + 1) }) : r.circuit.name}
                result={sum > 0 ? <>{t('electricalCable.cable')}{formatNumber(sum)} {t('common.m')}</> : undefined}
                missingText={w.conductors > 0
                    ? t('electricalCable.cableSizeNotSelectedYet', { v: formatNumber(unassigned) })
                    : t('electricalCable.numberOfWiresNotSelected', { v: formatNumber(unassigned) })}>
                <div className="mb-2 text-[12px] text-gray-500 tabular-nums">
                    {lengthOf(r) > 0
                        ? <>{t('electricalCable.mainRun')}{formatNumber(main)} {t('common.m')}{device > 0 && <> {t('electricalCable.toLuminairePoint')}{formatNumber(device)} {t('common.m')}</>}</>
                        : t('electricalCable.thisCircuitHasNoConduit')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3 items-start">
                    <PlanField label={t('electricalCable.circuitMainCableSqMm')} fieldKey="mainSize">
                        <ChoiceButtons ariaLabel={t('electricalCable.circuitMainCableSize')} size="small" options={MAIN_SIZE_CHOICES}
                            value={w.mainSize.trim() === '' ? undefined : w.mainSize.trim()}
                            onChange={mainSize => setWiring(r, { mainSize })} />
                    </PlanField>
                    {showDevice && (
                        <PlanField label={t('electricalCable.cableToLuminairePointSq')} fieldKey="deviceSize">
                            <ChoiceButtons ariaLabel={t('electricalCable.cableSizeToLuminairePoint')} size="small" options={deviceSizeChoices(t)}
                                value={w.deviceSize.trim()} onChange={deviceSize => setWiring(r, { deviceSize })} />
                        </PlanField>
                    )}
                    <PlanField label={t('electricalCable.numberOfWires')} fieldKey="conductors">
                        <ChoiceButtons ariaLabel={t('electricalCable.numberOfWires')} size="small" options={conductorChoices(t)}
                            value={w.conductors > 0 ? w.conductors : undefined}
                            onChange={conductors => setWiring(r, { conductors })} />
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <FromLevel levelId="electrical-pipe">
                {t('electricalCable.circuit')}{formatNumber(rows.length, 0)} {t('electricalCable.circuitAndTheCableRun')}
            </FromLevel>

            <SheetCard title={t('electricalCable.cableSizeOfEachCircuit')}>
                <div className="flex flex-col gap-2">
                    {rows.length >= 5 && <FillProgress {...progress} noun={t('common.circuit')} verb={t('electricalCable.cableSelected')} />}
                    <p className="text-[12px] text-gray-500">
                        {t('electricalCable.theSystemPicksTheCable')}
                    </p>
                    {toSuggest.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                            <span className="text-[13px] text-orange-700">{t('electricalCable.thereAre')}{toSuggest.length} {t('electricalCable.circuitsWithoutACableSize')}</span>
                            <Button size="small" type="primary" icon={<ThunderboltOutlined />}
                                onClick={() => update(p => fillSuggestedWiring(p, circuits))}>
                                {t('electricalCable.selectTheSuggestedCableSizes')}
                            </Button>
                        </div>
                    )}
                    {rows.map(card)}
                </div>
            </SheetCard>

            <ResultSummary
                items={[
                    { label: t('electricalCable.thwCable15Sq'), value: total('THW 1.5'), unit: t('common.m') },
                    { label: t('electricalCable.thwCable25Sq'), value: total('THW 2.5'), unit: t('common.m') },
                    { label: t('electricalCable.thwCable4SqMm'), value: total('THW 4'), unit: t('common.m') },
                    ...(total('THW 6') > 0 ? [{ label: t('electricalCable.thwCable6SqMm'), value: total('THW 6'), unit: t('common.m') }] : []),
                ]}
                note={total('THW 6') > 0
                    ? <span className="text-orange-600">{t('electricalCable.n6SqMmCableHas')}</span>
                    : undefined} />
        </>
    );
}
