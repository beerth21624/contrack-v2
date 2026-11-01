'use client';

import {
    applyKind, BREAKER_SIZES, CIRCUIT_KINDS, circuitKind, circuitTotal, electricalPipe, hasPoints, kindInfo,
    newCircuitId, newCircuitOfKind, PIPE_TYPES, setDeviceV, setDropEach, setPoints, type Circuit, type CircuitKind,
    type ElectricalPipeInput,
} from '@/domain/calculators/electrical-pipe';
import {
    electricalCable, fillSuggestedWiring, rewireForKind, type ElectricalCableInput,
} from '@/domain/calculators/electrical-cable';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, formatNumber } from '@/components/sheet/NumberCell';
import {
    ChoiceButtons, EmptyState, FillProgress, JSelect, JText, PlanCard, PlanField, PlanNumber, QuickAddChips,
    ResultSummary, countFill, fillState, insertAfter, nextCopyName, type FillState,
} from '@/components/sheet/journey';
import type { UseCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';
import type { CalcT } from '../text';

type Calc = UseCalculator<ElectricalPipeInput>;

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));
const kindOptions = CIRCUIT_KINDS.map(k => ({ value: k.kind, label: k.label }));
const BREAKER_CHOICES = BREAKER_SIZES.map(b => ({ value: b as string, label: b.replace(/\.$/, '') }));
const QUICK_KINDS = CIRCUIT_KINDS.map(k => ({ key: k.kind, label: k.label }));

const points = (c: Circuit) => c.points ?? 0;
/** Does the card ask for the run into the lamps / points (lights and sockets, or a value already typed)? */
const showsDeviceRun = (c: Circuit) => hasPoints(c) || c.deviceH !== 0;

/** Plan values a circuit card still needs. */
function missingOf(t: CalcT, c: Circuit): string[] {
    const out: string[] = [];
    if (!(c.mainH > 0)) out.push(t('electricalPipe.mainRunConduit'));
    if (hasPoints(c) && !(points(c) > 0)) {
        const pl = kindInfo(circuitKind(c))?.pointLabel ?? t('common.point');
        out.push(t('electricalPipe.numberOfPl', { pl }));
    }
    return out;
}
const startedOf = (c: Circuit) => c.mainH > 0 || c.deviceH > 0 || points(c) > 0;
const stateOf = (t: CalcT, c: Circuit): FillState => fillState([missingOf(t, c).length === 0], startedOf(c));

/**
 * Guided journey: one card per circuit with what the plan shows (horizontal runs, number of wall points) and its
 * conduit total; the vertical rules of thumb come from the circuit kind and sit folded in the advanced block.
 */
