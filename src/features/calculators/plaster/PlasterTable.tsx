'use client';

import {
    plasterRowArea, PLASTER_KINDS, PLASTER_SIDES, PLASTER_WALL_PARTS, STRUCTURAL_WALL, STRUCTURAL_WALL_DEFAULT_AREA,
    type PlasterRow,
} from '@/domain/calculators/plaster';
import type { CalcContext } from '@/domain/calculators/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

export const isStructural = (r: PlasterRow) => r.wallPart.trim() === STRUCTURAL_WALL;

/** The sheet's plaster table (Excel B–E): wall part, kind, faces, area per face, total. */
export function PlasterTable({ rows, onChange, setRow, ctx, brickNet, structuralDefault = STRUCTURAL_WALL_DEFAULT_AREA }: {
    rows: PlasterRow[];
    onChange: (rows: PlasterRow[]) => void;
    setRow: (i: number, patch: Partial<PlasterRow>) => void;
    ctx: CalcContext;
    brickNet: (wallPart: string) => number;
    /** Area per face a new / cleared structure-wall row gets (the Excel sample 31.24 by default). */
    structuralDefault?: number;
}) {
    return (
        <EditableTable<PlasterRow>
            rows={rows}
            onChange={onChange}
            newRow={() => ({ wallPart: '', kind: '', sides: 1 })}
            addLabel="+ เพิ่มรายการ"
            columns={[
                { kind: 'select', key: 'wallPart', title: 'แยกส่วนผนัง', width: 160,
                    options: PLASTER_WALL_PARTS.map(v => ({ value: v })),
                    get: r => r.wallPart,
                    set: (r, v) => ({
                        ...r, wallPart: v,
                        manualArea: v === STRUCTURAL_WALL ? (r.manualArea ?? structuralDefault) : r.manualArea,
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
                            onCommit={v => setRow(i, { manualArea: v ?? structuralDefault })} />
                        : (
                            <div className="text-right tabular-nums px-1" style={{ background: SHEET_COLORS.calc }}>
                                {r.wallPart.trim() ? formatNumber(brickNet(r.wallPart)) : ''}
                            </div>
                        )),
                },
                { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => plasterRowArea(r, ctx) },
            ]}
        />
    );
}
