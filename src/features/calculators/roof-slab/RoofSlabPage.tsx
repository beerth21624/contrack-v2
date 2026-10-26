'use client';

import type { ReactNode } from 'react';
import {
    roofSlab, roofSlabRow, roofSlabTotals, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabRow,
} from '@/domain/calculators/roof-slab';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '../roof-beam/RebarSummary';

const sizeOptions = ROOF_SLAB_BAR_SIZES.map(value => ({ value }));
const nameOptions = ROOF_SLAB_NAMES.map(value => ({ value }));
const layerOptions = ROOF_SLAB_LAYERS.map(n => ({ value: String(n) }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

const REBAR = 'เหล็กเสริมหลัก';

export default function RoofSlabPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofSlab);
    const rows = input.rows.map(roofSlabRow);
    const totals = roofSlabTotals(input);
    const res = (i: number) => rows[i];

    return (
        <CalculatorShell def={roofSlab} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานพื้นดาดฟ้า">
                <RebarSummary groups={[{ label: 'ปริมาณเหล็กเสริมหลัก (กก.)', kg: totals.rebar }]} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="ไม้ค้ำยัน (ต้น)" value={outputs.props} unit="ต้น" digits={0} strong />
                    <CalcField label="ไม้แบบ (ตร.ม.)" value={outputs.formwork} unit="ตร.ม." strong />
                    <CalcField label="คอนกรีต โครงสร้าง (ลบ.ม.)" value={outputs.concrete} unit="ลบ.ม." digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title="ตารางพื้นดาดฟ้า">
                <EditableTable<RoofSlabRow>
                    rows={input.rows}
                    onChange={next => update({ rows: next })}
                    newRow={() => ({ name: '', width: 0, length: 0, thickness: 0, size: '', layers: 2, spacing: 0 })}
                    addLabel="+ เพิ่มแผ่นพื้น"
                    columns={[
                        { kind: 'select', key: 'name', title: 'ชื่อพื้น', width: 80, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'number', key: 'thickness', title: 'หนา (ม.)', width: 70,
                            get: r => r.thickness, set: (r, v) => ({ ...r, thickness: v }) },
                        { kind: 'select', key: 'size', title: head(REBAR, 'ขนาด'), width: 90, options: sizeOptions,
                            get: r => r.size, set: (r, v) => ({ ...r, size: v }) },
                        { kind: 'select', key: 'layers', title: head(REBAR, 'วางเหล็ก (ชั้น)'), width: 70, options: layerOptions,
                            get: r => String(r.layers), set: (r, v) => ({ ...r, layers: Number(v) }) },
                        { kind: 'number', key: 'spacing', title: head(REBAR, 'ระยะห่าง (ม.)'), width: 70,
                            get: r => r.spacing, set: (r, v) => ({ ...r, spacing: v }) },
                        { kind: 'calc', key: 'barLength', title: head(REBAR, 'ยาวรวม (ม.)'), width: 90, get: (_, i) => res(i)?.barLength ?? null },
                        { kind: 'calc', key: 'kg', title: head(REBAR, 'น้ำหนัก (กก.)'), width: 90, get: (_, i) => res(i)?.kg ?? null },
                        { kind: 'calc', key: 'props', title: head('ไม้แบบ', 'ไม้ค้ำยัน (ต้น)'), width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
                        { kind: 'calc', key: 'formwork', title: head('ไม้แบบ', 'ไม้แบบ (ตร.ม.)'), width: 80, get: (_, i) => res(i)?.formwork ?? null },
                        { kind: 'calc', key: 'concrete', title: head('คอนกรีต', 'คอนกรีต โครงสร้าง (ลบ.ม.)'), width: 90, digits: 3,
                            get: (_, i) => res(i)?.concrete ?? null },
                    ]}
                />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>ยาวรวม = (กว้าง × ยาว ÷ ระยะห่าง) × 2 ทิศทาง × จำนวนชั้น · ไม้แบบ = กว้าง × ยาว (ท้องพื้น)</p>
                    <p>ไม้ค้ำยัน = ปัดขึ้น(พื้นที่ ÷ 0.6) ต้น ตามวิธีคิดใน Excel</p>
                    <p>เหล็กเสริมส่งเข้า BOQ แยกตามขนาด พร้อม %เผื่อตามขนาด (RB6 6 %, RB9 9 %, DB12–DB16 12 %) และลวดผูกเหล็ก 3 %</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
