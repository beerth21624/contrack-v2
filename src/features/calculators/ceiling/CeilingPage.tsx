'use client';

import {
    ceiling, ceilingRowArea, CEILING_CODES, CEILING_DESCRIPTIONS, CEILING_DESCRIPTION_ORDER, CEILING_PAINT_GROUPS,
    paintGroupLabel, paintKey, SLOPED_CEILING_DEG, type CeilingCode, type CeilingPaintGroup, type CeilingRow,
} from '@/domain/calculators/ceiling';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const isCode = (v: string): v is CeilingCode => (CEILING_CODES as readonly string[]).includes(v);
const isPaint = (v: string): v is CeilingPaintGroup => (CEILING_PAINT_GROUPS as readonly string[]).includes(v);

export default function CeilingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(ceiling);

    return (
        <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณฝ้าเพดาน">
                <EditableTable<CeilingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', width: 0, length: 0, location: '', paint: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: CEILING_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                        { kind: 'select', key: 'desc', title: 'รายการ', width: 380,
                            options: CEILING_DESCRIPTION_ORDER.map(c => ({ value: c, label: CEILING_DESCRIPTIONS[c] })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'slope', title: 'ลาดเอียง (องศา)', width: 80, digits: 0,
                            get: r => r.slope ?? 0, set: (r, v) => ({ ...r, slope: v }) },
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 90, get: r => ceilingRowArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 150,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                        { kind: 'select', key: 'paint', title: 'แยกงานทาสี', width: 150,
                            options: CEILING_PAINT_GROUPS.map(g => ({ value: g, label: paintGroupLabel(g) })),
                            get: r => r.paint, set: (r, v) => ({ ...r, paint: isPaint(v) ? v : '' }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ตร.ม.) = กว้าง × ยาว</li>
                    <li>
                        ฝ้าลาดเอียง (เช่น ฝ้าเฉลียงใต้หลังคา): รวม = กว้าง × ยาว ÷ cos(องศา) — ตัวอย่าง Excel เฉลียง 1–2
                        ใช้ {SLOPED_CEILING_DEG}° (ฝ้าเรียบใส่ 0)
                    </li>
                    <li>สัญลักษณ์ C1–C4 ใช้รวมปริมาณเข้า BOQ หมวด 19 · แยกงานทาสี ใช้รวมพื้นที่ทาสีฝ้าในโปรแกรมงานทาสี</li>
                </ul>
            </SheetCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SheetCard title="สรุปพื้นที่ฝ้าเพดาน (ส่งเข้า BOQ หมวด 19)">
                    {CEILING_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${CEILING_DESCRIPTIONS[c]}`} value={outputs[c]} unit="ตร.ม." />
                    ))}
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="ตร.ม." strong />
                </SheetCard>
                <SheetCard title="สรุปพื้นที่ทาสีฝ้า (ส่งเข้าโปรแกรมงานทาสี)">
                    {CEILING_PAINT_GROUPS.map(g => (
                        <CalcField key={g} label={paintGroupLabel(g)} value={outputs[paintKey(g)]} unit="ตร.ม." />
                    ))}
                </SheetCard>
            </div>
        </CalculatorShell>
    );
}
