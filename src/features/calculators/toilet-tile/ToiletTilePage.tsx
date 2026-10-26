'use client';

import {
    toiletTile, toiletTileArea, TOILET_TILE_CODES, TOILET_TILE_ITEMS, TOILET_TILE_SURFACES, type ToiletTileRow,
} from '@/domain/calculators/toilet-tile';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { OptionalNumberCell } from './OptionalNumberCell';

type DimKey = 'width' | 'length' | 'height' | 'openings';

/** Surface / item that go with each code — filled in when the code is picked and they are still blank. */
const CODE_DEFAULTS: Record<string, { surface: string; item: string }> = {
    F3: { surface: 'พื้น', item: 'ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น' },
    P3: { surface: 'ผนัง', item: 'กรุกระเบื้องแกรนิตโต้' },
};

export default function ToiletTilePage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(toiletTile);

    const setRow = (i: number, patch: Partial<ToiletTileRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    const dim = (key: DimKey, title: string, width = 90) => ({
        kind: 'label' as const, key, title, width,
        get: (r: ToiletTileRow, i: number) => (
            <OptionalNumberCell value={r[key]} ariaLabel={`${title} แถว ${i + 1}`}
                onCommit={v => setRow(i, { [key]: v })} />
        ),
    });

    return (
        <CalculatorShell def={toiletTile} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวพื้น-ผนัง">
                <EditableTable<ToiletTileRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', surface: '', item: '', location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: TOILET_TILE_CODES.map(v => ({ value: v })),
                            get: r => r.code,
                            set: (r, v) => ({
                                ...r, code: v,
                                surface: r.surface.trim() === '' ? (CODE_DEFAULTS[v]?.surface ?? '') : r.surface,
                                item: r.item.trim() === '' ? (CODE_DEFAULTS[v]?.item ?? '') : r.item,
                            }) },
                        { kind: 'select', key: 'surface', title: 'พื้น/ผนัง', width: 80,
                            options: TOILET_TILE_SURFACES.map(v => ({ value: v })),
                            get: r => r.surface, set: (r, v) => ({ ...r, surface: v }) },
                        { kind: 'select', key: 'item', title: 'รายการ', width: 220,
                            options: TOILET_TILE_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        dim('width', 'กว้าง (ม.)'),
                        dim('length', 'ยาว (ม.)'),
                        dim('height', 'สูง (ม.)'),
                        dim('openings', 'ช่องเปิด (ตร.ม.)', 100),
                        { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 100, get: r => toiletTileArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 120,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม = กว้าง × ยาว × สูง (คูณเฉพาะช่องที่กรอก) − ช่องเปิด · ไม่กรอกกว้าง/ยาว/สูง = ว่าง</li>
                    <li>F3 = พื้น (ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น): กรอกกว้าง × ยาว ของห้องน้ำ</li>
                    <li>P3 = ผนัง (กรุกระเบื้องแกรนิตโต้): ยาว = ความยาวรอบห้อง เช่น 2 × (2.3 + 3) = 10.6 ม., สูง = ความสูงที่กรุกระเบื้อง</li>
                    <li>ช่องเปิด กรอกแยกแต่ละห้องน้ำ — ค่าตัวอย่าง Excel = ประตู 0.7 × 2 + หน้าต่าง 0.5 × 1.8 = 2.3 ตร.ม.</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่กระเบื้องห้องน้ำ (ส่งเข้า BOQ หมวด 21)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="ปูกระเบื้องแกรนิตโต้พื้น ชนิดกันลื่น (F3)" value={outputs.R210} unit="ตร.ม." strong />
                    <CalcField label="กรุกระเบื้องแกรนิตโต้ผนัง (P3)" value={outputs.R211} unit="ตร.ม." strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    งานระบบประปา ท่อน้ำดี ในหมวด 21 มาจากโปรแกรมท่อน้ำดี (Water Pipe)
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
