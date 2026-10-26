'use client';

import Link from 'next/link';
import { Button, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    applyKind, BREAKER_SIZES, CIRCUIT_KINDS, circuitKind, circuitTotal, electricalPipe, hasPoints, kindInfo, newCircuit,
    newCircuitOfKind, PIPE_TYPES, pipeTypeKey, setDeviceV, setDropEach, setPoints, type Circuit, type CircuitKind,
    type ElectricalPipeInput,
} from '@/domain/calculators/electrical-pipe';
import {
    electricalCable, fillSuggestedWiring, rewireForKind, type ElectricalCableInput,
} from '@/domain/calculators/electrical-cable';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { EmptyState, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

type Calc = UseCalculator<ElectricalPipeInput>;

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));
const head = (group: string, label: string) => (
    <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-normal text-gray-500">{group}</span>
        <span>{label}</span>
    </span>
);
const tf = 'border border-gray-200 px-2 py-1 text-[13px]';

export default function ElectricalPipePage() {
    const calc = useCalculator(electricalPipe);
    const inJourney = useJourneyMode();
    const { reset, result, isDefault } = calc;

    return (
        <CalculatorShell def={electricalPipe} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyPipe calc={calc} /> : <SheetPipe calc={calc} />}
        </CalculatorShell>
    );
}

