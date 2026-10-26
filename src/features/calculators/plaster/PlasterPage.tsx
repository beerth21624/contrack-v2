'use client';

import {
    plaster, plasterRowArea, PLASTER_KINDS, PLASTER_SIDES, PLASTER_WALL_PARTS, STRUCTURAL_WALL,
    STRUCTURAL_WALL_DEFAULT_AREA, type PlasterRow,
} from '@/domain/calculators/plaster';
import { netByPartKey } from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const isStructural = (r: PlasterRow) => r.wallPart.trim() === STRUCTURAL_WALL;

export default function PlasterPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(plaster);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const brickNet = (part: string) => result.calcOutputs.brick?.[netByPartKey(part)] ?? 0;

    const setRow = (i: number, patch: Partial<PlasterRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    return (
        <CalculatorShell def={plaster} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณปูนฉาบ">
                <EditableTable<PlasterRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ wallPart: '', kind: '', sides: 1 })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'wallPart', title: 'แยกส่วนผนัง', width: 160,
                            options: PLASTER_WALL_PARTS.map(v => ({ value: v })),
                            get: r => r.wallPart,
                            set: (r, v) => ({
                                ...r, wallPart: v,
                                manualArea: v === STRUCTURAL_WALL ? (r.manualArea ?? STRUCTURAL_WALL_DEFAULT_AREA) : r.manualArea,
                            }) },
                        { kind: 'select', key: 'kind', title: 'รายการ', width: 120, options: PLASTER_KINDS.map(v => ({ value: v })),
                            get: r => r.kind.trim(), set: (r, v) => ({ ...r, kind: v }) },
                        { kind: 'select', key: 'sides', title: 'ฉาบกี่ด้าน', width: 80,
                            options: PLASTER_SIDES.map(v => ({ value: String(v) })),
                            get: r => (r.sides ? String(r.sides) : ''), set: (r, v) => ({ ...r, sides: Number(v) }) },
                        {
                            kind: 'label', key: 'perSide', title: 'พื้นที่ผนัง ต่อด้าน (ตร.ม.)', width: 120,
                            get: (r, i) => (isStructural(r)
                                ? <NumberCell value={r.manualArea ?? 0} ariaLabel="พื้นที่ผนังโครงสร้าง ต่อด้าน"
                                    onCommit={v => setRow(i, { manualArea: v ?? STRUCTURAL_WALL_DEFAULT_AREA })} />
                                : (
                                    <div className="text-right tabular-nums px-1" style={{ background: SHEET_COLORS.calc }}>
                                        {r.wallPart.trim() ? formatNumber(brickNet(r.wallPart)) : ''}
                                    </div>
                                )),
                        },
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => plasterRowArea(r, ctx) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม = พื้นที่ก่ออิฐสุทธิของส่วนผนังนี้ (ทุกชนิดอิฐ/ความหนา จากโปรแกรมก่ออิฐ) × จำนวนด้านที่ฉาบ</li>
                    <li>
                        ผนังโครงสร้าง (เสา/คาน) ไม่มีในงานก่ออิฐ — กรอกพื้นที่ต่อด้านเอง
                        (ค่าตัวอย่าง Excel = 1×25 + 0.8×2.6×3 = 31.24 ตร.ม.)
                    </li>
                    <li>ผนังรอบบ้าน: ฉาบภายใน 1 ด้าน + ภายนอก 1 ด้าน · ผนังภายในบ้าน: ฉาบภายใน 2 ด้าน · ผนังภายนอกบ้าน: ฉาบภายนอก 2 ด้าน</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่ฉาบปูน (ส่งเข้า BOQ หมวด 18 และงานสี)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="งานฉาบปูนผนัง (ภายนอก)" value={outputs.exterior} unit="ตร.ม." strong />
                    <CalcField label="งานฉาบปูนผนัง (ภายใน)" value={outputs.interior} unit="ตร.ม." strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
