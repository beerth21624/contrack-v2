'use client';

import { Select } from 'antd';
import {
    roofing, roofingOp, ROOFING_BOQ_ROWS, ROOFING_BOQ_UNITS, ROOFING_FACTOR_UNITS, ROOFING_ITEMS, ROOFING_TAKEOFF_UNITS,
    type RoofingRow, type RoofingTakeoff,
} from '@/domain/calculators/roofing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { LengthsCell } from '@/components/sheet/LengthsCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import RoofingJourney from './RoofingJourney';

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));

/** Where E ปริมาณถอดแบบ comes from, as one select value. */
const sourceOf = (t: RoofingTakeoff) => (t.kind === 'row' ? `row:${t.ref}` : t.kind);

function TakeoffCell({ row, index, rows, value, onChange }: {
    row: RoofingRow; index: number; rows: RoofingRow[]; value: number; onChange: (t: RoofingTakeoff) => void;
}) {
    const t = row.takeoff;
    const lengths = t.kind === 'lengths' || t.kind === 'rake' ? t.lengths : [value];
    const options = [
        { value: 'lengths', label: 'กรอกเอง' },
        { value: 'rake', label: 'กรอกเอง ÷ cos(องศา)' },
        { value: 'slope', label: 'พื้นที่ตามแนวลาดเอียง (K7)' },
        ...rows.flatMap((r, j) => (j === index ? [] : [{ value: `row:${r.key}`, label: `= แถว ${j + 1} ${r.item}` }])),
    ];
    const setSource = (s: string) => {
        if (s === 'slope') onChange({ kind: 'slope' });
        else if (s === 'lengths') onChange({ kind: 'lengths', lengths });
        else if (s === 'rake') onChange({ kind: 'rake', lengths, deg: t.kind === 'rake' ? t.deg : 40 });
        else onChange({ kind: 'row', ref: s.slice(4) });
    };
    return (
        <div className="flex flex-col gap-0.5">
            <Select size="small" variant="borderless" value={sourceOf(t)} options={options} onChange={setSource}
                popupMatchSelectWidth={false} className="text-[11px]" style={{ width: '100%' }} aria-label="ที่มาของปริมาณถอดแบบ" />
            {t.kind === 'lengths' && (
                <LengthsCell lengths={t.lengths} ariaLabel="ปริมาณถอดแบบ" onChange={ls => onChange({ kind: 'lengths', lengths: ls })} />
            )}
            {t.kind === 'rake' && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto_56px] items-center gap-1">
                    <LengthsCell lengths={t.lengths} ariaLabel="ความยาวตามแนวราบ" onChange={ls => onChange({ ...t, lengths: ls })} />
                    <span className="text-[11px] text-gray-500">÷cos</span>
                    <NumberCell value={t.deg} digits={0} ariaLabel="องศา" onCommit={v => onChange({ ...t, deg: v ?? 40 })} />
                </div>
            )}
            {(t.kind !== 'lengths' || t.lengths.length > 1) && (
                <span className="text-right tabular-nums px-1 rounded-sm" style={{ background: SHEET_COLORS.calc }}>
                    {formatNumber(value)}
                </span>
            )}
        </div>
    );
}

export default function RoofingPage() {
    return useJourneyMode() ? <RoofingJourney /> : <RoofingSheet />;
}

