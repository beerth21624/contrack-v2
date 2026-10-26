'use client';

import Link from 'next/link';
import { Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import {
    BLANK_WIRING, cableRows, circuitsToSuggest, CONDUCTOR_COUNTS, electricalCable, fillSuggestedWiring, sizeKey,
    WIRE_BUCKETS, WIRE_SIZES, type CableRow, type CircuitWiring, type ElectricalCableInput,
} from '@/domain/calculators/electrical-cable';
import { electricalPipe, type Circuit } from '@/domain/calculators/electrical-pipe';
import type { CalcContext } from '@/domain/calculators/types';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { EmptyState, FromLevel, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

interface Row {
    circuit: Circuit;
    wiring: CircuitWiring;
    cable?: CableRow;
}

type Calc = UseCalculator<ElectricalCableInput>;

const sizeOptions = [{ value: '', label: '(ว่าง)' }, ...WIRE_SIZES.map(value => ({ value }))];
const tf = 'border border-gray-200 px-2 py-1 text-[13px]';
const HEADER: Record<string, string> = { 'THW 1.5': 'THW #1.5 (ม.)', 'THW 2.5': 'THW #2.5 (ม.)', 'THW 4': 'THW #4 (ม.)', 'THW 6': 'THW #6 (ม.)' };
const withWiring = (r: Row, patch: Partial<CircuitWiring>): Row => ({ ...r, wiring: { ...r.wiring, ...patch } });

/** The conduit level's circuits joined with this level's wire settings and results. */
function useCableRows(calc: Calc): { rows: Row[]; circuits: Circuit[] } {
    // One circuit list (decision on oddity D4): names, CB and lengths come from the conduit sheet.
    const project = useProjectStore(s => s.project);
    const { input, result } = calc;
    const pipeInput = calculatorInput(project, electricalPipe);
    const pipeOut = result.calcOutputs['electrical-pipe'] ?? electricalPipe.compute(pipeInput, { outputs: () => undefined });
    const ctx: CalcContext = { outputs: id => (id === 'electrical-pipe' ? pipeOut : result.calcOutputs[id]) };
    const byId = new Map(cableRows(input, ctx).map(r => [r.id, r]));
    const rows = pipeInput.circuits.map(circuit => {
        const cable = byId.get(circuit.id);
        return { circuit, wiring: input.wiring[circuit.id] ?? BLANK_WIRING, ...(cable ? { cable } : {}) };
    });
    return { rows, circuits: pipeInput.circuits };
}

export default function ElectricalCablePage() {
    const calc = useCalculator(electricalCable);
    const inJourney = useJourneyMode();
    const { reset, result, isDefault } = calc;

    return (
        <CalculatorShell def={electricalCable} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyCable calc={calc} /> : <SheetCable calc={calc} />}
        </CalculatorShell>
    );
}

/** The full Excel-mirror view (/calc). */
function SheetCable({ calc }: { calc: Calc }) {
    const { update, outputs } = calc;
    const { rows } = useCableRows(calc);
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;

    return (
        <>
            <SheetCard title=": ตารางคำนวณปริมาณความยาวสายไฟ">
                <EditableTable<Row>
                    rows={rows}
                    onChange={next => update(p => ({
                        ...p, wiring: { ...p.wiring, ...Object.fromEntries(next.map(r => [r.circuit.id, r.wiring])) },
                    }))}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'name', title: 'วงจร', width: 260, get: r => <span className="px-1">{r.circuit.name}</span> },
                        { kind: 'label', key: 'breaker', title: 'ขนาด CB', width: 70,
                            get: r => <span className="block text-center">{r.circuit.breaker}</span> },
                        { kind: 'select', key: 'mainSize', title: 'ขนาดสาย วงจรย่อย (สายเมน)', width: 105, options: sizeOptions,
                            get: r => r.wiring.mainSize.trim(), set: (r, v) => withWiring(r, { mainSize: v }) },
                        { kind: 'select', key: 'deviceSize', title: 'ขนาดสาย เข้าอุปกรณ์', width: 105, options: sizeOptions,
                            get: r => r.wiring.deviceSize.trim(), set: (r, v) => withWiring(r, { deviceSize: v }) },
                        { kind: 'select', key: 'conductors', title: 'จำนวนสาย (เส้น)', width: 75,
                            options: CONDUCTOR_COUNTS.map(n => ({ value: String(n) })),
                            get: r => (r.wiring.conductors ? String(r.wiring.conductors) : ''),
                            set: (r, v) => withWiring(r, { conductors: Number(v) }) },
                        { kind: 'calc', key: 'main', title: 'ความยาวสาย วงจรย่อย (ม.) (สายเมน)', width: 95, get: r => r.cable?.main ?? 0 },
                        { kind: 'calc', key: 'device', title: 'ความยาวสาย เข้าอุปกรณ์ (ม.)', width: 95, get: r => r.cable?.device ?? 0 },
                        ...WIRE_BUCKETS.map(b => ({
                            kind: 'calc' as const, key: b.column, title: HEADER[b.size] ?? b.size, width: 80,
                            get: (r: Row) => r.cable?.bySize[b.size] ?? 0,
                        })),
                    ]}
                    footer={(
                        <tr style={{ background: SHEET_COLORS.subtotal }}>
                            <td className={`${tf} text-right font-semibold`} colSpan={8}>รวม &gt;&gt;</td>
                            {WIRE_BUCKETS.map(b => (
                                <td key={b.column} className={`${tf} text-right font-bold tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                    {formatNumber(total(b.size))}
                                </td>
                            ))}
                        </tr>
                    )}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>
                        วงจร, ขนาด CB และความยาวสายมาจาก{' '}
                        <Link href="/calc/electrical-pipe" className="text-blue-600 hover:underline">โปรแกรมท่อร้อยสายไฟ</Link>
                        {' '}(เพิ่ม/ลบ/แก้ชื่อวงจรที่หน้านั้น): ความยาวสาย วงจรย่อย = แนวราบ + แนวดิ่ง (วงจรย่อย),
                        เข้าอุปกรณ์ = แนวราบ + แนวดิ่ง (เข้าอุปกรณ์)
                    </li>
                    <li>THW แต่ละขนาด = ความยาวสายวงจรย่อย × จำนวนสาย (ถ้าเลือกขนาดนั้น) + ความยาวสายเข้าอุปกรณ์ × จำนวนสาย (ถ้าเลือกขนาดนั้น)</li>
                    <li>THW #6 ไม่มีแถวใน BOQ (เหมือน Excel) — ความยาวที่เลือกเป็น THW 6 จะไม่ถูกคิดราคา</li>
                </ul>
                {(outputs.unassigned ?? 0) > 0 && (
                    <p className="mt-1 text-[12px] text-red-500">
                        มีความยาวสาย {formatNumber(outputs.unassigned)} ม. ที่ยังไม่ได้เลือกขนาดสายหรือจำนวนสาย — ไม่ถูกนับในช่อง THW ใด
                    </p>
                )}
            </SheetCard>

            <SheetCard title="สรุปความยาวสายไฟ (ส่งเข้า BOQ หมวด 18)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="รวมสายไฟฟ้า THW 1.5 ตร.มม." value={total('THW 1.5')} unit="ม." strong />
                    <CalcField label="รวมสายไฟฟ้า THW 2.5 ตร.มม." value={total('THW 2.5')} unit="ม." strong />
                    <CalcField label="รวมสายไฟฟ้า THW 4 ตร.มม." value={total('THW 4')} unit="ม." strong />
                    <CalcField label="THW 6 (ไม่มีแถว BOQ)" value={total('THW 6')} unit="ม." />
                </div>
            </SheetCard>
        </>
    );
}

const plainSizeOptions = [{ value: '', label: '(ยังไม่เลือก)' }, ...WIRE_SIZES.map(value => ({ value, label: `${value} ตร.มม.` }))];
const plainConductorOptions = CONDUCTOR_COUNTS.map(n => ({ value: String(n), label: n === 3 ? '3 เส้น (มีสายดิน)' : `${n} เส้น` }));
const rowTotal = (r: Row) => (r.cable ? WIRE_SIZES.reduce((s, size) => s + (r.cable?.bySize[size] ?? 0), 0) : 0);

/**
 * Guided journey: the circuits of the conduit level, each with its wire sizes and number of wires (pre-selected
 * from the circuit kind when the circuit was added), the metres of each size, and a fill-in for blank circuits.
 */
function JourneyCable({ calc }: { calc: Calc }) {
    const { input, update, outputs } = calc;
    const { rows, circuits } = useCableRows(calc);
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;
    const toSuggest = circuitsToSuggest(input, circuits);
    const setWiring = (next: Row[]) => update(p => ({
        ...p, wiring: { ...p.wiring, ...Object.fromEntries(next.map(r => [r.circuit.id, r.wiring])) },
    }));

    if (rows.length === 0) {
        return (
            <SheetCard>
                <EmptyState text="ยังไม่มีวงจร" note="วงจรและระยะสายมาจากด่านท่อร้อยสายไฟ — เพิ่มวงจรที่ด่านนั้นก่อน"
                    goToLevel="electrical-pipe" />
            </SheetCard>
        );
    }

    return (
        <>
            <FromLevel levelId="electrical-pipe">
                วงจร {formatNumber(rows.length, 0)} วงจร และระยะสายของแต่ละวงจร — แก้ชื่อหรือเพิ่มวงจรที่ด่านนั้น
            </FromLevel>

            <SheetCard title="ขนาดสายไฟแต่ละวงจร">
                <p className="mb-2 text-[12px] text-gray-500">
                    ระบบเลือกขนาดสายตามชนิดวงจรไว้ให้ ตรวจกับไดอะแกรมไฟฟ้า
                    (ไฟแสงสว่าง: สายเมน 2.5 / เข้าโคม 1.5 ตร.มม. 2 เส้น · เต้ารับ: 4 / 2.5 ตร.มม. 3 เส้น ·
                    เครื่องทำน้ำอุ่น แอร์ ปั๊มน้ำ: 4 ตร.มม. 3 เส้น)
                </p>
                {toSuggest.length > 0 && (
                    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                        <span className="text-[13px] text-orange-700">มี {toSuggest.length} วงจรที่ยังไม่ได้เลือกขนาดสาย</span>
                        <Button size="small" type="primary" icon={<ThunderboltOutlined />}
                            onClick={() => update(p => fillSuggestedWiring(p, circuits))}>
                            เลือกขนาดสายที่แนะนำให้
                        </Button>
                    </div>
                )}
                <EditableTable<Row>
                    rows={rows}
                    onChange={setWiring}
                    canDelete={false}
                    columns={[
                        {
                            kind: 'label', key: 'name', title: 'วงจร', width: 240,
                            get: r => <span className="px-1">{r.circuit.name.trim() === '' ? '(ยังไม่ตั้งชื่อ)' : r.circuit.name}</span>,
                        },
                        { kind: 'select', key: 'mainSize', title: 'สายเมนวงจร', width: 130, options: plainSizeOptions,
                            get: r => r.wiring.mainSize.trim(), set: (r, v) => withWiring(r, { mainSize: v }) },
                        { kind: 'select', key: 'deviceSize', title: 'สายเข้าโคม / จุด', width: 130, options: plainSizeOptions,
                            get: r => r.wiring.deviceSize.trim(), set: (r, v) => withWiring(r, { deviceSize: v }) },
                        { kind: 'select', key: 'conductors', title: 'จำนวนสาย', width: 140, options: plainConductorOptions,
                            get: r => (r.wiring.conductors ? String(r.wiring.conductors) : ''),
                            set: (r, v) => withWiring(r, { conductors: Number(v) }) },
                        { kind: 'calc', key: 'total', title: 'สายรวม (ม.)', width: 100, get: r => rowTotal(r) },
                    ]}
                />
                <p className="mt-2 text-[12px] text-gray-500">
                    สายรวม = (ระยะสายเมน × จำนวนสาย) + (ระยะสายเข้าโคม/จุด × จำนวนสาย) · วงจรเครื่องใช้ไฟฟ้าไม่มีสายเข้าจุด ปล่อยว่างได้
                </p>
                {(outputs.unassigned ?? 0) > 0 && (
                    <p className="mt-1 text-[12px] text-red-500">
                        มีสาย {formatNumber(outputs.unassigned)} ม. ที่ยังไม่ได้เลือกขนาดหรือจำนวนสาย — ส่วนนี้ยังไม่ถูกคิดเงิน
                    </p>
                )}
            </SheetCard>

            <ResultSummary
                items={[
                    { label: 'สายไฟ THW 1.5 ตร.มม.', value: total('THW 1.5'), unit: 'ม.' },
                    { label: 'สายไฟ THW 2.5 ตร.มม.', value: total('THW 2.5'), unit: 'ม.' },
                    { label: 'สายไฟ THW 4 ตร.มม.', value: total('THW 4'), unit: 'ม.' },
                    ...(total('THW 6') > 0 ? [{ label: 'สายไฟ THW 6 ตร.มม.', value: total('THW 6'), unit: 'ม.' }] : []),
                ]}
                note={total('THW 6') > 0
                    ? <span className="text-orange-600">สาย 6 ตร.มม. ยังไม่มีรายการราคา จึงยังไม่ถูกคิดเงิน</span>
                    : undefined} />
        </>
    );
}