/** The full Excel-mirror view (/calc). */
function SheetPipe({ calc }: { calc: Calc }) {
    const { input, update, outputs } = calc;
    const types = [...new Set(input.circuits.map(c => c.pipeType.trim()).filter(t => t !== ''))];

    return (
        <>
            <SheetCard title=": ตารางคำนวณปริมาณความยาวท่อร้อยสายไฟ"
                extra={(
                    <span className="text-[13px] text-gray-600">
                        ความยาวท่อร้อยสายไฟ &gt;&gt;{' '}
                        <span className="inline-block min-w-[80px] text-right font-bold tabular-nums px-2 py-0.5 rounded-sm"
                            style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.total)}</span> ม.
                    </span>
                )}>
                <EditableTable<Circuit>
                    rows={input.circuits}
                    onChange={circuits => update({ circuits })}
                    newRow={() => newCircuit(input.circuits)}
                    addLabel="+ เพิ่มวงจร"
                    columns={[
                        { kind: 'text', key: 'name', title: 'วงจร', width: 280, get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'select', key: 'breaker', title: 'ขนาด CB', width: 90, options: opts(BREAKER_SIZES),
                            get: r => r.breaker, set: (r, v) => ({ ...r, breaker: v }) },
                        { kind: 'select', key: 'pipeType', title: 'ชนิดท่อ', width: 100, options: opts(PIPE_TYPES),
                            get: r => r.pipeType, set: (r, v) => ({ ...r, pipeType: v }) },
                        { kind: 'number', key: 'mainH', title: head('แนวราบ', 'วงจรย่อย (ม.) (สายเมน)'), width: 95,
                            get: r => r.mainH, set: (r, v) => ({ ...r, mainH: v }) },
                        { kind: 'number', key: 'deviceH', title: head('แนวราบ', 'เข้าอุปกรณ์ (ม.)'), width: 95,
                            get: r => r.deviceH, set: (r, v) => ({ ...r, deviceH: v }) },
                        { kind: 'number', key: 'mainV', title: head('แนวดิ่ง', 'วงจรย่อย (ม.) (สายเมน)'), width: 95,
                            get: r => r.mainV, set: (r, v) => ({ ...r, mainV: v }) },
                        { kind: 'number', key: 'deviceV', title: head('แนวดิ่ง', 'เข้าอุปกรณ์ (ม.)'), width: 95,
                            get: r => r.deviceV, set: (r, v) => setDeviceV(r, v) },
                        { kind: 'calc', key: 'total', title: 'รวม (ม.)', width: 90, get: r => circuitTotal(r) },
                    ]}
                    footer={(
                        <tr style={{ background: SHEET_COLORS.subtotal }}>
                            <td className={`${tf} text-right font-semibold`} colSpan={8}>ความยาวท่อร้อยสายไฟ &gt;&gt;</td>
                            <td className={`${tf} text-right font-bold tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                {formatNumber(outputs.total)}
                            </td>
                            <td className={tf} />
                        </tr>
                    )}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ม.) = แนวราบ (วงจรย่อย + เข้าอุปกรณ์) + แนวดิ่ง (วงจรย่อย + เข้าอุปกรณ์)</li>
                    <li>
                        แนวดิ่งเข้าอุปกรณ์ ในตัวอย่าง Excel = จำนวนจุด × ความสูงท่อลง (ไฟแสงสว่าง / เต้ารับครัว 2.3 ม., เต้ารับ 3.2 ม.)
                        เช่น 7 × 2.3 = 16.10 · แนวดิ่งวงจรย่อย = 1.5 + ระยะขึ้นถึงอุปกรณ์ (เครื่องทำน้ำอุ่น 1.5, แอร์ห้องนอน 0.9,
                        แอร์ห้องรับแขก/ทานอาหาร 0.3, ปั๊มน้ำ 2.9)
                    </li>
                    <li>ขนาด CB และชนิดท่อเป็นข้อมูลประกอบ — ทุกวงจรรวมเข้าแถว BOQ &quot;ท่อร้อยสายไฟ ท่อ PVC 1/2&quot;&quot; แถวเดียว (เหมือน Excel)</li>
                    <li>
                        รายการวงจรนี้ใช้ร่วมกับ <Link href="/calc/electrical-cable" className="text-blue-600 hover:underline">โปรแกรมสายไฟ</Link>
                        {' '}— ความยาวสายไฟ วงจรย่อย = แนวราบ + แนวดิ่ง (วงจรย่อย), เข้าอุปกรณ์ = แนวราบ + แนวดิ่ง (เข้าอุปกรณ์)
                    </li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปความยาวท่อร้อยสายไฟ (ส่งเข้า BOQ หมวด 17)">
                <div className="max-w-lg">
                    <CalcField label={'ท่อร้อยสายไฟ ท่อ PVC 1/2" (รวมทุกวงจร)'} value={outputs.total} unit="ม." strong />
                    {types.length > 1 && types.map(t => (
                        <CalcField key={t} label={`— ในนี้เป็นท่อ ${t}`} value={outputs[pipeTypeKey(t)] ?? 0} unit="ม." />
                    ))}
                </div>
                {types.some(t => t !== 'PVC 1/2"') && (
                    <p className="mt-1 text-[12px] text-orange-600">
                        มีวงจรที่ไม่ใช่ท่อ PVC 1/2&quot; — Excel รวมทุกชนิดท่อเข้าแถว BOQ เดียวกันในราคาท่อ 1/2&quot;
                    </p>
                )}
            </SheetCard>
        </>
    );
}

const kindOptions = CIRCUIT_KINDS.map(k => ({ value: k.kind, label: k.label }));
const digitsOf = (v: number) => (Number.isInteger(v) ? 0 : 2);

/**
 * Guided journey: one row per circuit with what the plan shows (horizontal runs, number of wall points); the
 * vertical rules of thumb come from the circuit kind and sit folded in the advanced block.
 */
function JourneyPipe({ calc }: { calc: Calc }) {
    const { input, update, outputs } = calc;
    const setCalculatorInput = useProjectStore(s => s.setCalculatorInput);
    const circuits = input.circuits;

    /** Wire settings live in the cable level; a new / re-kinded circuit gets its suggested cable there. */
    const updateCable = (fn: (cable: ElectricalCableInput) => ElectricalCableInput) =>
        setCalculatorInput(electricalCable.id, fn(calculatorInput(useProjectStore.getState().project, electricalCable)));
    const setRow = (i: number, row: Circuit) => update(p => ({ ...p, circuits: p.circuits.map((r, j) => (j === i ? row : r)) }));
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

    const addButtons = (
        <div className="flex flex-wrap gap-2">
            {CIRCUIT_KINDS.map(k => (
                <Button key={k.kind} icon={<PlusOutlined />} size="small" onClick={() => addKind(k.kind)}>
                    {k.label}
                </Button>
            ))}
        </div>
    );

    return (
        <>
            <SheetCard title="วงจรไฟฟ้าและระยะเดินท่อ">
                <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-[12px] text-gray-600">
                    <div className="font-semibold text-gray-700 mb-1">วิธีกรอก (1 แถว = 1 วงจร = 1 เบรกเกอร์ในตู้ไฟ)</div>
                    <ul className="list-disc pl-5 space-y-0.5">
                        <li><b>ท่อสายเมน</b>: วัดตามแนวท่อบนฝ้า จากตู้ไฟผ่านทุกจุดของวงจร</li>
                        <li><b>ท่อแยกเข้าโคม</b>: ท่อที่แยกจากสายเมนเข้าดวงโคมแต่ละดวง (วงจรไฟแสงสว่าง) ถ้าไม่มีเว้นว่าง</li>
                        <li><b>จุดท่อลงผนัง</b>: นับสวิตช์ (วงจรไฟ) หรือเต้ารับ (วงจรเต้ารับ) — ระบบคิดท่อแนวดิ่งให้เอง</li>
                    </ul>
                    <div className="mt-1 text-gray-500">
                        ตัวอย่าง: ไฟแสงสว่างห้องนอน + ห้องน้ำ — ท่อสายเมน 22.4 ม., ท่อแยกเข้าโคม 25.6 ม., สวิตช์ 7 จุด
                        → ท่อลงผนัง 7 × 2.3 = 16.1 ม. + ท่อที่ตู้ไฟ 1.5 ม. = รวม 65.6 ม.
                    </div>
                </div>

                {circuits.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีวงจร"
                            note="ดูตารางโหลดหรือแปลนไฟฟ้า แล้วเพิ่มทีละวงจรตามชนิด — ระบบตั้งเบรกเกอร์ ระยะแนวดิ่ง และขนาดสายให้"
                            actions={CIRCUIT_KINDS.map(k => ({ label: k.label, onClick: () => addKind(k.kind) }))} />
                    )
                    : (
                        <>
                            <EditableTable<Circuit>
                                rows={circuits}
                                onChange={next => update({ circuits: next })}
                                columns={[
                                    { kind: 'text', key: 'name', title: 'ชื่อวงจร', width: 230, placeholder: 'เช่น แสงสว่าง : ห้องนอน 1, 2',
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    {
                                        kind: 'label', key: 'kind', title: 'ชนิด', width: 150,
                                        get: (r, i) => (
                                            <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                                                <Select<CircuitKind> size="small" variant="borderless" style={{ width: '100%' }}
                                                    value={circuitKind(r)} options={kindOptions} placeholder="เลือกชนิด"
                                                    onChange={k => changeKind(i, r, k)} />
                                            </div>
                                        ),
                                    },
                                    { kind: 'number', key: 'mainH', title: head('วัดจากแบบ', 'ท่อสายเมน (ม.)'), width: 105,
                                        get: r => r.mainH, set: (r, v) => ({ ...r, mainH: v }) },
                                    { kind: 'number', key: 'deviceH', title: head('วัดจากแบบ', 'ท่อแยกเข้าโคม (ม.)'), width: 105,
                                        get: r => r.deviceH, set: (r, v) => ({ ...r, deviceH: v }) },
                                    {
                                        kind: 'label', key: 'points', title: head('นับจากแบบ', 'จุดท่อลงผนัง'), width: 110,
                                        get: (r, i) => {
                                            if (!hasPoints(r)) return <span className="block text-center text-[12px] text-gray-400">— เครื่องเดียว</span>;
                                            const label = kindInfo(circuitKind(r))?.pointLabel;
                                            const points = r.points ?? 0;
                                            return (
                                                <div className="flex items-center gap-1">
                                                    <NumberCell value={points} digits={digitsOf(points)} ariaLabel="จำนวนจุดท่อลงผนัง" blankZero
                                                        onCommit={v => setRow(i, setPoints(r, v ?? 0))} />
                                                    {label && <span className="text-[11px] text-gray-500 whitespace-nowrap">{label}</span>}
                                                </div>
                                            );
                                        },
                                    },
                                    { kind: 'calc', key: 'total', title: 'ท่อรวม (ม.)', width: 95, get: r => circuitTotal(r) },
                                ]}
                                footer={(
                                    <tr style={{ background: SHEET_COLORS.subtotal }}>
                                        <td className={`${tf} text-right font-semibold`} colSpan={6}>ท่อร้อยสายไฟรวม</td>
                                        <td className={`${tf} text-right font-bold tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                            {formatNumber(outputs.total)}
                                        </td>
                                        <td className={tf} />
                                    </tr>
                                )}
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="text-[12px] text-gray-500">เพิ่มวงจร:</span>
                                {addButtons}
                            </div>
                        </>
                    )}
            </SheetCard>

            {circuits.length > 0 && (
                <AdvancedSection title="ระยะท่อแนวดิ่งและเบรกเกอร์" hint="ตั้งให้ตามชนิดวงจรแล้ว — ไม่ต้องแก้ก็ได้">
                    <EditableTable<Circuit>
                        rows={circuits}
                        onChange={next => update({ circuits: next })}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'name', title: 'วงจร', width: 220, get: r => <span className="px-1">{r.name}</span> },
                            { kind: 'select', key: 'breaker', title: 'เบรกเกอร์', width: 90, options: opts(BREAKER_SIZES),
                                get: r => r.breaker, set: (r, v) => ({ ...r, breaker: v }) },
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
