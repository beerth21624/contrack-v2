'use client';

// Guided-journey view of the footing sheet: one card per footing type of the plan (F1, F2 …), filled from the
// foundation plan and the footing detail. Same input and calculation as the Excel-mirror table.
import { footingRow, footingTotals, newFootingRow, totalKg, EXCAVATION_MARGIN, SAND_FACTOR, type FootingRow } from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ElementCard, EmptyState, JBar, JGroup, JNumber, JText, ResultSummary, resultText,
} from '@/components/sheet/journey';

const label = (r: FootingRow, i: number) => r.name.trim() || `แบบที่ ${i + 1}`;

/** A footing whose pit is shallower than the footing and its bed digs a negative volume: ask for the depth. */
function depthWarning(r: FootingRow): string | undefined {
    const c = footingRow(r);
    if (c.concrete <= 0) return undefined;
    if (!(r.excavationDepth > 0)) return 'ยังไม่ได้ใส่ความลึกหลุมขุด — ดินขุดและดินถมกลับจะยังเป็น 0';
    if (c.backfillGross < 0) return 'หลุมขุดตื้นกว่าฐานราก + ทราย + คอนกรีตหยาบ — ตรวจความลึกหลุมขุดอีกครั้ง';
    return undefined;
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

    if (rows.length === 0) {
        return (
            <EmptyState
                text={<>ยังไม่มีฐานราก — เปิดแปลนฐานรากดูว่ามีฐานกี่แบบ (F1, F2 …) แล้วเพิ่มทีละแบบ</>}
                addLabel="เพิ่มฐานราก F1" onAdd={add} />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = footingRow(r);
                return (
                    <ElementCard key={i} title={`ฐานราก ${label(r, i)}`}
                        onDelete={() => onChange(rows.filter((_, j) => j !== i))} deleteTitle={`ลบฐานราก ${label(r, i)}?`}
                        warning={depthWarning(r)}
                        result={resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.shortKg + c.longKg + c.ringKg, unit: 'กก.' },
                            { label: 'ดินขุด', value: c.excavation, unit: 'ลบ.ม.' },
                        ])}>
                        <JGroup title="จากแปลนฐานราก">
                            <JText label="ชื่อฐาน" value={r.name} placeholder="เช่น F1" onChange={v => set(i, { name: v })} />
                            <JNumber label="จำนวนฐานแบบนี้" value={r.count} unit="ฐาน" digits={0}
                                onChange={v => set(i, { count: v })} hint="นับทุกจุดที่เขียน F แบบเดียวกัน" />
                        </JGroup>
                        <JGroup title="ขนาดฐาน (จากรูปขยายฐานราก)">
                            <JNumber label="ความกว้าง" value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <JNumber label="ความยาว" value={r.length} unit="ม." onChange={v => set(i, { length: v })} />
                            <JNumber label="ความหนา" value={r.depth} unit="ม." onChange={v => set(i, { depth: v })} />
                            <JNumber label="ความลึกหลุมขุด" value={r.excavationDepth} unit="ม." onChange={v => set(i, { excavationDepth: v })}
                                hint="จากผิวดินถึงก้นหลุม (รวมชั้นทรายและคอนกรีตหยาบ)" />
                        </JGroup>
                        <JGroup title="เหล็กเสริม (จากรูปขยายฐานราก, ต่อ 1 ฐาน)">
                            <JBar label="เหล็กแนวด้านสั้น" size={r.shortBarSize} onSize={v => set(i, { shortBarSize: v })}
                                amount={r.shortBarCount} onAmount={v => set(i, { shortBarCount: v })} />
                            <JBar label="เหล็กแนวด้านยาว" size={r.longBarSize} onSize={v => set(i, { longBarSize: v })}
                                amount={r.longBarCount} onAmount={v => set(i, { longBarCount: v })} />
                            <JBar label="เหล็กรัดรอบ" size={r.ringBarSize} onSize={v => set(i, { ringBarSize: v })}
                                amount={r.ringBarCount} onAmount={v => set(i, { ringBarCount: v })} amountUnit="รอบ" />
                        </JGroup>
                    </ElementCard>
                );
            })}

            <AddButton label="เพิ่มฐานรากแบบถัดไป" onClick={add} />

            <AdvancedSection title="ค่าตั้งต้น" hint="ไม่ต้องแก้ก็ได้">
                <div className="flex flex-col gap-3">
                    {rows.map((r, i) => (
                        <JGroup key={i} title={`ชั้นรองก้นหลุม ฐาน ${label(r, i)}`}>
                            <JNumber label="ทรายหยาบ หนา" value={r.sandThickness} unit="ม." onChange={v => set(i, { sandThickness: v })} />
                            <JNumber label="คอนกรีตหยาบ หนา" value={r.leanThickness} unit="ม." onChange={v => set(i, { leanThickness: v })} />
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
            ]} note={`ดินถมกลับ ${formatNumber(backfillTotal)} ลบ.ม. — หักคอนกรีตเสาตอม่อให้อัตโนมัติเมื่อกรอกขั้นตอนเสาตอม่อ`} />
        </div>
    );
}
