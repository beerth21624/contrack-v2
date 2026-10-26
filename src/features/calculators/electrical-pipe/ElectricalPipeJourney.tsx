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

type Calc = UseCalculator<ElectricalPipeInput>;

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));
const kindOptions = CIRCUIT_KINDS.map(k => ({ value: k.kind, label: k.label }));
const BREAKER_CHOICES = BREAKER_SIZES.map(b => ({ value: b as string, label: b.replace(/\.$/, '') }));
const QUICK_KINDS = CIRCUIT_KINDS.map(k => ({ key: k.kind, label: k.label }));

const points = (c: Circuit) => c.points ?? 0;
/** Does the card ask for the run into the lamps / points (lights and sockets, or a value already typed)? */
const showsDeviceRun = (c: Circuit) => hasPoints(c) || c.deviceH !== 0;

/** Plan values a circuit card still needs. */
function missingOf(c: Circuit): string[] {
    const out: string[] = [];
    if (!(c.mainH > 0)) out.push('ท่อสายเมน');
    if (hasPoints(c) && !(points(c) > 0)) out.push(`จำนวน${kindInfo(circuitKind(c))?.pointLabel ?? 'จุด'}`);
    return out;
}
const startedOf = (c: Circuit) => c.mainH > 0 || c.deviceH > 0 || points(c) > 0;
const stateOf = (c: Circuit): FillState => fillState([missingOf(c).length === 0], startedOf(c));

/**
 * Guided journey: one card per circuit with what the plan shows (horizontal runs, number of wall points) and its
 * conduit total; the vertical rules of thumb come from the circuit kind and sit folded in the advanced block.
 */
