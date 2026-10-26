'use client';

import Link from 'next/link';
import {
    BREAKER_SIZES, circuitTotal, electricalPipe, newCircuit, PIPE_TYPES, pipeTypeKey, setDeviceV,
    type Circuit, type ElectricalPipeInput,
} from '@/domain/calculators/electrical-pipe';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';
import { ElectricalPipeJourney } from './ElectricalPipeJourney';

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
            {inJourney ? <ElectricalPipeJourney calc={calc} /> : <SheetPipe calc={calc} />}
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
