'use client';

import {
    floorTile, floorTileRowArea, FLOOR_TILE_CODES, FLOOR_TILE_DESCRIPTIONS, FLOOR_TILE_DESCRIPTION_ORDER,
    type FloorTileCode, type FloorTileRow,
} from '@/domain/calculators/floor-tile';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const isCode = (v: string): v is FloorTileCode => (FLOOR_TILE_CODES as readonly string[]).includes(v);

export default function FloorTilePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(floorTile);

    return (
        <CalculatorShell def={floorTile} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวพื้น">
                <EditableTable<FloorTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', width: 0, length: 0, location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: FLOOR_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                        { kind: 'select', key: 'desc', title: 'รายการ', width: 260,
                            options: FLOOR_TILE_DESCRIPTION_ORDER.map(c => ({ value: c, label: FLOOR_TILE_DESCRIPTIONS[c] })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => floorTileRowArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 180,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ตร.ม.) = กว้าง × ยาว</li>
                    <li>ตัวอย่าง Excel บันได (1)–(3): ยาว = 0.9 + 0.45 = 1.35 ม.</li>
                    <li>สัญลักษณ์ F1 / F3 / F4 ใช้รวมปริมาณเข้า BOQ หมวด 20 (ห้องน้ำอยู่ในโปรแกรมปูกระเบื้องห้องน้ำ)</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่ปูกระเบื้องพื้น (ส่งเข้า BOQ หมวด 20)">
                <div className="max-w-xl">
                    {FLOOR_TILE_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${FLOOR_TILE_DESCRIPTIONS[c]}`} value={outputs[c]} unit="ตร.ม." />
                    ))}
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="ตร.ม." strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
