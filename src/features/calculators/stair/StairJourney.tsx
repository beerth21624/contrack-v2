'use client';

// Journey-mode body of the stair level: the stair sizes read off the stair detail (total rise and run follow
// steps × riser / tread), then the bars of the waist slab and steps, the formulas folded away, and a short
// result at the end. Same input and formulas as /calc.
import {
    newStairRow, stairRow, withStepChange, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_NAMES, type StairInput, type StairRow,
} from '@/domain/calculators/stair';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EmptyState, ResultSummary, rebarSummaryItem, blankIfZero } from '@/components/sheet/journey';

const nameOptions = STAIR_NAMES.map(v => ({ value: v }));
const sizeOptions = STAIR_BAR_SIZES.map(v => ({ value: v }));

const rowKg = (r: StairRow) => {
    const c = stairRow(r);
    return c.waistMain.kg + c.waistTemp.kg + c.stepMain.kg + c.stepTemp.kg;
};

export function StairJourney({ input, outputs, onChange }: {
    input: StairInput; outputs: Record<string, number>; onChange: (rows: StairRow[]) => void;
}) {
    const rows = input.rows;
    const add = () => onChange([...rows, newStairRow(rows[rows.length - 1])]);
    const label = (r: StairRow, i: number) => r.name === '' ? `บันได ${i + 1}` : r.name;

    return (
        <>
            <SheetCard title="ขนาดบันได" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} ชุด</span> : undefined}>
                {rows.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีบันได — ดูรูปขยายบันได แล้วเพิ่มทีละชุด (กว้าง จำนวนขั้น ลูกตั้ง ลูกนอน)"
                            addLabel="เพิ่มบันไดชุดแรก" onAdd={add} />
                    )
                    : (
                        <>
                            <EditableTable<StairRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newStairRow(rows[i - 1])}
                                addLabel="เพิ่มบันได"
                                columns={[
                                    { kind: 'select', key: 'name', title: 'ชื่อบันได', width: 130, options: nameOptions,
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'steps', title: 'จำนวนขั้น', width: 70, digits: 0,
                                        get: r => r.steps, set: (r, v) => withStepChange(r, { steps: v }) },
                                    { kind: 'number', key: 'riser', title: 'ลูกตั้ง สูง (ม.)', width: 75,
                                        get: r => r.riser, set: (r, v) => withStepChange(r, { riser: v }) },
                                    { kind: 'number', key: 'tread', title: 'ลูกนอน กว้าง (ม.)', width: 75,
                                        get: r => r.tread, set: (r, v) => withStepChange(r, { tread: v }) },
                                    { kind: 'number', key: 'waist', title: 'ท้องบันได หนา (ม.)', width: 80,
                                        get: r => r.waist, set: (r, v) => ({ ...r, waist: v }) },
                                    { kind: 'number', key: 'rise', title: 'สูงรวม (ม.)', width: 75, get: r => r.rise, set: (r, v) => ({ ...r, rise: v }) },
                                    { kind: 'number', key: 'run', title: 'ยาวแนวราบ (ม.)', width: 75, get: r => r.run, set: (r, v) => ({ ...r, run: v }) },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีต (ลบ.ม.)', width: 85, digits: 3,
                                        get: r => blankIfZero(stairRow(r).concrete) },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                สูงรวม = จำนวนขั้น × ลูกตั้ง และ ยาวแนวราบ = จำนวนขั้น × ลูกนอน ระบบเติมให้ — แก้เองได้ถ้าแบบต่างไป
                                (เช่น มีชานพัก)
                            </p>
                        </>
                    )}
            </SheetCard>

            {rows.length > 0 && (
                <SheetCard title="เหล็กเสริมบันได">
                    <EditableTable<StairRow>
                        rows={rows}
                        onChange={onChange}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'name', title: 'บันได', width: 110, get: label },
                            { kind: 'select', key: 'waistMainSize', title: 'ท้องบันได เหล็กหลัก', width: 85, options: sizeOptions,
                                get: r => r.waistMainSize, set: (r, v) => ({ ...r, waistMainSize: v }) },
                            { kind: 'number', key: 'waistMainSpacing', title: 'ห่าง (ม.)', width: 65,
                                get: r => r.waistMainSpacing, set: (r, v) => ({ ...r, waistMainSpacing: v }) },
                            { kind: 'select', key: 'waistTempSize', title: 'ท้องบันได เหล็กกันร้าว', width: 85, options: sizeOptions,
                                get: r => r.waistTempSize, set: (r, v) => ({ ...r, waistTempSize: v }) },
                            { kind: 'number', key: 'waistTempSpacing', title: 'ห่าง (ม.)', width: 65,
                                get: r => r.waistTempSpacing, set: (r, v) => ({ ...r, waistTempSpacing: v }) },
                            { kind: 'select', key: 'stepMainSize', title: 'ลูกบันได เหล็กหลัก', width: 85, options: sizeOptions,
                                get: r => r.stepMainSize, set: (r, v) => ({ ...r, stepMainSize: v }) },
                            { kind: 'number', key: 'stepMainSpacing', title: 'ห่าง (ม.)', width: 65,
                                get: r => r.stepMainSpacing, set: (r, v) => ({ ...r, stepMainSpacing: v }) },
                            { kind: 'select', key: 'stepTempSize', title: 'ลูกบันได เหล็กกันร้าว', width: 85, options: sizeOptions,
                                get: r => r.stepTempSize, set: (r, v) => ({ ...r, stepTempSize: v }) },
                            { kind: 'calc', key: 'kg', title: 'เหล็กรวม (กก.)', width: 85, get: r => blankIfZero(rowKg(r)) },
                        ]}
                    />
                    <p className="mt-2 text-[12px] text-gray-500">
                        ค่าตั้งต้น RB9 ห่าง 0.15 ม. ทุกจุด — แก้ตามรูปขยายบันได · เหล็กกันร้าวลูกบันไดคิดขั้นละ 2 เส้น
                    </p>
                </SheetCard>
            )}

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>ยาวแนวเอียง = √(ยาวแนวราบ² + สูงรวม²)</li>
                    <li>คอนกรีต = ท้องบันได (หนา × ยาวแนวเอียง × กว้าง) + ลูกบันได (จำนวนขั้น × ½ × ลูกนอน × ลูกตั้ง × กว้าง)</li>
                    <li>ไม้แบบ = ท้อง + ข้างท้องบันได + ข้างลูกบันได + ไม้กั้นขั้น · ไม้ค้ำยัน = ปัดขึ้น (พื้นที่ท้อง ÷ 0.6) ต้น</li>
                    <li>เหล็กหลักท้องบันได = ปัดขึ้น (กว้าง ÷ ระยะห่าง) เส้น × (ยาวแนวเอียง + {STAIR_ANCHORAGE} ม. ระยะฝัง)</li>
                    <li>เหล็กกันร้าวท้องบันได = ปัดขึ้น (ยาวแนวเอียง ÷ ระยะห่าง) เส้น × กว้าง</li>
                    <li>เหล็กหลักลูกบันได = ปัดขึ้น (กว้าง ÷ ระยะห่าง) เส้น × (ยาวแนวราบ + สูงรวม) · เหล็กกันร้าวลูกบันได = 2 × จำนวนขั้น × กว้าง</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary items={[
                    { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                    { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                    rebarSummaryItem(outputs),
                ]} />
            )}
        </>
    );
}
