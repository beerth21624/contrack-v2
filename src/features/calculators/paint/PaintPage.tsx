'use client';

import { Button } from 'antd';
import {
    paint, paintLinkedSources, paintSuggestions, mouldingArea, PAINT_LINES, type MouldingRun, type PaintLineKey,
} from '@/domain/calculators/paint';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber, SHEET_COLORS } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] align-middle';

/** Excel rows 5–6 of the moulding list are the sheet's fixed runs (บัว 0.3, บัว 0.1). */
const FIXED_MOULDINGS = 2;

/** PAINT_LINES[].boq lists the rows of these sections, in this order. */
const SECTIONS = paint.sections;

/** "ใช้ค่าจาก …" — the value another sheet offers for a hand-typed Excel number (decision D20 pending). */
function SourceHint({ sheet, value, current, unit, onUse }: {
    sheet: string; value: number | undefined; current: number; unit: string; onUse: (v: number) => void;
}) {
    if (value === undefined) {
        return <span className="text-[12px] text-gray-400">ยังไม่มีค่าจาก {sheet}</span>;
    }
    const same = Math.abs(value - current) < 1e-9;
    return (
        <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-gray-600">
            <span>ค่าจาก {sheet}: <b className="tabular-nums">{formatNumber(value, 2)}</b> {unit}</span>
            <Button size="small" disabled={same} onClick={() => onUse(value)}>
                {same ? 'ตรงกับค่าในชีตแล้ว' : `ใช้ค่าจาก ${sheet}`}
            </Button>
        </span>
    );
}

