'use client';

import {
    wallFinishing, wallFinishingArea, wallFinishingLength, MOULDING_0_1, MOULDING_0_3, SLAT_WALL,
    WALL_FINISHING_CODES, WALL_FINISHING_ITEMS, type WallFinishingRow,
} from '@/domain/calculators/wall-finishing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

export default function WallFinishingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(wallFinishing);

    return (
        <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวผนัง">
                <EditableTable<WallFinishingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', item: '', width: 0, length: 0, location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: WALL_FINISHING_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                        { kind: 'select', key: 'item', title: 'รายการ', width: 300,
                            options: WALL_FINISHING_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'total-length', title: 'ยาว (ม.)', width: 80, get: r => wallFinishingLength(r) },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 90, get: r => wallFinishingArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 130,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>บัวตกแต่งผนัง: ยาว (ม.) = กว้าง + ยาว (ตัวอย่าง Excel กรอกกว้าง = 0) → ส่งเข้า BOQ เป็นเมตร</li>
                    <li>กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด: พื้นที่ (ตร.ม.) = กว้าง × ยาว → ส่งเข้า BOQ และงานทาสีผนัง - ไม้ระแนง</li>
                    <li>หัวคอลัมน์ใน Excel สลับกัน (&quot;ตำแหน่ง&quot; เก็บชื่อรายการ, &quot;รายการ&quot; เก็บตำแหน่ง) — หน้านี้แสดงตามความหมายจริง</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปปริมาณ (ส่งเข้า BOQ หมวด 22)">
                <CalcField label={MOULDING_0_3} value={outputs.R218} unit="ม." strong />
                <CalcField label={MOULDING_0_1} value={outputs.R219} unit="ม." strong />
                <CalcField label={SLAT_WALL} value={outputs.R220} unit="ตร.ม." strong />
                <p className="mt-2 text-[12px] text-gray-500">
                    แก้จาก Excel: ใน Excel แถว BOQ &quot;บัว ขนาด 0.3&quot; (ราคา 400/200) รวมความยาวของบัว 0.1 และแถว
                    &quot;บัว ขนาด 0.1&quot; (180/100) รวมความยาวของบัว 0.3 — ที่นี่แต่ละแถวรวมความยาวของบัวขนาดของตัวเอง
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
