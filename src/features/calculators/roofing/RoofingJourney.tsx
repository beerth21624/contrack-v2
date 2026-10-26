'use client';

import {
    roofing, withRoofSlope, ROOFING_BOQ_UNITS, ROOFING_FACTOR_UNITS, ROOFING_ITEMS, type RoofingRow,
} from '@/domain/calculators/roofing';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { LengthsCell, formatLengths, parseLengths } from '@/components/sheet/LengthsCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { Hint, LabelWithHint, PlanNumber, ResultSummary, blankIfZero } from '@/components/sheet/journey';

/** What to measure on the roof plan for each material row (by the row's stable key). */
const MEASURE_HINTS: Record<string, string> = {
    ridge: 'ความยาวสันหลังคาทุกเส้น',
    rake: 'ความยาวขอบจั่ว วัดตามแนวราบในแปลน (ระบบคิดตามความชันให้)',
    wall: 'ความยาวที่หลังคาชนผนัง',
    'eave-end': 'จำนวนปลายสันที่ชายคา',
    'gable-end': 'จำนวนปลายสันที่หน้าจั่ว',
    'two-way': 'จำนวนจุดที่สันหลังคามาชนกัน',
    valley: 'ความยาวรางตะเข้ (รางน้ำระหว่างหลังคา 2 ผืน)',
    'bird-stop': 'ความยาวชายคาที่ต้องปิดกันนก',
    fascia: 'ความยาวเชิงชายรอบหลังคา (ใช้ต่อในขั้นตอนทาสี)',
};

const opts = (xs: readonly string[]) => xs.map(value => ({ value }));