export function ElectricalPipeJourney({ calc }: { calc: Calc }) {
    const t = useTranslations('calculators');
    const { input, update, outputs } = calc;
    const setCalculatorInput = useProjectStore(s => s.setCalculatorInput);
    const circuits = input.circuits;

    /** Wire settings live in the cable step; a new / re-kinded circuit gets its suggested cable there. */
    const updateCable = (fn: (cable: ElectricalCableInput) => ElectricalCableInput) =>
        setCalculatorInput(electricalCable.id, fn(calculatorInput(useProjectStore.getState().project, electricalCable)));
    const setRow = (i: number, row: Circuit) => update(p => ({ ...p, circuits: p.circuits.map((r, j) => (j === i ? row : r)) }));
    const patchRow = (i: number, patch: Partial<Circuit>) =>
        update(p => ({ ...p, circuits: p.circuits.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
    const addKind = (kind: CircuitKind) => {
        const prev = calculatorInput(useProjectStore.getState().project, electricalPipe);
        const c = newCircuitOfKind(prev.circuits, kind);
        update({ circuits: [...prev.circuits, c] });
        updateCable(cable => fillSuggestedWiring(cable, [c]));
    };
    const changeKind = (i: number, row: Circuit, kind: CircuitKind) => {
        const next = applyKind(row, kind);
        setRow(i, next);
        updateCable(cable => rewireForKind(cable, row, next));
    };
    /** A copy right after the circuit (new id, next name); its wire settings are copied in the cable step too. */
    const duplicate = (i: number) => {
        const prev = calculatorInput(useProjectStore.getState().project, electricalPipe);
        const src = prev.circuits[i];
        if (src === undefined) return;
        const copy: Circuit = { ...src, id: newCircuitId(prev.circuits), name: nextCopyName(src.name, prev.circuits.map(c => c.name)) };
        update({ circuits: insertAfter(prev.circuits, i, copy) });
        updateCable(cable => {
            const w = cable.wiring[src.id];
            return w === undefined ? fillSuggestedWiring(cable, [copy]) : { ...cable, wiring: { ...cable.wiring, [copy.id]: { ...w } } };
        });
    };
    const remove = (i: number) => update(p => ({ ...p, circuits: p.circuits.filter((_, j) => j !== i) }));

    const states = circuits.map(c => stateOf(t, c));

    const card = (r: Circuit, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(t, r)) : new Set<string>();
        const pointLabel = kindInfo(circuitKind(r))?.pointLabel ?? t('common.point');
        const total = circuitTotal(r);
        return (
            <PlanCard key={r.id} index={i + 1} state={state} compact scope={{ listKey: 'circuits', itemIndex: i }}
                title={r.name.trim() === '' ? t('common.circuitV', { v: String(i + 1) }) : r.name}
                result={total > 0 ? <>{t('electricalPipe.conduit')}{formatNumber(total)} {t('common.m')}</> : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={startedOf(r)}
                deleteTitle={t('electricalPipe.deleteThisCircuit')} missingText={t('common.missingV', { v: missingOf(t, r).join(', ') })}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 items-start">
                    <div className="sm:col-span-2">
                        <JText wide label={t('electricalPipe.circuitNameAsInThe')} value={r.name} placeholder={t('electricalPipe.eGLightingBedroom1')}
                            onChange={name => patchRow(i, { name })} />
                    </div>
                    <JSelect<CircuitKind> label={t('electricalPipe.circuitType')} value={circuitKind(r)} options={kindOptions} placeholder={t('electricalPipe.selectType')}
                        onChange={k => { if (k !== undefined) changeKind(i, r, k); }} />
                    <PlanField label={t('electricalPipe.breaker')}>
                        <ChoiceButtons ariaLabel={t('electricalPipe.breakerSize')} size="small" options={BREAKER_CHOICES}
                            value={r.breaker.trim() === '' ? undefined : r.breaker.trim()}
                            onChange={breaker => patchRow(i, { breaker })} />
                    </PlanField>
                    <PlanNumber label={t('electricalPipe.mainRunConduit')} fieldKey="mainH" unit={t('common.m')} value={r.mainH} range={[0.5, 200]} missing={missing.has(t('electricalPipe.mainRunConduit'))}
                        onChange={mainH => patchRow(i, { mainH })} />
                    {showsDeviceRun(r) && (
                        <PlanNumber label={circuitKind(r) === 'light' ? t('electricalPipe.branchConduitToLuminaires') : t('electricalPipe.branchConduitToPoints')} unit={t('common.m')} value={r.deviceH}
                            range={[0.3, 300]} onChange={deviceH => patchRow(i, { deviceH })} />
                    )}
                    {hasPoints(r) && (
                        <PlanNumber label={t('electricalPipe.numberOfPointlabel', { pointLabel })} unit={t('common.point')} digits={0} value={points(r)}
                            missing={missing.has(t('electricalPipe.numberOfPointlabel', { pointLabel }))} onChange={n => setRow(i, setPoints(r, n))} />
                    )}
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title={t('electricalPipe.electricalCircuitsAndConduitRuns')}>
                {/* Folded once circuits exist: it helps the first time, then it is just in the way. */}
                <details open={circuits.length === 0}
                    className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-[12px] text-gray-600">
                    <summary className="cursor-pointer font-semibold text-gray-700">{t('electricalPipe.howToFillIn1')}</summary>
                    <ul className="list-disc pl-5 space-y-0.5 mt-1">
                        <li><b>{t('electricalPipe.mainRunConduit')}</b>{t('electricalPipe.measureAlongTheConduitAbove')}</li>
                        <li><b>{t('electricalPipe.branchConduitToLuminaires')}</b>{t('electricalPipe.conduitBranchingFromTheMain')}</li>
                        <li><b>{t('electricalPipe.numberOfPoints')}</b>{t('electricalPipe.countTheSwitchesLightingCircuit')}</li>
                    </ul>
                    <div className="mt-1 text-gray-500">
                        {t('electricalPipe.exampleLightingForBedroomBathroom')}
                    </div>
                </details>

                {circuits.length === 0
                    ? (
                        <EmptyState text={t('common.noCircuitsYet')}
                            note={t('electricalPipe.checkTheLoadScheduleOr')}
                            actions={CIRCUIT_KINDS.map(k => ({ label: t('electricalPipe.circuitLabel', { label: k.label }), onClick: () => addKind(k.kind) }))} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {circuits.length >= 5 && <FillProgress {...countFill(states)} noun={t('common.circuit')} />}
                            {circuits.map(card)}
                            <div className="mt-1 rounded-lg border border-dashed border-gray-300 px-3 py-2">
                                <QuickAddChips label={t('electricalPipe.addCircuit')} items={QUICK_KINDS}
                                    onAdd={k => {
                                        const kind = CIRCUIT_KINDS.find(x => x.kind === k)?.kind;
                                        if (kind !== undefined) addKind(kind);
                                    }} />
                            </div>
                        </div>
                    )}
            </SheetCard>

            {circuits.length > 0 && (
                <AdvancedSection title={t('electricalPipe.verticalConduitRunAndConduit')}>
                    <EditableTable<Circuit>
                        rows={circuits}
                        onChange={next => update({ circuits: next })}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'name', title: t('common.circuit'), width: 220, get: r => <span className="px-1">{r.name}</span> },
                            { kind: 'select', key: 'pipeType', title: t('electricalPipe.conduitType'), width: 100, options: opts(PIPE_TYPES),
                                get: r => r.pipeType, set: (r, v) => ({ ...r, pipeType: v }) },
                            { kind: 'number', key: 'mainV', title: t('electricalPipe.verticalConduitAtThePanel'), width: 120,
                                get: r => r.mainV, set: (r, v) => ({ ...r, mainV: v }) },
                            {
                                kind: 'label', key: 'dropEach', title: t('electricalPipe.dropPerPointM'), width: 100,
                                get: (r, i) => (hasPoints(r)
                                    ? (
                                        <NumberCell value={r.dropEach ?? kindInfo(circuitKind(r))?.dropEach ?? 0} ariaLabel={t('electricalPipe.dropPerPoint')}
                                            onCommit={v => setRow(i, setDropEach(r, v ?? 0))} />
                                    )
                                    : <span className="block text-center text-gray-400">—</span>),
                            },
                            { kind: 'number', key: 'deviceV', title: t('electricalPipe.totalWallDropsM'), width: 110,
                                get: r => r.deviceV, set: (r, v) => setDeviceV(r, v) },
                        ]}
                    />
                    <ul className="mt-2 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                        <li>{t('electricalPipe.verticalConduitAtThePanel2')}</li>
                        <li>{t('electricalPipe.dropPerPointSwitchesAnd')}</li>
                        <li>{t('electricalPipe.allCircuitsArePricedAs')}</li>
                    </ul>
                </AdvancedSection>
            )}

            <ResultSummary items={[
                { label: t('electricalPipe.numberOfCircuits'), value: circuits.length, unit: t('common.circuit'), digits: 0 },
                { label: t('electricalPipe.totalElectricalConduit'), value: outputs.total, unit: t('common.m') },
            ]} />
        </>
    );
}
