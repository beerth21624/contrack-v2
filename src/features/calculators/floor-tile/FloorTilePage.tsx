'use client';

import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    floorTile, floorTileRowArea, FLOOR_TILE_CODES, FLOOR_TILE_DESCRIPTIONS, FLOOR_TILE_DESCRIPTION_ORDER,
    type FloorTileCode, type FloorTileInput, type FloorTileRow,
} from '@/domain/calculators/floor-tile';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { EmptyState, ResultSummary, blankIfZero } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const isCode = (v: string): v is FloorTileCode => (FLOOR_TILE_CODES as readonly string[]).includes(v);

/** Journey: short floor-finish names, with where the sample house uses each one. */
const PLAIN_TYPE: Record<FloorTileCode, string> = {
    F1: 'กระเบื้องแกรนิตโต้ (ห้องทั่วไป)',
    F3: 'กระเบื้องแกรนิตโต้ กันลื่น (เฉลียง, บันได)',
    F4: 'ปรับระดับ ทำกันซึม (ดาดฟ้า)',
};

const newJourneyRow = (): FloorTileRow => ({ code: 'F1', width: 0, length: 0, location: '' });

/** Journey mode: one row per room, read off the floor plan; results reduced to the totals. */
function FloorTileJourney({ input, onChange, outputs }: {
    input: FloorTileInput; onChange: (rows: FloorTileRow[]) => void; outputs: Record<string, number>;
}) {
    const add = () => onChange([...input.rows, newJourneyRow()]);
    const usedTypes = FLOOR_TILE_CODES.filter(c => (outputs[c] ?? 0) !== 0);
    return (
        <>
            <SheetCard title="ห้องและชนิดพื้น">
                {input.rows.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีห้อง — เปิดแปลนพื้น แล้วเพิ่มทีละห้อง (ชื่อห้อง ชนิดพื้น กว้าง × ยาว)"
                            note="ห้องน้ำไม่ต้องใส่ที่นี่ — มีด่านกระเบื้องห้องน้ำแยกต่างหาก"
                            addLabel="เพิ่มห้อง" onAdd={add} />
                    )
                    : (
                        <>
                            <div className="overflow-x-auto">
                                <div style={{ minWidth: 720 }}>
                                    <EditableTable<FloorTileRow>
                                        rows={input.rows}
                                        onChange={onChange}
                                        columns={[
                                            { kind: 'text', key: 'location', title: 'ห้อง / ตำแหน่ง', width: 170, placeholder: 'เช่น ห้องนอน 1',
                                                get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                            { kind: 'select', key: 'code', title: 'ชนิดพื้น', width: 270,
                                                options: FLOOR_TILE_CODES.map(c => ({ value: c, label: PLAIN_TYPE[c] })),
                                                get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                            { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90,
                                                get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                            { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90,
                                                get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                            { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 100, get: r => blankIfZero(floorTileRowArea(r)) },
                                        ]}
                                    />
                                </div>
                            </div>
                            <Button type="dashed" icon={<PlusOutlined />} className="mt-3" onClick={add}>เพิ่มห้อง</Button>
                            <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                                <li>ห้องที่เป็นรูปตัว L ให้แบ่งเป็น 2 แถว เช่น ห้องนอน 1 (1) และ ห้องนอน 1 (2)</li>
                                <li>บันได: กว้าง = ความกว้างบันได, ยาว = ลูกนอน + ลูกตั้ง (เช่น 0.9 + 0.45 = 1.35 ม. พิมพ์ 0.9+0.45 ได้)</li>
                                <li>ห้องน้ำไม่ต้องใส่ที่นี่ — มีด่านกระเบื้องห้องน้ำแยกต่างหาก</li>
                            </ul>
                        </>
                    )}
            </SheetCard>

            <ResultSummary items={[
                ...usedTypes.map(c => ({ label: PLAIN_TYPE[c], value: outputs[c], unit: 'ตร.ม.' })),
                { label: 'พื้นที่ปูพื้นรวม', value: outputs.total, unit: 'ตร.ม.' },
            ]} />
        </>
    );
}

export default function FloorTilePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(floorTile);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={floorTile} result={result} isDefault={isDefault} onReset={reset}>
                <FloorTileJourney input={input} outputs={outputs} onChange={rows => update({ rows })} />
            </CalculatorShell>
        );
    }

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
