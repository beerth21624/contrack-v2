'use client';

// Guided-journey view of the footing sheet: one card per footing type of the plan (F1, F2 …), filled from the
// foundation plan and the footing detail. Same input and calculation as the Excel-mirror table.
import {
    footingRow, footingTotals, newFootingRow, totalKg, EXCAVATION_MARGIN, FOOTING_BAR_SIZES, SAND_FACTOR, type FootingRow,
} from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, BarField, EmptyState, JGroup, JText, PlanCard, PlanGroup, PlanNumber, ResultSummary, isPositive,
    nextCopyName, planChecks, removeAt, resultText,
} from '@/components/sheet/journey';

const label = (r: FootingRow, i: number) => (r.name.trim() === '' ? `แบบที่ ${i + 1}` : r.name.trim());

const L = {
    count: 'จำนวนฐานแบบนี้', width: 'ความกว้าง', length: 'ความยาว', depth: 'ความหนาฐาน', pit: 'ความลึกหลุมขุด',
    short: 'เหล็กแนวด้านสั้น', long: 'เหล็กแนวด้านยาว',
} as const;

/** The plan values a footing type needs (bar sizes come pre-chosen, so they do not mark the card as started). */
const checksOf = (r: FootingRow) => planChecks([
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.pit, ok: isPositive(r.excavationDepth) },
    { label: L.short, ok: isPositive(r.shortBarCount) && r.shortBarSize !== '' },
    { label: L.long, ok: isPositive(r.longBarCount) && r.longBarSize !== '' },
], [r.count, r.width, r.length, r.depth, r.excavationDepth, r.shortBarCount, r.longBarCount, r.ringBarCount].some(isPositive));

/** A pit shallower than the footing and its bed digs a negative volume: ask to check the depth. */
function depthWarning(r: FootingRow): string | undefined {
    const c = footingRow(r);
    if (c.concrete <= 0 || !(r.excavationDepth > 0) || c.backfillGross >= 0) return undefined;
    return 'หลุมขุดตื้นกว่าฐานราก + ทราย + คอนกรีตหยาบ — ตรวจความลึกหลุมขุดอีกครั้ง';
}

export function FootingJourney({ rows, onChange, backfillTotal }: {
    rows: FootingRow[];
    onChange: (rows: FootingRow[]) => void;
    /** Backfill after the pedestals (once the pedestal level is filled). */
    backfillTotal: number;
}) {
    const t = footingTotals(rows);
    const set = (i: number, patch: Partial<FootingRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newFootingRow(rows)]);
    // Copies go to the end of the list: pedestals point at footing rows by position.
    const duplicate = (r: FootingRow) => onChange([...rows, { ...r, name: nextCopyName(r.name, rows.map(x => x.name)), count: 0 }]);

    if (rows.length === 0) {
        return (
            <EmptyState
                text={<>ยังไม่มีฐานราก — เปิดแปลนฐานรากดูว่ามีฐานกี่แบบ (F1, F2 …) แล้วเพิ่มทีละแบบ</>}
                addLabel="เพิ่มฐานราก F1" onAdd={add} />
        );
    }

    const nextName = newFootingRow(rows).name;

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = footingRow(r);
                const k = checksOf(r);
                const warning = depthWarning(r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'rows', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={`ฐานราก ${label(r, i)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.shortKg + c.longKg + c.ringKg, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบฐานราก ${label(r, i)}?`}>
                        <PlanGroup title="จากแปลนฐานราก">
                            <JText label="ชื่อฐาน" value={r.name} placeholder="เช่น F1" onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.count} fieldKey="count" value={r.count} unit="ฐาน" digits={0} onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title="ขนาดฐาน (จากรูปขยายฐานราก)">
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit="ม." range={[0.3, 5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} fieldKey="length" value={r.length} unit="ม." range={[0.3, 5]} onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit="ม." range={[0.15, 2]} onChange={v => set(i, { depth: v })} />
                            <PlanNumber label={L.pit} fieldKey="excavationDepth" value={r.excavationDepth} unit="ม." range={[0.3, 5]}
                                hint="ผิวดินถึงก้นหลุม รวมทรายและคอนกรีตหยาบ" onChange={v => set(i, { excavationDepth: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม ต่อ 1 ฐาน" hint="เช่น 5-DB12 → DB12, 5 เส้น" layout="wide">
                            <BarField label={L.short} sizes={FOOTING_BAR_SIZES} size={r.shortBarSize} onSize={v => set(i, { shortBarSize: v })}
                                amount={r.shortBarCount} onAmount={v => set(i, { shortBarCount: v })} />
                            <BarField label={L.long} sizes={FOOTING_BAR_SIZES} size={r.longBarSize} onSize={v => set(i, { longBarSize: v })}
                                amount={r.longBarCount} onAmount={v => set(i, { longBarCount: v })} />
                            <BarField label="เหล็กรัดรอบ" sizes={FOOTING_BAR_SIZES} size={r.ringBarSize} onSize={v => set(i, { ringBarSize: v })}
                                amount={r.ringBarCount} onAmount={v => set(i, { ringBarCount: v })} amountUnit="รอบ" />
                        </PlanGroup>
                        {warning !== undefined && <div className="mt-3 text-[12px] text-orange-600">{warning}</div>}
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? 'เพิ่มฐานรากแบบถัดไป' : `เพิ่มฐานราก ${nextName}`} onClick={add} />

            <AdvancedSection title="ค่าตั้งต้น">
                <div className="flex flex-col gap-3">
                    {rows.map((r, i) => (
                        <JGroup key={i} title={`ชั้นรองก้นหลุม ฐาน ${label(r, i)}`}>
                            <PlanNumber label="ทรายหยาบ หนา" value={r.sandThickness} unit="ม." presets={[0.05]}
                                onChange={v => set(i, { sandThickness: v })} />
                            <PlanNumber label="คอนกรีตหยาบ หนา" value={r.leanThickness} unit="ม." presets={[0.05]}
                                onChange={v => set(i, { leanThickness: v })} />
                        </JGroup>
                    ))}
                    <ul className="text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                        <li>หลุมขุดเผื่อที่ทำงานรอบฐานด้านละ {EXCAVATION_MARGIN.toFixed(2)} ม.</li>
                        <li>ทรายหยาบเผื่อยุบตัว {Math.round((SAND_FACTOR - 1) * 100)}%</li>
                        <li>เหล็กแนวสั้น/ยาว ยาวเท่าฐาน + งอขึ้นสองข้างเท่าความหนาฐาน · เหล็กรัดรอบยาวเท่าเส้นรอบฐาน</li>
                    </ul>
                </div>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีตฐานราก', value: t.concrete, unit: 'ลบ.ม.' },
                { label: 'เหล็กเสริม', value: totalKg(t.rebar), unit: 'กก.' },
                { label: 'ไม้แบบ', value: t.formwork, unit: 'ตร.ม.' },
                { label: 'ดินขุด', value: t.excavation, unit: 'ลบ.ม.' },
                { label: 'ทรายหยาบ', value: t.sand, unit: 'ลบ.ม.' },
                { label: 'คอนกรีตหยาบ', value: t.lean, unit: 'ลบ.ม.' },
            ]} note={backfillTotal > 0
                ? `ดินถมกลับ ${formatNumber(backfillTotal)} ลบ.ม. — หักคอนกรีตเสาตอม่อให้อัตโนมัติเมื่อกรอกขั้นตอนเสาตอม่อ`
                : undefined} />
        </div>
    );
}
