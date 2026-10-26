'use client';

// Journey-mode body of the roof-beam level: one row per beam read off the roof-beam plan, the formulas folded
// away, and a short result at the end. Same input and formulas as /calc.
import {
    newRoofBeamRow, roofBeamRow, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamInput, type RoofBeamRow,
} from '@/domain/calculators/roof-beam';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { EmptyState, ResultSummary, rebarSummaryItem, blankIfZero } from '@/components/sheet/journey';

const nameOptions = ROOF_BEAM_NAMES.map(v => ({ value: v }));
const sizeOptions = ROOF_BEAM_BAR_SIZES.map(v => ({ value: v }));

export function RoofBeamJourney({ input, outputs, onChange }: {
    input: RoofBeamInput; outputs: Record<string, number>; onChange: (rows: RoofBeamRow[]) => void;
}) {
    const rows = input.rows;
    const add = () => onChange([...rows, newRoofBeamRow(rows[rows.length - 1])]);

    return (
        <>
            <SheetCard title="คานแต่ละเส้น" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} แถว</span> : undefined}>
                {rows.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีคาน — ดูแปลนคานชั้นหลังคา (RB) แล้วเพิ่มทีละแนวคาน (ขนาด ความยาว และเหล็กเสริม)"
                            addLabel="เพิ่มคานเส้นแรก" onAdd={add} />
                    )
                    : (
                        <>
                            <EditableTable<RoofBeamRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newRoofBeamRow(rows[i - 1])}
                                addLabel="เพิ่มคาน"
                                columns={[
                                    { kind: 'select', key: 'name', title: 'ชื่อคาน', width: 75, options: nameOptions,
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'depth', title: 'ลึก (ม.)', width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                                    { kind: 'number', key: 'length', title: 'ยาวรวม (ม.)', width: 85, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                    { kind: 'select', key: 'mainSize', title: 'เหล็กแกน', width: 85, options: sizeOptions,
                                        get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                                    { kind: 'number', key: 'mainCount', title: 'เหล็กแกน (เส้น)', width: 75, digits: 0,
                                        get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                                    { kind: 'select', key: 'stirrupSize', title: 'เหล็กปลอก', width: 85, options: sizeOptions,
                                        get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                                    { kind: 'number', key: 'stirrupSpacing', title: 'ปลอกห่าง (ม.)', width: 75,
                                        get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีต (ลบ.ม.)', width: 85, digits: 3,
                                        get: r => blankIfZero(roofBeamRow(r).concrete) },
                                    { kind: 'calc', key: 'weight', title: 'เหล็ก (กก.)', width: 85,
                                        get: r => { const c = roofBeamRow(r); return blankIfZero(c.mainKg + c.stirrupKg); } },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                คานขนาดและเหล็กเหมือนกันรวมเป็นแถวเดียวได้ — พิมพ์ความยาวทุกช่วงบวกกัน เช่น 4+4.5+3 ·
                                เหล็กแกน = จำนวนเหล็กบน + ล่าง เช่น แบบเขียน 3-DB12 บน 3-DB12 ล่าง → DB12 6 เส้น
                            </p>
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ลึก × ยาว · ไม้แบบ = ข้าง 2 ด้าน (2 × ลึก × ยาว) + ท้องคาน (กว้าง × ยาว)</li>
                    <li>ไม้ค้ำยัน = ปัดขึ้น (ยาว ÷ 0.6) ต้น</li>
                    <li>เหล็กแกน = จำนวนเส้น × ยาว · เหล็กปลอก = ปัดขึ้น (ยาว ÷ ระยะห่าง) ปลอก × 2 × (กว้าง + ลึก)</li>
                    <li>เหล็กเสริมแยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary items={[
                    { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                    { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                    { label: 'ไม้ค้ำยัน', value: outputs.props ?? 0, unit: 'ต้น', digits: 0 },
                    rebarSummaryItem(outputs),
                ]} />
            )}
        </>
    );
}
