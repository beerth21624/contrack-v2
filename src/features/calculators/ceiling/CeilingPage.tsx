'use client';

import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    ceiling, ceilingRowArea, setCeilingCode, CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_DESCRIPTIONS,
    CEILING_DESCRIPTION_ORDER, CEILING_PAINT_GROUPS, paintGroupLabel, paintKey, SLOPED_CEILING_DEG,
    type CeilingCode, type CeilingInput, type CeilingPaintGroup, type CeilingRow,
} from '@/domain/calculators/ceiling';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { EmptyState, ResultSummary, blankIfZero } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const isCode = (v: string): v is CeilingCode => (CEILING_CODES as readonly string[]).includes(v);
const isPaint = (v: string): v is CeilingPaintGroup => (CEILING_PAINT_GROUPS as readonly string[]).includes(v);

/** Scroll the table sideways instead of letting the รายการ dropdown squeeze the number columns. */
const TABLE_MIN_WIDTH = 1240;

/** Journey: short type names, with where the sample house uses each one. */
const PLAIN_TYPE: Record<CeilingCode, string> = {
    C1: 'ยิปซัมบอร์ด 9 มม. (ห้องทั่วไป)',
    C2: 'ยิปซัมบอร์ดกันชื้น 9 มม. (ห้องน้ำ, เฉลียง)',
    C3: 'ไฟเบอร์ซีเมนต์ 4 มม. (ชายคาภายนอก)',
    C4: 'ระแนงไม้ไฟเบอร์ซีเมนต์ 4 นิ้ว',
};
const PLAIN_PAINT: Record<CeilingPaintGroup, string> = {
    ภายใน: 'สีภายใน', ภายนอก: 'สีภายนอก', ไม้ระแนง: 'สีย้อมไม้ (ระแนง)',
};

const newJourneyRow = (): CeilingRow => ({ code: 'C1', width: 0, length: 0, location: '', paint: CEILING_DEFAULT_PAINT.C1 });