export default function RoofingJourney() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofing);
    const setRow = (i: number, patch: Partial<RoofingRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
    const itemOf = (key: string) => input.rows.find(r => r.key === key)?.item ?? '';
    const qtyOf = (key: string) => {
        const i = input.rows.findIndex(r => r.key === key);
        return i < 0 ? undefined : outputs[`qty.${i}`];
    };
    const rakeOffSlope = input.rows.filter(r => r.takeoff.kind === 'rake' && r.takeoff.deg !== input.slopeDeg);
    // Roof area typed but no pitch: the slope area would silently equal the plan area.
    const slopeMissing = input.planArea > 0 && input.slopeDeg === 0;

    const measure = (r: RoofingRow, i: number) => {
        const t = r.takeoff;
        switch (t.kind) {
            case 'lengths':
                // Points are counted, not measured: a count example instead of a sum of lengths.
                if (r.takeoffUnit === 'จุด') {
                    return (
                        <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                            <TextCell value={formatLengths(t.lengths)} ariaLabel={`${r.item} (${r.takeoffUnit})`} placeholder="เช่น 4"
                                onCommit={v => {
                                    const parsed = parseLengths(v ?? '');
                                    if (parsed) setRow(i, { takeoff: { kind: 'lengths', lengths: parsed } });
                                }} />
                        </div>
                    );
                }
                return <LengthsCell lengths={t.lengths} ariaLabel={`${r.item} (${r.takeoffUnit})`}
                    onChange={lengths => setRow(i, { takeoff: { kind: 'lengths', lengths } })} />;
            case 'rake':
                return <LengthsCell lengths={t.lengths} ariaLabel={`${r.item} ความยาวตามแนวราบ (ม.)`}
                    onChange={lengths => setRow(i, { takeoff: { ...t, lengths } })} />;
            case 'slope':
                return <span className="px-1 text-[12px] text-gray-500">คิดจากพื้นที่หลังคาให้เอง</span>;
            case 'row':
                return <span className="px-1 text-[12px] text-gray-500">ใช้ค่าเดียวกับ {itemOf(t.ref)}</span>;
        }
    };

    return (
        <CalculatorShell def={roofing} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="ขนาดหลังคา">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 items-start">
                    <PlanNumber label="พื้นที่หลังคาตามแนวราบ" value={input.planArea} unit="ตร.ม." range={[10, 2000]}
                        hint="มองจากด้านบน รวมชายคา" onChange={v => update({ planArea: v })} />
                    <PlanNumber label="ความชันหลังคา" value={input.slopeDeg} unit="องศา" digits={0} range={[5, 60]}
                        presets={[30, 35, 40]} presetFormat={v => `${String(v)}°`} missing={slopeMissing}
                        hint="ดูจากรูปตัด" onChange={v => update(p => withRoofSlope(p, v))} />
                    {(outputs.slopeArea ?? 0) > 0 && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[12px] text-gray-600 leading-tight">พื้นที่หลังคาตามแนวลาดเอียง</span>
                            <span className="text-[14px] font-semibold tabular-nums">{formatNumber(outputs.slopeArea)} ตร.ม.</span>
                        </div>
                    )}
                </div>
            </SheetCard>

            <SheetCard title="วัดจากแปลนหลังคา">
                <Hint>พิมพ์ความยาวแต่ละช่วงต่อกันด้วย + ได้ เช่น 12.5+11+4.5 · ไม่มีรายการไหนให้เว้นว่าง</Hint>
                <div className="mt-2">
                    <EditableTable<RoofingRow>
                        rows={input.rows}
                        onChange={rows => update({ rows })}
                        canDelete={false}
                        columns={[
                            { kind: 'label', key: 'item', title: 'วัสดุ', width: 260,
                                get: r => <LabelWithHint label={r.item} hint={MEASURE_HINTS[r.key]} /> },
                            { kind: 'label', key: 'measure', title: 'วัดจากแบบ', width: 200, get: (r, i) => measure(r, i) },
                            { kind: 'label', key: 'takeoffUnit', title: 'หน่วย', width: 60,
                                get: r => <span className="px-1 text-gray-600">{r.takeoffUnit}</span> },
                            { kind: 'calc', key: 'qty', title: 'ต้องใช้', width: 80, digits: 0, get: (_, i) => blankIfZero(outputs[`qty.${i}`] ?? 0) },
                            { kind: 'label', key: 'unit', title: '', width: 50, get: r => <span className="px-1 text-gray-600">{r.unit}</span> },
                        ]}
                    />
                </div>
            </SheetCard>

            <AdvancedSection title="อัตราการใช้วัสดุ (กระเบื้องซีแพค)">
                <EditableTable<RoofingRow>
                    rows={input.rows}
                    onChange={rows => update({ rows })}
                    canDelete={false}
                    columns={[
                        { kind: 'select', key: 'item', title: 'วัสดุ', width: 240, options: opts(ROOFING_ITEMS),
                            get: r => r.item, set: (r, v) => ({ ...r, item: v }) },
                        { kind: 'number', key: 'factor', title: 'อัตรา', width: 80, get: r => r.factor, set: (r, v) => ({ ...r, factor: v }) },
                        { kind: 'select', key: 'factorUnit', title: 'หน่วยอัตรา', width: 110, options: opts(ROOFING_FACTOR_UNITS),
                            get: r => r.factorUnit, set: (r, v) => ({ ...r, factorUnit: v }) },
                        { kind: 'select', key: 'unit', title: 'หน่วยซื้อ', width: 80, options: opts(ROOFING_BOQ_UNITS),
                            get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                        { kind: 'label', key: 'deg', title: 'ความชันที่ใช้คิด (องศา)', width: 110,
                            get: (r, i) => {
                                const t = r.takeoff;
                                if (t.kind !== 'rake') return <span className="block text-center text-gray-400">-</span>;
                                return <NumberCell value={t.deg} digits={0} ariaLabel="ความชันครอบข้างจั่ว (องศา)"
                                    onCommit={v => setRow(i, { takeoff: { ...t, deg: v ?? input.slopeDeg } })} />;
                            } },
                    ]}
                />
                <div className="mt-2 text-[12px] text-gray-500">
                    อัตรา &quot;แผ่น/ตร.ม.&quot; &quot;แผ่น/ม.&quot; &quot;แผ่น&quot; = คูณ · &quot;ม./แผ่น&quot; &quot;ตร.ม./ม้วน&quot; = หาร แล้วปัดขึ้นเป็นจำนวนเต็ม
                </div>
                {rakeOffSlope.length > 0 && (
                    <div className="mt-1 text-[12px] text-orange-600">
                        ครอบข้างจั่วคิดที่ความชันต่างจากหลังคา ({rakeOffSlope.map(r => (r.takeoff.kind === 'rake' ? `${r.takeoff.deg}°` : '')).join(', ')})
                    </div>
                )}
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'พื้นที่หลังคาตามแนวลาด', value: outputs.slopeArea, unit: 'ตร.ม.' },
                    { label: itemOf('tile') === '' ? 'กระเบื้อง' : itemOf('tile'), value: qtyOf('tile'), unit: 'แผ่น', digits: 0 },
                    { label: 'ความยาวเชิงชาย', value: outputs.fasciaLength, unit: 'ม.' },
                ]}
                note="พื้นที่หลังคาตามแนวลาดใช้ต่อในขั้นตอนโครงหลังคา (จันทัน แป ค่าแรง) และความยาวเชิงชายใช้ต่อในขั้นตอนทาสีให้อัตโนมัติ" />
        </CalculatorShell>
    );
}
