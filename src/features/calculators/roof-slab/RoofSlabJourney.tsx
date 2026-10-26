'use client';

// Journey-mode body of the roof-slab level: the panels read off the roof-slab plan first, the formulas folded
// away, and a short result at the end. Same input and formulas as /calc.
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    newRoofSlabRow, roofSlabRow, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabInput, type RoofSlabRow,
} from '@/domain/calculators/roof-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const nameOptions = ROOF_SLAB_NAMES.map(v => ({ value: v }));
const sizeOptions = ROOF_SLAB_BAR_SIZES.map(v => ({ value: v }));
const layerOptions = ROOF_SLAB_LAYERS.map(v => ({ value: String(v), label: `${v} ชั้น` }));

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

export function RoofSlabJourney({ input, outputs, onChange }: {
    input: RoofSlabInput; outputs: Record<string, number>; onChange: (rows: RoofSlabRow[]) => void;
}) {
    const rows = input.rows;
    const add = () => onChange([...rows, newRoofSlabRow(rows[rows.length - 1])]);

    return (
        <>
            <SheetCard title="พื้นดาดฟ้าแต่ละผืน" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} ผืน</span> : undefined}>
                {rows.length === 0
                    ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="text-[14px] text-gray-600">
                                ยังไม่มีพื้นดาดฟ้า — ดูแปลนพื้นดาดฟ้า (RS) แล้วเพิ่มทีละผืน (กว้าง × ยาว × หนา และเหล็กเสริม)
                            </div>
                            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={add}>เพิ่มพื้นผืนแรก</Button>
                        </div>
                    )
                    : (
                        <>
                            <EditableTable<RoofSlabRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newRoofSlabRow(rows[i - 1])}
                                addLabel="เพิ่มพื้น"
                                columns={[
                                    { kind: 'select', key: 'name', title: 'ชื่อพื้น', width: 70, options: nameOptions,
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 75, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 75, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                    { kind: 'number', key: 'thickness', title: 'หนา (ม.)', width: 70,
                                        get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                                    { kind: 'select', key: 'size', title: 'เหล็กเสริม', width: 85, options: sizeOptions,
                                        get: r => r.size, set: (r, v) => ({ ...r, size: v }) },
                                    { kind: 'select', key: 'layers', title: 'วางเหล็ก', width: 80, options: layerOptions,
                                        get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                                    { kind: 'number', key: 'spacing', title: 'ระยะห่างเหล็ก (ม.)', width: 80,
                                        get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีต (ลบ.ม.)', width: 85, digits: 3,
                                        get: r => roofSlabRow(r).concrete },
                                    { kind: 'calc', key: 'kg', title: 'เหล็ก (กก.)', width: 85, get: r => roofSlabRow(r).kg },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                1 แถว = 1 ผืน · เช่น แบบเขียน S1 หนา 0.10 ม. RB9 @0.20 ม. 2 ชั้น → หนา 0.1, เหล็กเสริม RB9,
                                วางเหล็ก 2 ชั้น, ระยะห่าง 0.2 · ช่องตัวเลขพิมพ์บวกได้ เช่น 1.5+2.3
                            </p>
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ยาว × หนา · ไม้แบบท้องพื้น = กว้าง × ยาว · ไม้ค้ำยัน = ปัดขึ้น (พื้นที่ ÷ 0.6) ต้น</li>
                    <li>เหล็กเสริม = กว้าง × ยาว ÷ ระยะห่าง × 2 ทิศทาง × จำนวนชั้น (ม.) × น้ำหนักเหล็กต่อเมตร</li>
                    <li>เหล็กเสริมแยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary items={[
                    { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                    { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                    { label: 'ไม้ค้ำยัน', value: outputs.props ?? 0, unit: 'ต้น', digits: 0 },
                    rebar(outputs),
                ]} />
            )}
        </>
    );
}
