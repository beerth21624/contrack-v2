'use client';

// Journey-mode body of the column level: one row per column type (C1, C2 …) read off the column plan and
// detail, the formulas folded away, and a short result at the end. Same input and formulas as /calc.
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    columnRowCalc, COLUMN_BAR_SIZES, COLUMN_NAMES, newColumnRow, type ColumnInput, type ColumnRow,
} from '@/domain/calculators/column';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const nameOptions = COLUMN_NAMES.map(v => ({ value: v }));
const sizeOptions = COLUMN_BAR_SIZES.map(v => ({ value: v }));

interface SummaryItem { label: string; value: number; unit: string; digits?: number; detail?: string }

/** Green "what this level comes to" line. */
function ResultSummary({ items }: { items: SummaryItem[] }) {
    const text = (i: SummaryItem) => `${i.label} ${formatNumber(i.value, i.digits ?? 2)} ${i.unit}${i.detail ? ` (${i.detail})` : ''}`;
    return (
        <div className="rounded-lg border border-green-200 px-4 py-3" style={{ background: SHEET_COLORS.calc }}>
            <div className="text-[12px] font-semibold text-green-800">ผลรวมด่านนี้</div>
            <div className="text-[16px] font-semibold text-gray-900 tabular-nums">{items.map(text).join(' · ')}</div>
        </div>
    );
}

/** Rebar kg of the level, with the sizes used. */
function rebar(outputs: Record<string, number>): SummaryItem {
    const used = REBAR_SIZES.filter(s => (outputs[`rebar.${s}`] ?? 0) > 0);
    const total = REBAR_SIZES.reduce((s, size) => s + (outputs[`rebar.${size}`] ?? 0), 0);
    return {
        label: 'เหล็กเสริม', value: total, unit: 'กก.', digits: 1,
        detail: used.length > 1 ? used.map(s => `${s} ${formatNumber(outputs[`rebar.${s}`], 1)}`).join(', ') : used[0],
    };
}

export function ColumnJourney({ input, outputs, onChange }: {
    input: ColumnInput; outputs: Record<string, number>; onChange: (columns: ColumnRow[]) => void;
}) {
    const rows = input.columns;
    const add = () => onChange([...rows, newColumnRow(rows[rows.length - 1])]);
    const count = rows.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0);

    return (
        <>
            <SheetCard title="เสาแต่ละแบบ" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} แบบ · {formatNumber(count, 0)} ต้น</span> : undefined}>
                {rows.length === 0
                    ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="text-[14px] text-gray-600">
                                ยังไม่มีเสา — ดูแปลนเสาและรูปขยายเสา แล้วเพิ่มทีละแบบ (C1, C2 …) พร้อมจำนวนต้น
                            </div>
                            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={add}>เพิ่มเสาแบบแรก</Button>
                        </div>
                    )
                    : (
                        <>
                            <EditableTable<ColumnRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newColumnRow(rows[i - 1])}
                                addLabel="เพิ่มเสาอีกแบบ"
                                columns={[
                                    { kind: 'select', key: 'name', title: 'ชื่อเสา', width: 70, options: nameOptions,
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    { kind: 'number', key: 'count', title: 'จำนวน (ต้น)', width: 70, digits: 0,
                                        get: r => r.count, set: (r, v) => ({ ...r, count: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'depth', title: 'ยาว (ม.)', width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                                    { kind: 'number', key: 'height', title: 'สูง (ม.)', width: 70, get: r => r.height, set: (r, v) => ({ ...r, height: v }) },
                                    { kind: 'select', key: 'mainSize', title: 'เหล็กยืน', width: 85, options: sizeOptions,
                                        get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                                    { kind: 'number', key: 'mainCount', title: 'เหล็กยืน (เส้น/ต้น)', width: 80, digits: 0,
                                        get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                                    { kind: 'select', key: 'stirrupSize', title: 'เหล็กปลอก', width: 85, options: sizeOptions,
                                        get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                                    { kind: 'number', key: 'stirrupSpacing', title: 'ปลอกห่าง (ม.)', width: 75,
                                        get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีต (ลบ.ม.)', width: 85, get: r => columnRowCalc(r).concrete },
                                    { kind: 'calc', key: 'weight', title: 'เหล็ก (กก.)', width: 85,
                                        get: r => { const c = columnRowCalc(r); return c.mainWeight + c.stirrupWeight; } },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                เช่น รูปขยายเขียน C1 0.20×0.20 ม. 6-DB12 ปลอก RB6@0.15 ม. → กว้าง 0.2, ยาว 0.2, เหล็กยืน DB12 6 เส้น,
                                เหล็กปลอก RB6 ห่าง 0.15 · สูง = จากหลังฐานรากถึงใต้คานบน พิมพ์บวกได้ เช่น 0.55+3.5
                            </p>
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = จำนวนต้น × กว้าง × ยาว × สูง · ไม้แบบ = จำนวนต้น × 2 × (กว้าง + ยาว) × สูง</li>
                    <li>เหล็กยืน = จำนวนต้น × จำนวนเส้น × ความสูงเสา</li>
                    <li>เหล็กปลอก = ปัดขึ้น (สูง ÷ ระยะห่าง) ปลอกต่อต้น × 2 × (กว้าง + ยาว)</li>
                    <li>เหล็กเสริมเสานับรวมในงานเหล็กเสริม แยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary items={[
                    { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.' },
                    { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                    rebar(outputs),
                ]} />
            )}
        </>
    );
}
