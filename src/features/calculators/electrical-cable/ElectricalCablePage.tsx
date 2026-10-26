'use client';

import Link from 'next/link';
import {
    BLANK_WIRING, cableRows, CONDUCTOR_COUNTS, electricalCable, sizeKey, WIRE_BUCKETS, WIRE_SIZES, type CableRow,
    type CircuitWiring,
} from '@/domain/calculators/electrical-cable';
import { electricalPipe, type Circuit } from '@/domain/calculators/electrical-pipe';
import type { CalcContext } from '@/domain/calculators/types';
import { calculatorInput } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

interface Row {
    circuit: Circuit;
    wiring: CircuitWiring;
    cable?: CableRow;
}

const sizeOptions = [{ value: '', label: '(ว่าง)' }, ...WIRE_SIZES.map(value => ({ value }))];
const tf = 'border border-gray-200 px-2 py-1 text-[13px]';
const HEADER: Record<string, string> = { 'THW 1.5': 'THW #1.5 (ม.)', 'THW 2.5': 'THW #2.5 (ม.)', 'THW 4': 'THW #4 (ม.)', 'THW 6': 'THW #6 (ม.)' };

export default function ElectricalCablePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(electricalCable);
    // One circuit list (decision on oddity D4): names, CB and lengths come from the conduit sheet.
    const project = useProjectStore(s => s.project);
    const pipeInput = calculatorInput(project, electricalPipe);
    const pipeOut = result.calcOutputs['electrical-pipe'] ?? electricalPipe.compute(pipeInput, { outputs: () => undefined });
    const ctx: CalcContext = { outputs: id => (id === 'electrical-pipe' ? pipeOut : result.calcOutputs[id]) };
    const byId = new Map(cableRows(input, ctx).map(r => [r.id, r]));
    const rows: Row[] = pipeInput.circuits.map(circuit => ({
        circuit, wiring: input.wiring[circuit.id] ?? BLANK_WIRING, cable: byId.get(circuit.id),
    }));
    const total = (size: string) => outputs[sizeKey(size)] ?? 0;
    const withWiring = (r: Row, patch: Partial<CircuitWiring>): Row => ({ ...r, wiring: { ...r.wiring, ...patch } });

    return (
        <CalculatorShell def={electricalCable} result={result} isDefault={isDefault} onReset={reset}>
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
        </CalculatorShell>
    );
}