/** The Excel-mirror sheet (/calc/roofing). */
function RoofingSheet() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofing);

    const setRow = (i: number, patch: Partial<RoofingRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const newKey = () => {
        let n = input.rows.length + 1;
        while (input.rows.some(r => r.key === `row-${n}`)) n++;
        return `row-${n}`;
    };

    return (
        <CalculatorShell def={roofing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="[ โปรแกรมเสริม : คำนวณพื้นที่หลังคา ]">
                <div className="max-w-lg">
                    <InputNumberField label="พื้นที่ตามแนวราบ (ตร.ม)" value={input.planArea} unit="ตร.ม."
                        onChange={v => update({ planArea: v })} />
                    <InputNumberField label="ความลาดเอียงหลังคา (องศา)" value={input.slopeDeg} unit="องศา"
                        onChange={v => update({ slopeDeg: v })} />
                    <CalcField label="พื้นที่ตามแนวลาดเอียง (ตร.ม)" value={outputs.slopeArea} unit="ตร.ม." strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    พื้นที่ตามแนวลาดเอียง = พื้นที่ตามแนวราบ ÷ cos(ความลาดเอียง) — ใช้กับกระเบื้อง, แผ่นสะท้อนความร้อน,
                    ค่าแรงมุงหลังคา และจันทัน/แปในชีตโครงสร้างหลังคา
                </p>
            </SheetCard>

            <SheetCard title=": ตารางคำนวณปริมาณวัสดุมุงหลังคา (หลังคาซีแพค)">
                <EditableTable<RoofingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    lockedRows={ROOFING_BOQ_ROWS}
                    newRow={() => ({
                        key: newKey(), item: '', factor: 0, factorUnit: '', takeoff: { kind: 'lengths', lengths: [] },
                        takeoffUnit: '', unit: '',
                    })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        {
                            kind: 'select', key: 'item', title: 'รายการวัสดุมุงและครอบ', width: 230, options: opts(ROOFING_ITEMS),
                            get: r => r.item, set: (r, v) => ({ ...r, item: v }),
                        },
                        { kind: 'number', key: 'factor', title: 'ปริมาณ ต่อหน่วย', width: 80, get: r => r.factor, set: (r, v) => ({ ...r, factor: v }) },
                        {
                            kind: 'select', key: 'factorUnit', title: 'หน่วย', width: 105, options: opts(ROOFING_FACTOR_UNITS),
                            get: r => r.factorUnit, set: (r, v) => ({ ...r, factorUnit: v }),
                        },
                        {
                            kind: 'label', key: 'takeoff', title: 'ปริมาณ ถอดแบบ', width: 190,
                            get: (r, i) => (
                                <TakeoffCell row={r} index={i} rows={input.rows} value={outputs[`takeoff.${i}`] ?? 0}
                                    onChange={takeoff => setRow(i, { takeoff })} />
                            ),
                        },
                        {
                            kind: 'select', key: 'takeoffUnit', title: 'หน่วย', width: 80, options: opts(ROOFING_TAKEOFF_UNITS),
                            get: r => r.takeoffUnit, set: (r, v) => ({ ...r, takeoffUnit: v }),
                        },
                        {
                            kind: 'calc', key: 'qty', title: 'ปริมาณ BOQ', width: 80, digits: 0,
                            get: (_, i) => outputs[`qty.${i}`] ?? 0,
                        },
                        {
                            kind: 'select', key: 'unit', title: 'หน่วย', width: 80, options: opts(ROOFING_BOQ_UNITS),
                            get: r => r.unit, set: (r, v) => ({ ...r, unit: v }),
                        },
                    ]}
                />
                <ul className="mt-2 text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                    <li>
                        ปริมาณ BOQ = ROUNDUP(ปริมาณถอดแบบ × ปริมาณต่อหน่วย) เมื่อหน่วยเป็น แผ่น/ตร.ม., แผ่น/ม., แผ่น และ
                        ROUNDUP(ปริมาณถอดแบบ ÷ ปริมาณต่อหน่วย) เมื่อหน่วยเป็น ม./แผ่น, ตร.ม./ม้วน
                    </li>
                    <li>แถว 1–{ROOFING_BOQ_ROWS} ส่งเข้า BOQ หมวด 16 ตามลำดับแถว (เหมือน Excel); แถวที่เพิ่มเองคำนวณให้แต่ไม่ส่งเข้า BOQ</li>
                    <li>
                        ค่าแรงมุงหลังคา = พื้นที่ตามแนวลาดเอียง {formatNumber(outputs.R175)} ตร.ม.;
                        ค่าแรงติดตั้งไม้เชิงชาย = ปริมาณถอดแบบแถว 12 ({input.rows[11]?.item ?? 'ไม้เชิงชาย'}) {formatNumber(outputs.R176)} ม.
                    </li>
                    <li>
                        ครอบข้างจั่ว: ความยาวตามแนวราบ ÷ cos(องศา) — Excel ใช้ 40° ตายตัว ไม่ได้ลิงก์กับความลาดเอียงด้านบน
                    </li>
                </ul>
                {input.rows.some(r => r.factorUnit !== '' && roofingOp(r.factorUnit) === 'div' && r.factor === 0) && (
                    <p className="mt-1 text-[12px] text-red-500">มีแถวที่หาร แต่ปริมาณต่อหน่วยเป็น 0 — ปริมาณ BOQ เป็น 0</p>
                )}
            </SheetCard>
        </CalculatorShell>
    );
}
