'use client';

import type { ReactNode } from 'react';
import {
    groundBeam, groundBeamRow, groundBeamTotals, BEAM_BAR_SIZES, BEAM_NAMES, type GroundBeamRow,
} from '@/domain/calculators/ground-beam';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Column title with the Excel group header (row 3/4) above the column header (row 7). */
const head = (group: string, title: string): ReactNode => (
    <>
        <div className="text-[10px] font-normal text-gray-500 leading-tight">{group}</div>
        <div>{title}</div>
    </>
);

const sizeOptions = BEAM_BAR_SIZES.map(s => ({ value: s }));

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

export default function GroundBeamPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(groundBeam);
    const totals = groundBeamTotals(input);

    const newRow = (): GroundBeamRow => {
        const last = input.beams[input.beams.length - 1];
        return last
            ? { ...last, name: '', length: 0 }
            : { name: '', width: 0.2, depth: 0.4, length: 0, leanThickness: 0.05, mainSize: 'DB12', mainCount: 6, stirrupSize: 'RB6', stirrupSpacing: 0.15 };
    };

    return (
        <CalculatorShell def={groundBeam} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานคานคอดิน">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="วัสดุรองพื้น — คอนกรีตหยาบ" value={outputs.lean} unit="ลบ.ม." digits={3} strong />
                    <CalcField label="ไม้แบบ" value={outputs.formwork} unit="ตร.ม." strong />
                    <CalcField label="คอนกรีต โครงสร้าง" value={outputs.concrete} unit="ลบ.ม." digits={3} strong />
                </div>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th}>เหล็กเสริม (กก.)</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {([
                                ['ปริมาณเหล็กเสริมหลัก', totals.main],
                                ['ปริมาณเหล็กปลอก', totals.stirrup],
                            ] as const).map(([label, w]) => (
                                <tr key={label}>
                                    <td className="border border-gray-200 px-2 py-1 text-[13px]">{label}</td>
                                    {REBAR_SIZES.map(s => (
                                        <td key={s} className={td} style={{ background: SHEET_COLORS.calc }}>{formatNumber(w[s])}</td>
                                    ))}
                                </tr>
                            ))}
                            <tr>
                                <td className="border border-gray-200 px-2 py-1 text-[13px] font-semibold">รวม (ส่งเข้า BOQ 8.3)</td>
                                {REBAR_SIZES.map(s => (
                                    <td key={s} className={`${td} font-semibold`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(outputs[`rebar.${s}`])}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title="ข้อมูลคานคอดิน">
                <EditableTable<GroundBeamRow>
                    rows={input.beams}
                    onChange={beams => update({ beams })}
                    newRow={newRow}
                    addLabel="+ เพิ่มคาน"
                    columns={[
                        { kind: 'select', key: 'name', title: 'ชื่อคาน', width: 80, options: BEAM_NAMES.map(n => ({ value: n })),
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: 'ลึก (ม.)', width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'leanThickness', title: head('คอนกรีตหยาบ', 'หนา (ม.)'), width: 70,
                            get: r => r.leanThickness, set: (r, v) => ({ ...r, leanThickness: v }) },
                        { kind: 'calc', key: 'lean', title: head('คอนกรีตหยาบ', 'ปริมาณ (ลบ.ม.)'), width: 80, digits: 3,
                            get: r => groundBeamRow(r).lean },
                        { kind: 'select', key: 'mainSize', title: head('เหล็กเสริมหลัก', 'ขนาด'), width: 90, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head('เหล็กเสริมหลัก', 'จำนวน (เส้น)'), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainLength', title: head('เหล็กเสริมหลัก', 'ความยาว รวม (ม.)'), width: 80,
                            get: r => groundBeamRow(r).mainLength },
                        { kind: 'calc', key: 'mainWeight', title: head('เหล็กเสริมหลัก', 'น้ำหนัก (กก.)'), width: 80,
                            get: r => groundBeamRow(r).mainWeight },
                        { kind: 'select', key: 'stirrupSize', title: head('เหล็กปลอก', 'ขนาด'), width: 90, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head('เหล็กปลอก', 'ระยะห่าง (ม.)'), width: 70,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head('เหล็กปลอก', 'จำนวน (ปลอก)'), width: 70, digits: 0,
                            get: r => groundBeamRow(r).stirrupCount },
                        { kind: 'calc', key: 'stirrupLength', title: head('เหล็กปลอก', 'ความยาว /เส้น (ม.)'), width: 70,
                            get: r => groundBeamRow(r).stirrupLength },
                        { kind: 'calc', key: 'stirrupTotalLength', title: head('เหล็กปลอก', 'ความยาว รวม (ม.)'), width: 80,
                            get: r => groundBeamRow(r).stirrupTotalLength },
                        { kind: 'calc', key: 'stirrupWeight', title: head('เหล็กปลอก', 'น้ำหนัก (กก.)'), width: 80,
                            get: r => groundBeamRow(r).stirrupWeight },
                        { kind: 'calc', key: 'formwork', title: head('ไม้แบบ', 'ไม้แบบ (ตร.ม.)'), width: 80,
                            get: r => groundBeamRow(r).formwork },
                        { kind: 'calc', key: 'concrete', title: head('คอนกรีต', 'คอนกรีต โครงสร้าง (ลบ.ม.)'), width: 90, digits: 3,
                            get: r => groundBeamRow(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>1 แถว = 1 แนวคาน · ความยาวเหล็กเสริมหลัก = จำนวนเส้น × ยาวคาน (ไม่รวมระยะทาบ/งอ ตาม Excel)</li>
                    <li>จำนวนปลอก = ปัดขึ้น (ยาว ÷ ระยะห่าง) · ความยาวปลอก /เส้น = 2 × (กว้าง + ลึก)</li>
                    <li>ไม้แบบ = 2 ด้านข้าง (2 × ลึก × ยาว) — ท้องคานวางบนคอนกรีตหยาบ</li>
                    <li>
                        ส่งเข้า BOQ หมวด 8: คอนกรีตหยาบ {formatNumber(outputs.lean, 3)} ลบ.ม., เหล็กเสริมแยกตามขนาด + ลวดผูกเหล็ก 3%,
                        ไม้แบบ {formatNumber(outputs.formwork)} ตร.ม. (ไม้คร่าว/ตะปูคิดใน BOQ), คอนกรีตโครงสร้าง {formatNumber(outputs.concrete, 3)} ลบ.ม.
                    </li>
                    <li>ถมดินกลับ (8.1) คำนวณมาจากโปรแกรมฐานราก · เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป (8.4) มาจากโปรแกรมพื้นสำเร็จรูป</li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