/** Journey mode: one row per room, read off the ceiling plan; results reduced to the totals. */
function CeilingJourney({ input, onChange, outputs }: {
    input: CeilingInput; onChange: (rows: CeilingRow[]) => void; outputs: Record<string, number>;
}) {
    const add = () => onChange([...input.rows, newJourneyRow()]);
    const usedTypes = CEILING_CODES.filter(c => (outputs[c] ?? 0) !== 0);
    return (
        <>
            <SheetCard title="ห้องและชนิดฝ้า">
                {input.rows.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีห้อง — เปิดแปลนฝ้าเพดาน แล้วเพิ่มทีละห้อง (ชื่อห้อง ชนิดฝ้า กว้าง × ยาว)"
                            addLabel="เพิ่มห้อง" onAdd={add} />
                    )
                    : (
                        <>
                            <div className="overflow-x-auto">
                                <div style={{ minWidth: 900 }}>
                                    <EditableTable<CeilingRow>
                                        rows={input.rows}
                                        onChange={onChange}
                                        columns={[
                                            { kind: 'text', key: 'location', title: 'ห้อง / ตำแหน่ง', width: 160, placeholder: 'เช่น ห้องนอน 1',
                                                get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                            { kind: 'select', key: 'code', title: 'ชนิดฝ้า', width: 260,
                                                options: CEILING_CODES.map(c => ({ value: c, label: PLAIN_TYPE[c] })),
                                                get: r => r.code, set: (r, v) => setCeilingCode(r, isCode(v) ? v : '') },
                                            { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                                                get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                            { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                                                get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                            { kind: 'number', key: 'slope', title: 'ลาดเอียง (องศา)', width: 80, digits: 0,
                                                get: r => r.slope ?? 0, set: (r, v) => ({ ...r, slope: v }) },
                                            { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 90, get: r => blankIfZero(ceilingRowArea(r)) },
                                            { kind: 'select', key: 'paint', title: 'ทาสีฝ้า', width: 150,
                                                options: CEILING_PAINT_GROUPS.map(g => ({ value: g, label: PLAIN_PAINT[g] })),
                                                get: r => r.paint, set: (r, v) => ({ ...r, paint: isPaint(v) ? v : '' }) },
                                        ]}
                                    />
                                </div>
                            </div>
                            <Button type="dashed" icon={<PlusOutlined />} className="mt-3" onClick={add}>เพิ่มห้อง</Button>
                            <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                                <li>ห้องที่เป็นรูปตัว L ให้แบ่งเป็น 2 แถว เช่น ห้องนอน 1 (1) และ ห้องนอน 1 (2)</li>
                                <li>ฝ้าเรียบเว้นช่องลาดเอียงว่างไว้ · ฝ้าใต้หลังคาลาด (เช่น เฉลียง) ใส่องศาหลังคา เช่น {SLOPED_CEILING_DEG}</li>
                                <li>ชายคาภายนอก: กว้าง = ระยะยื่นชายคา, ยาว = ความยาวรอบชายคา</li>
                                <li>ทาสีฝ้าเลือกให้ตามชนิดฝ้าแล้ว เปลี่ยนได้ — พื้นที่นี้ส่งต่อไปด่านทาสี</li>
                            </ul>
                        </>
                    )}
            </SheetCard>

            <ResultSummary
                items={[
                    ...usedTypes.map(c => ({ label: PLAIN_TYPE[c], value: outputs[c], unit: 'ตร.ม.' })),
                    { label: 'พื้นที่ฝ้ารวม', value: outputs.total, unit: 'ตร.ม.' },
                ]}
                note={CEILING_PAINT_GROUPS.some(g => (outputs[paintKey(g)] ?? 0) !== 0)
                    ? <>ส่งต่อด่านทาสี: {CEILING_PAINT_GROUPS.filter(g => (outputs[paintKey(g)] ?? 0) !== 0)
                        .map(g => `${PLAIN_PAINT[g]} ${formatNumber(outputs[paintKey(g)])} ตร.ม.`).join(' · ')}</>
                    : 'พื้นที่ฝ้าที่ทาสีจะส่งต่อไปด่านทาสีให้อัตโนมัติ'} />
        </>
    );
}

export default function CeilingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(ceiling);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
                <CeilingJourney input={input} outputs={outputs} onChange={rows => update({ rows })} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณฝ้าเพดาน">
                {/* The long รายการ texts would otherwise squeeze กว้าง/ยาว to ~40 px (62.30 shown as "62."). */}
                <div className="overflow-x-auto">
                    <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                        <EditableTable<CeilingRow>
                            rows={input.rows}
                            onChange={rows => update({ rows })}
                            newRow={() => ({ code: '', width: 0, length: 0, location: '', paint: '' })}
                            addLabel="+ เพิ่มรายการ"
                            columns={[
                                { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                                    options: CEILING_CODES.map(v => ({ value: v })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                                { kind: 'select', key: 'desc', title: 'รายการ', width: 380,
                                    options: CEILING_DESCRIPTION_ORDER.map(c => ({ value: c, label: CEILING_DESCRIPTIONS[c] })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                                    get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                                    get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                { kind: 'number', key: 'slope', title: 'ลาดเอียง (องศา)', width: 80, digits: 0,
                                    get: r => r.slope ?? 0, set: (r, v) => ({ ...r, slope: v }) },
                                { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 90, get: r => ceilingRowArea(r) },
                                { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 150,
                                    get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                { kind: 'select', key: 'paint', title: 'แยกงานทาสี', width: 150,
                                    options: CEILING_PAINT_GROUPS.map(g => ({ value: g, label: paintGroupLabel(g) })),
                                    get: r => r.paint, set: (r, v) => ({ ...r, paint: isPaint(v) ? v : '' }) },
                            ]}
                        />
                    </div>
                </div>
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ตร.ม.) = กว้าง × ยาว</li>
                    <li>
                        ฝ้าลาดเอียง (เช่น ฝ้าเฉลียงใต้หลังคา): รวม = กว้าง × ยาว ÷ cos(องศา) — ตัวอย่าง Excel เฉลียง 1–2
                        ใช้ {SLOPED_CEILING_DEG}° (ฝ้าเรียบใส่ 0)
                    </li>
                    <li>สัญลักษณ์ C1–C4 ใช้รวมปริมาณเข้า BOQ หมวด 19 · แยกงานทาสี ใช้รวมพื้นที่ทาสีฝ้าในโปรแกรมงานทาสี</li>
                </ul>
            </SheetCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SheetCard title="สรุปพื้นที่ฝ้าเพดาน (ส่งเข้า BOQ หมวด 19)">
                    {CEILING_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${CEILING_DESCRIPTIONS[c]}`} value={outputs[c]} unit="ตร.ม." />
                    ))}
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="ตร.ม." strong />
                </SheetCard>
                <SheetCard title="สรุปพื้นที่ทาสีฝ้า (ส่งเข้าโปรแกรมงานทาสี)">
                    {CEILING_PAINT_GROUPS.map(g => (
                        <CalcField key={g} label={paintGroupLabel(g)} value={outputs[paintKey(g)]} unit="ตร.ม." />
                    ))}
                </SheetCard>
            </div>
        </CalculatorShell>
    );
}
