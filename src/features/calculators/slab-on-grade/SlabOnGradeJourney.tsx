'use client';

// Journey-mode body of the slab-on-grade level: the panels read off the slab plan first, the sub-base
// (backfill depth, sand bed) folded away, and a short result at the end. Same input and formulas as /calc.
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    newSlabRow, slabRowCalc, SLAB_BAR_SIZES, SLAB_LAYERS, SLAB_NAMES, type SlabOnGradeInput, type SlabRow,
} from '@/domain/calculators/slab-on-grade';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const nameOptions = SLAB_NAMES.map(v => ({ value: v }));
const sizeOptions = SLAB_BAR_SIZES.map(v => ({ value: v }));
const layerOptions = SLAB_LAYERS.map(v => ({ value: String(v), label: `${v} ชั้น` }));

interface SummaryItem { label: string; value: number; unit: string; digits?: number; detail?: string }

/** Green "what this level comes to" line. */
function ResultSummary({ items, minor }: { items: SummaryItem[]; minor?: SummaryItem[] }) {
    const text = (i: SummaryItem) => `${i.label} ${formatNumber(i.value, i.digits ?? 2)} ${i.unit}${i.detail ? ` (${i.detail})` : ''}`;
    return (
        <div className="rounded-lg border border-green-200 px-4 py-3" style={{ background: SHEET_COLORS.calc }}>
            <div className="text-[12px] font-semibold text-green-800">ผลรวมด่านนี้</div>
            <div className="text-[16px] font-semibold text-gray-900 tabular-nums">{items.map(text).join(' · ')}</div>
            {minor && <div className="text-[12px] text-gray-600 tabular-nums mt-0.5">{minor.map(text).join(' · ')}</div>}
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

export function SlabOnGradeJourney({ input, outputs, onChange }: {
    input: SlabOnGradeInput; outputs: Record<string, number>; onChange: (slabs: SlabRow[]) => void;
}) {
    const rows = input.slabs;
    const add = () => onChange([...rows, newSlabRow(rows[rows.length - 1])]);

    return (
        <>
            <SheetCard title="พื้นแต่ละผืน" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} ผืน</span> : undefined}>
                {rows.length === 0
                    ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="text-[14px] text-gray-600">
                                ยังไม่มีพื้น — ดูแปลนพื้น แล้วเพิ่มทีละผืน (กว้าง × ยาว × หนา และเหล็กเสริม)
                            </div>
                            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={add}>เพิ่มพื้นผืนแรก</Button>
                        </div>
                    )
                    : (
                        <>
                            <EditableTable<SlabRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newSlabRow(rows[i - 1])}
                                addLabel="เพิ่มพื้น"
                                columns={[
                                    { kind: 'select', key: 'name', title: 'ชื่อพื้น', width: 70, options: nameOptions,
                                        get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 75, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 75, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                    { kind: 'number', key: 'thickness', title: 'หนา (ม.)', width: 70, get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                                    { kind: 'select', key: 'barSize', title: 'เหล็กเสริม', width: 85, options: sizeOptions,
                                        get: r => r.barSize, set: (r, v) => ({ ...r, barSize: v }) },
                                    { kind: 'select', key: 'layers', title: 'วางเหล็ก', width: 80, options: layerOptions,
                                        get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                                    { kind: 'number', key: 'spacing', title: 'ระยะห่างเหล็ก (ม.)', width: 80,
                                        get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีต (ลบ.ม.)', width: 85, get: r => slabRowCalc(r).concrete },
                                    { kind: 'calc', key: 'weight', title: 'เหล็ก (กก.)', width: 85, get: r => slabRowCalc(r).weight },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                1 แถว = 1 ผืน (ผืนขนาดเท่ากันเพิ่มแยกแถว) · เช่น แบบเขียน S1 หนา 0.10 ม. RB9 @0.20 ม. 2 ชั้น →
                                หนา 0.1, เหล็กเสริม RB9, วางเหล็ก 2 ชั้น, ระยะห่าง 0.2 · ช่องตัวเลขพิมพ์บวกได้ เช่น 1.5+2.3
                            </p>
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="ดินถมใต้พื้น และทรายรองพื้น" hint="ค่ามาตรฐาน ไม่ต้องแก้ก็ได้">
                {rows.length === 0
                    ? <p className="text-[12px] text-gray-500">เพิ่มพื้นก่อน แล้วค่าดินถมและทรายของแต่ละผืนจะแสดงที่นี่</p>
                    : (
                        <EditableTable<SlabRow>
                            rows={rows}
                            onChange={onChange}
                            canDelete={false}
                            columns={[
                                { kind: 'label', key: 'panel', title: 'พื้น', width: 120,
                                    get: r => `${r.name} ${formatNumber(r.width)} × ${formatNumber(r.length)} ม.` },
                                { kind: 'number', key: 'fillDepth', title: 'ดินถมกลับใต้พื้น ลึก (ม.)', width: 110,
                                    get: r => r.fillDepth, set: (r, v) => ({ ...r, fillDepth: v }) },
                                { kind: 'calc', key: 'backfill', title: 'ดินถม (ลบ.ม.)', width: 90, get: r => slabRowCalc(r).backfill },
                                { kind: 'number', key: 'sandThickness', title: 'ทรายหยาบรองพื้น หนา (ม.)', width: 110,
                                    get: r => r.sandThickness, set: (r, v) => ({ ...r, sandThickness: v }) },
                                { kind: 'calc', key: 'sand', title: 'ทราย (ลบ.ม.)', width: 90, get: r => slabRowCalc(r).sand },
                            ]}
                        />
                    )}
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ยาว × หนา</li>
                    <li>เหล็กเสริม = กว้าง × ยาว ÷ ระยะห่าง × 2 ทิศทาง × จำนวนชั้น (ม.) × น้ำหนักเหล็กต่อเมตร</li>
                    <li>ดินถมกลับ = กว้าง × ยาว × ลึก · ทรายหยาบ = กว้าง × ยาว × หนา + เผื่อ 25% · พลาสติกกันชื้น = กว้าง × ยาว</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary
                    items={[
                        { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.' },
                        rebar(outputs),
                    ]}
                    minor={[
                        { label: 'ทรายหยาบ', value: outputs.sand ?? 0, unit: 'ลบ.ม.' },
                        { label: 'ดินถมกลับ', value: outputs.backfill ?? 0, unit: 'ลบ.ม.' },
                        { label: 'พลาสติกกันชื้น', value: outputs.plastic ?? 0, unit: 'ตร.ม.' },
                    ]}
                />
            )}
        </>
    );
}