export default function PaintPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(paint);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const linked = paintLinkedSources(ctx);
    const suggest = paintSuggestions(ctx);

    const fromExcel = (sheet: string) => `ค่าจาก Excel (ยังไม่มีชีต ${sheet})`;
    const source: Record<PaintLineKey, string> = {
        wallExterior: linked.plaster ? 'ฉาบปูน_Plaster — รวม "ฉาบภายนอก"' : fromExcel('ฉาบปูน_Plaster'),
        wallInterior: linked.plaster ? 'ฉาบปูน_Plaster — รวม "ฉาบภายใน"' : fromExcel('ฉาบปูน_Plaster'),
        ceilingExterior: linked.ceilingExterior ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ภายนอก"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        ceilingInterior: linked.ceilingInterior ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ภายใน"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        ceilingSlat: linked.ceilingSlat ? 'ฝ้าเพดาน_Ceiling — แยกงานทาสี "ทาสีฝ้า - ไม้ระแนง"' : fromExcel('ฝ้าเพดาน_Ceiling'),
        wallSlat: 'กรอกเอง (ข้อ 6 ด้านล่าง)',
        moulding: 'ความกว้างรอบรูป × ความยาว (ข้อ 7 ด้านล่าง)',
        fascia: 'ความยาว × ความสูงเชิงชาย (ข้อ 8 ด้านล่าง)',
        skim: '= ข้อ 1 + ข้อ 2 (พื้นที่ฉาบภายนอก + ภายใน)',
    };

    const setMoulding = (i: number, patch: Partial<MouldingRun>) => update(p => ({
        ...p, mouldings: p.mouldings.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));

    return (
        <CalculatorShell def={paint} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="ตารางคำนวณปริมาณทาสี">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th} style={{ width: 48 }}>ลำดับ</th>
                                <th className={th}>แยกส่วนผนัง</th>
                                <th className={th} style={{ width: 110 }}>พื้นที่ (ตร.ม.)</th>
                                <th className={th}>ที่มา</th>
                                <th className={th} style={{ width: 120 }}>ส่งเข้า BOQ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PAINT_LINES.map((l, i) => (
                                <tr key={l.key}>
                                    <td className={`${td} text-center text-gray-500`}>{i + 1}</td>
                                    <td className={td}>{l.label}</td>
                                    <td className={`${td} text-right tabular-nums`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(outputs[l.key])}
                                    </td>
                                    <td className={`${td} text-[12px] text-gray-600`}>{source[l.key]}</td>
                                    <td className={`${td} text-[12px] text-gray-600`}>
                                        {l.boq.map((r, j) => `§${SECTIONS[j]} แถว ${r.slice(1)}`).join(' · ')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    พื้นที่ทั้ง 8 รายการใช้เป็นปริมาณของงานทาสีรองพื้น (ขั้นตอน 23), ทาสีจริง รอบที่ 1 (25) และทาสีรอบสุดท้าย (31);
                    งานฉาบบาง (สกิมโค๊ท) อยู่ในขั้นตอน 23 เท่านั้น — ราคาต่อหน่วยแก้ได้ที่หน้า BOQ แยกตามขั้นตอน
                </p>
            </SheetCard>

            <SheetCard title="6. ทาสีผนัง - ไม้ระแนง">
                <InputNumberField label="พื้นที่ผนังไม้ระแนง" unit="ตร.ม." value={input.slatWallArea}
                    onChange={v => update({ slatWallArea: v })} />
                <div className="py-1">
                    <SourceHint sheet="ตกแต่งผนัง (ระแนง)" value={suggest.slatWallArea} current={input.slatWallArea}
                        unit="ตร.ม." onUse={v => update({ slatWallArea: v })} />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">ค่าตัวอย่าง Excel: =3.3+4.8 (พิมพ์ไว้ในสูตร)</p>
            </SheetCard>

            <SheetCard title="7. ทาสีผนัง - บัว">
                <EditableTable<MouldingRun>
                    rows={input.mouldings}
                    onChange={mouldings => update({ mouldings })}
                    lockedRows={FIXED_MOULDINGS}
                    newRow={() => ({ size: '', girth: 0, length: 0 })}
                    addLabel="+ เพิ่มบัว"
                    columns={[
                        {
                            kind: 'text', key: 'size', title: 'ขนาดบัว (ม.)', width: 90, placeholder: 'เช่น 0.3',
                            get: r => r.size, set: (r, v) => ({ ...r, size: v.trim() }),
                        },
                        {
                            kind: 'number', key: 'girth', title: 'ความกว้างรอบรูป (ม.)', width: 110,
                            get: r => r.girth, set: (r, v) => ({ ...r, girth: v }),
                        },
                        {
                            kind: 'number', key: 'length', title: 'ความยาว (ม.)', width: 100,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }),
                        },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 100, get: r => mouldingArea(r) },
                        {
                            kind: 'label', key: 'source', title: 'ความยาวจากชีตตกแต่งผนัง',
                            get: (r, i) => (
                                <SourceHint sheet={`ตกแต่งผนัง (บัว ${r.size})`} value={suggest.mouldingLength(r.size)}
                                    current={r.length} unit="ม." onUse={v => setMoulding(i, { length: v })} />
                            ),
                        },
                    ]}
                />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="รวมพื้นที่ทาสีบัว" value={outputs.moulding} unit="ตร.ม." strong />
                </div>
                <p className="mt-1 text-[12px] text-gray-500">
                    ความกว้างรอบรูป = หน้าบัว + 2 × ความหนา (บัว 0.3×0.1 → 0.5 ม., บัว 0.1×0.1 → 0.3 ม.).
                    ค่าตัวอย่าง Excel: =(0.5*13)+(0.3*11)
                </p>
            </SheetCard>

            <SheetCard title="8. ทาสีผนัง - เชิงชาย">
                <InputNumberField label="ความยาวเชิงชาย" unit="ม." value={input.fasciaLength}
                    onChange={v => update({ fasciaLength: v })} />
                <div className="py-1">
                    <SourceHint sheet="มุงหลังคา (ไม้เชิงชาย)" value={suggest.fasciaLength} current={input.fasciaLength}
                        unit="ม." onUse={v => update({ fasciaLength: v })} />
                </div>
                <InputNumberField label="ความสูงเชิงชาย" unit="ม." value={input.fasciaHeight}
                    onChange={v => update({ fasciaHeight: v })} />
                <CalcField label="พื้นที่ทาสีเชิงชาย" value={outputs.fascia} unit="ตร.ม." strong />
                <p className="mt-1 text-[12px] text-gray-500">
                    ค่าตัวอย่าง Excel: =63.2*0.23 (ชีตมุงหลังคาใช้ความยาวไม้เชิงชาย 62.3 ม. — รอยืนยัน)
                </p>
            </SheetCard>

            <p className="text-[12px] text-gray-500 px-1">
                ข้อ 6–8 Excel พิมพ์ตัวเลขไว้ในสูตร — ค่าเริ่มต้นตาม Excel; กด &quot;ใช้ค่าจาก …&quot; เพื่อดึงค่าจากชีตต้นทาง
            </p>
        </CalculatorShell>
    );
}