export function ElectricalPipeJourney({ calc }: { calc: Calc }) {
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

    const states = circuits.map(stateOf);

    const card = (r: Circuit, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(r)) : new Set<string>();
        const pointLabel = kindInfo(circuitKind(r))?.pointLabel ?? 'จุด';
        const total = circuitTotal(r);
        return (
            <PlanCard key={r.id} index={i + 1} state={state} compact
                title={r.name.trim() === '' ? `วงจรที่ ${String(i + 1)}` : r.name}
                result={total > 0 ? <>ท่อ {formatNumber(total)} ม.</> : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} hasData={startedOf(r)}
                deleteTitle="ลบวงจรนี้?" missingText={`ยังขาด: ${missingOf(r).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 items-start">
                    <div className="sm:col-span-2">
                        <JText wide label="ชื่อวงจร (ตามตารางโหลด)" value={r.name} placeholder="เช่น แสงสว่าง : ห้องนอน 1, 2"
                            onChange={name => patchRow(i, { name })} />
                    </div>
                    <JSelect<CircuitKind> label="ชนิดวงจร" value={circuitKind(r)} options={kindOptions} placeholder="เลือกชนิด"
                        onChange={k => { if (k !== undefined) changeKind(i, r, k); }} />
                    <PlanField label="เบรกเกอร์">
                        <ChoiceButtons ariaLabel="ขนาดเบรกเกอร์" size="small" options={BREAKER_CHOICES}
                            value={r.breaker.trim() === '' ? undefined : r.breaker.trim()}
                            onChange={breaker => patchRow(i, { breaker })} />
                    </PlanField>
                    <PlanNumber label="ท่อสายเมน" unit="ม." value={r.mainH} range={[0.5, 200]} missing={missing.has('ท่อสายเมน')}
                        onChange={mainH => patchRow(i, { mainH })} />
                    {showsDeviceRun(r) && (
                        <PlanNumber label={circuitKind(r) === 'light' ? 'ท่อแยกเข้าโคม' : 'ท่อแยกเข้าจุด'} unit="ม." value={r.deviceH}
                            range={[0.3, 300]} onChange={deviceH => patchRow(i, { deviceH })} />
                    )}
                    {hasPoints(r) && (
                        <PlanNumber label={`จำนวน${pointLabel}`} unit="จุด" digits={0} value={points(r)}
                            missing={missing.has(`จำนวน${pointLabel}`)} onChange={n => setRow(i, setPoints(r, n))} />
                    )}
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title="วงจรไฟฟ้าและระยะเดินท่อ">
                {/* Folded once circuits exist: it helps the first time, then it is just in the way. */}
                <details open={circuits.length === 0}
                    className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 text-[12px] text-gray-600">
                    <summary className="cursor-pointer font-semibold text-gray-700">วิธีกรอก (1 การ์ด = 1 วงจร = 1 เบรกเกอร์ในตู้ไฟ)</summary>
                    <ul className="list-disc pl-5 space-y-0.5 mt-1">
                        <li><b>ท่อสายเมน</b>: วัดตามแนวท่อบนฝ้า จากตู้ไฟผ่านทุกจุดของวงจร (ดูแปลนไฟฟ้า)</li>
                        <li><b>ท่อแยกเข้าโคม</b>: ท่อที่แยกจากสายเมนเข้าดวงโคมแต่ละดวง (วงจรไฟแสงสว่าง) ถ้าไม่มีเว้นว่าง</li>
                        <li><b>จำนวนจุด</b>: นับสวิตช์ (วงจรไฟ) หรือเต้ารับ (วงจรเต้ารับ) — ระบบคิดท่อแนวดิ่งให้เอง</li>
                    </ul>
                    <div className="mt-1 text-gray-500">
                        ตัวอย่าง: ไฟแสงสว่างห้องนอน + ห้องน้ำ — ท่อสายเมน 22.4 ม., ท่อแยกเข้าโคม 25.6 ม., สวิตช์ 7 จุด
                        → ท่อลงผนัง 7 × 2.3 = 16.1 ม. + ท่อที่ตู้ไฟ 1.5 ม. = รวม 65.6 ม.
                    </div>
                </details>

                {circuits.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีวงจร"
                            note="ดูตารางโหลดหรือแปลนไฟฟ้า แล้วเพิ่มทีละวงจรตามชนิด — ระบบตั้งเบรกเกอร์ ระยะแนวดิ่ง และขนาดสายให้"
                            actions={CIRCUIT_KINDS.map(k => ({ label: `วงจร${k.label}`, onClick: () => addKind(k.kind) }))} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {circuits.length >= 5 && <FillProgress {...countFill(states)} noun="วงจร" />}
                            {circuits.map(card)}
                            <div className="mt-1 rounded-lg border border-dashed border-gray-300 px-3 py-2">
                                <QuickAddChips label="เพิ่มวงจร" items={QUICK_KINDS}
                                    onAdd={k => {
                                        const kind = CIRCUIT_KINDS.find(x => x.kind === k)?.kind;
                                        if (kind !== undefined) addKind(kind);
                                    }} />
                            </div>
                        </div>
                    )}
            </SheetCard>

            {circuits.length > 0 && (
                <AdvancedSection title="ระยะท่อแนวดิ่งและชนิดท่อ">
                    <EditableTable<Circuit>
                        rows={circuits}
                        onChange={next => update({ circuits: next })}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'name', title: 'วงจร', width: 220, get: r => <span className="px-1">{r.name}</span> },
                            { kind: 'select', key: 'pipeType', title: 'ชนิดท่อ', width: 100, options: opts(PIPE_TYPES),
                                get: r => r.pipeType, set: (r, v) => ({ ...r, pipeType: v }) },
                            { kind: 'number', key: 'mainV', title: 'ท่อแนวดิ่งที่ตู้ไฟ / ถึงเครื่อง (ม.)', width: 120,
                                get: r => r.mainV, set: (r, v) => ({ ...r, mainV: v }) },
                            {
                                kind: 'label', key: 'dropEach', title: 'ท่อลงต่อจุด (ม.)', width: 100,
                                get: (r, i) => (hasPoints(r)
                                    ? (
                                        <NumberCell value={r.dropEach ?? kindInfo(circuitKind(r))?.dropEach ?? 0} ariaLabel="ท่อลงต่อจุด"
                                            onCommit={v => setRow(i, setDropEach(r, v ?? 0))} />
                                    )
                                    : <span className="block text-center text-gray-400">—</span>),
                            },
                            { kind: 'number', key: 'deviceV', title: 'ท่อลงผนังรวม (ม.)', width: 110,
                                get: r => r.deviceV, set: (r, v) => setDeviceV(r, v) },
                        ]}
                    />
                    <ul className="mt-2 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                        <li>ท่อแนวดิ่งที่ตู้ไฟ 1.5 ม. ทุกวงจร + ท่อลงถึงเครื่อง: เครื่องทำน้ำอุ่น 1.5, แอร์ห้องนอน 0.9, แอร์ห้องรับแขก/ห้องทานอาหาร 0.3, ปั๊มน้ำ 2.9 ม.</li>
                        <li>ท่อลงต่อจุด: สวิตช์และเต้ารับเหนือเคาน์เตอร์ 2.3 ม., เต้ารับ 3.2 ม. · ท่อลงผนังรวม = จำนวนจุด × ท่อลงต่อจุด (พิมพ์ทับได้)</li>
                        <li>ทุกวงจรคิดราคาเป็นท่อ PVC 1/2&quot;</li>
                    </ul>
                </AdvancedSection>
            )}

            <ResultSummary items={[
                { label: 'จำนวนวงจร', value: circuits.length, unit: 'วงจร', digits: 0 },
                { label: 'ท่อร้อยสายไฟรวม', value: outputs.total, unit: 'ม.' },
            ]} />
        </>
    );
}
