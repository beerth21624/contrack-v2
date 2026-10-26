'use client';

import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    wallFinishing, wallFinishingArea, wallFinishingKind, wallFinishingLength, newMouldingRow, newSlatRow, replaceRowsOfKind,
    setMouldingLength, MOULDING_0_1, MOULDING_0_3, SLAT_WALL, WALL_FINISHING_CODES, WALL_FINISHING_ITEMS,
    type WallFinishingInput, type WallFinishingKind, type WallFinishingRow,
} from '@/domain/calculators/wall-finishing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Journey: the two moulding sizes in plain words. */
const MOULDING_OPTIONS = [
    { value: MOULDING_0_3, label: 'บัวใหญ่ 0.30 × 0.10 ม.' },
    { value: MOULDING_0_1, label: 'บัวเล็ก 0.10 × 0.10 ม.' },
];

/** Journey mode: mouldings (metres) and slat-clad walls (m²) read off the elevations. */
function WallFinishingJourney({ input, onChange, outputs }: {
    input: WallFinishingInput; onChange: (edit: (prev: WallFinishingInput) => WallFinishingInput) => void; outputs: Record<string, number>;
}) {
    const rowsOf = (kind: WallFinishingKind) => input.rows.filter(r => wallFinishingKind(r) === kind);
    const setKind = (kind: WallFinishingKind) => (rows: WallFinishingRow[]) => onChange(p => replaceRowsOfKind(p, kind, rows));
    const mouldings = rowsOf('moulding');
    const slats = rowsOf('slat');
    const others = rowsOf('other');
    const addMoulding = () => onChange(p => ({ rows: [...p.rows, newMouldingRow()] }));
    const addSlat = () => onChange(p => ({ rows: [...p.rows, newSlatRow()] }));

    if (input.rows.length === 0) {
        return (
            <SheetCard>
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="text-[14px] text-gray-600">
                        ยังไม่มีงานตกแต่งผนัง — ดูรูปด้านว่ามีบัวผนัง หรือผนังกรุไม้ระแนงไหม
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={addMoulding}>เพิ่มบัวผนัง</Button>
                        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={addSlat}>เพิ่มผนังไม้ระแนง</Button>
                    </div>
                    <div className="text-[12px] text-gray-500">ถ้าแบบไม่มีงานนี้ กด &quot;ไม่มีงานนี้&quot; ที่แถบด้านล่าง</div>
                </div>
            </SheetCard>
        );
    }

    return (
        <>
            <SheetCard title="บัวผนัง (คิดเป็นความยาว)">
                {mouldings.length > 0 && (
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: 560 }}>
                            <EditableTable<WallFinishingRow>
                                rows={mouldings}
                                onChange={setKind('moulding')}
                                columns={[
                                    { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 180, placeholder: 'เช่น ผนังภายนอก',
                                        get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                    { kind: 'select', key: 'item', title: 'ขนาดบัว', width: 200, options: MOULDING_OPTIONS,
                                        get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                                    { kind: 'number', key: 'length', title: 'ความยาว (ม.)', width: 110,
                                        get: r => wallFinishingLength(r) ?? 0, set: (r, v) => setMouldingLength(r, v) },
                                ]}
                            />
                        </div>
                    </div>
                )}
                <Button type="dashed" icon={<PlusOutlined />} className={mouldings.length > 0 ? 'mt-3' : ''} onClick={addMoulding}>
                    เพิ่มบัวผนัง
                </Button>
            </SheetCard>

            <SheetCard title="ผนังกรุไม้ระแนงไฟเบอร์ซีเมนต์ (คิดเป็นพื้นที่)">
                {slats.length > 0 && (
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: 560 }}>
                            <EditableTable<WallFinishingRow>
                                rows={slats}
                                onChange={setKind('slat')}
                                columns={[
                                    { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 180, placeholder: 'เช่น ผนังเฉลียง',
                                        get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 100,
                                        get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'length', title: 'สูง (ม.)', width: 100,
                                        get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                    { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 100, get: r => wallFinishingArea(r) },
                                ]}
                            />
                        </div>
                    </div>
                )}
                <Button type="dashed" icon={<PlusOutlined />} className={slats.length > 0 ? 'mt-3' : ''} onClick={addSlat}>
                    เพิ่มผนังไม้ระแนง
                </Button>
            </SheetCard>

            {others.length > 0 && (
                <SheetCard title="รายการที่ยังไม่ได้เลือกชนิด (ยังไม่นับ)">
                    <EditableTable<WallFinishingRow>
                        rows={others}
                        onChange={setKind('other')}
                        columns={[
                            { kind: 'select', key: 'item', title: 'ชนิด', width: 240,
                                options: [...MOULDING_OPTIONS, { value: SLAT_WALL, label: 'ผนังไม้ระแนง' }],
                                get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                            { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 160,
                                get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                            { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90,
                                get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                            { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90,
                                get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        ]}
                    />
                </SheetCard>
            )}

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="text-[12px] font-semibold text-green-800 mb-1">สรุปงานตกแต่งผนัง</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-gray-700">
                    <span>บัวใหญ่ 0.30 <b className="tabular-nums text-[15px]">{formatNumber(outputs.R218)}</b> ม.</span>
                    <span>บัวเล็ก 0.10 <b className="tabular-nums text-[15px]">{formatNumber(outputs.R219)}</b> ม.</span>
                    <span>ผนังไม้ระแนง <b className="tabular-nums text-[15px]">{formatNumber(outputs.R220)}</b> ตร.ม.</span>
                </div>
                <div className="mt-1 text-[12px] text-gray-600">ความยาวบัวและพื้นที่ระแนงนำไปใช้ต่อในด่านทาสีได้</div>
            </div>
        </>
    );
}

export default function WallFinishingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(wallFinishing);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
                <WallFinishingJourney input={input} outputs={outputs} onChange={next => update(next)} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={wallFinishing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณวัสดุตกแต่งผิวผนัง">
                <EditableTable<WallFinishingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    newRow={() => ({ code: '', item: '', width: 0, length: 0, location: '' })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                            options: WALL_FINISHING_CODES.map(v => ({ value: v })),
                            get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                        { kind: 'select', key: 'item', title: 'รายการ', width: 300,
                            options: WALL_FINISHING_ITEMS.map(v => ({ value: v })),
                            get: r => r.item.trim(), set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                            get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                            get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'total-length', title: 'ยาว (ม.)', width: 80, get: r => wallFinishingLength(r) },
                        { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 90, get: r => wallFinishingArea(r) },
                        { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 130,
                            get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>บัวตกแต่งผนัง: ยาว (ม.) = กว้าง + ยาว (ตัวอย่าง Excel กรอกกว้าง = 0) → ส่งเข้า BOQ เป็นเมตร</li>
                    <li>กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด: พื้นที่ (ตร.ม.) = กว้าง × ยาว → ส่งเข้า BOQ และงานทาสีผนัง - ไม้ระแนง</li>
                    <li>หัวคอลัมน์ใน Excel สลับกัน (&quot;ตำแหน่ง&quot; เก็บชื่อรายการ, &quot;รายการ&quot; เก็บตำแหน่ง) — หน้านี้แสดงตามความหมายจริง</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปปริมาณ (ส่งเข้า BOQ หมวด 22)">
                <CalcField label={MOULDING_0_3} value={outputs.R218} unit="ม." strong />
                <CalcField label={MOULDING_0_1} value={outputs.R219} unit="ม." strong />
                <CalcField label={SLAT_WALL} value={outputs.R220} unit="ตร.ม." strong />
                <p className="mt-2 text-[12px] text-gray-500">
                    แก้จาก Excel: ใน Excel แถว BOQ &quot;บัว ขนาด 0.3&quot; (ราคา 400/200) รวมความยาวของบัว 0.1 และแถว
                    &quot;บัว ขนาด 0.1&quot; (180/100) รวมความยาวของบัว 0.3 — ที่นี่แต่ละแถวรวมความยาวของบัวขนาดของตัวเอง
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
