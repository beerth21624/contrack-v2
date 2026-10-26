'use client';

// Guided-journey view of the ground-beam sheet: one card per beam type of the ground-beam plan (one row of the
// sheet = every span of that type, lengths added up). Same input and calculation as the Excel-mirror table.
import {
    groundBeamRebar, groundBeamRow, groundBeamTotals, newGroundBeamRow, BEAM_BAR_SIZES, type GroundBeamRow,
} from '@/domain/calculators/ground-beam';
import { totalKg } from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, EmptyState, JGroup, JText, PlanCard, PlanGroup, PlanNumber, ResultSummary, insertAfter, isPositive,
    planChecks, removeAt, resultText,
} from '@/components/sheet/journey';

const label = (r: GroundBeamRow, i: number) => (r.name.trim() === '' ? `แบบที่ ${i + 1}` : r.name.trim());

const L = {
    length: 'ความยาวรวมทุกช่วง', width: 'ความกว้าง', depth: 'ความลึก', main: 'เหล็กเสริมหลัก (บน + ล่าง)', stirrup: 'เหล็กปลอก',
} as const;

const checksOf = (r: GroundBeamRow) => planChecks([
    { label: L.length, ok: isPositive(r.length) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The stirrups come pre-set (RB6 @0.15): only a typed size, length or bar count marks the beam as started.
], [r.length, r.width, r.depth, r.mainCount].some(isPositive));

export function GroundBeamJourney({ beams, onChange }: { beams: GroundBeamRow[]; onChange: (beams: GroundBeamRow[]) => void }) {
    const set = (i: number, patch: Partial<GroundBeamRow>) => onChange(beams.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...beams, newGroundBeamRow(beams)]);
    /** Same section and bars, next free name, the length to fill. */
    const duplicate = (r: GroundBeamRow, i: number) => onChange(insertAfter(beams, i, { ...r, name: newGroundBeamRow(beams).name, length: 0 }));

    if (beams.length === 0) {
        return (
            <EmptyState
                text={<>ยังไม่มีคานคอดิน — เปิดแปลนคานคอดินดูว่ามีคานกี่แบบ แล้วเพิ่มทีละแบบพร้อมความยาวรวมทุกช่วง</>}
                addLabel="เพิ่มคานคอดินแบบแรก" onAdd={add} />
        );
    }

    const t = groundBeamTotals({ beams });
    const nextName = newGroundBeamRow(beams).name;

    return (
        <div className="flex flex-col gap-4">
            {beams.map((r, i) => {
                const c = groundBeamRow(r);
                const k = checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={`คานคอดิน ${label(r, i)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainWeight + c.stirrupWeight, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(beams, i))} deleteTitle={`ลบคาน ${label(r, i)}?`}>
                        <PlanGroup title="จากแปลนคานคอดิน">
                            <JText label="ชื่อคาน" value={r.name} placeholder="เช่น B1" onChange={v => set(i, { name: v })} />
                            <PlanNumber label={L.length} value={r.length} unit="ม." placeholder="เช่น 4+3.5+4"
                                hint="บวกทุกช่วงของคานแบบนี้" onChange={v => set(i, { length: v })} />
                        </PlanGroup>
                        <PlanGroup title="ขนาดคาน (จากรูปตัดคาน)">
                            <PlanNumber label={L.width} value={r.width} unit="ม." range={[0.1, 1]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} value={r.depth} unit="ม." range={[0.15, 1.5]} onChange={v => set(i, { depth: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม (จากรูปตัดคาน)" hint="บน 2-DB12 ล่าง 2-DB12 → DB12, 4 เส้น" layout="wide">
                            <BarField label={L.main} sizes={BEAM_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={BEAM_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel="ระยะห่าง @"
                                amountUnit="ม." amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? 'เพิ่มคานคอดินแบบถัดไป' : `เพิ่มคานคอดิน ${nextName}`} onClick={add} />

            <AdvancedSection title="ค่าตั้งต้น">
                <div className="flex flex-col gap-3">
                    <JGroup title="คอนกรีตหยาบรองท้องคาน หนา">
                        {beams.map((r, i) => (
                            <PlanNumber key={i} label={`คาน ${label(r, i)}`} value={r.leanThickness} unit="ม." presets={[0.05]}
                                onChange={v => set(i, { leanThickness: v })} />
                        ))}
                    </JGroup>
                    <ul className="text-[12px] text-gray-500 list-disc pl-5 space-y-0.5">
                        <li>เหล็กเสริมหลักคิดเต็มความยาวคาน ไม่รวมระยะทาบและงอ</li>
                        <li>จำนวนปลอก = ความยาวคาน ÷ ระยะห่าง (ปัดขึ้น) · ไม้แบบคิด 2 ข้างคาน (ท้องคานวางบนคอนกรีตหยาบ)</li>
                    </ul>
                </div>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีตคาน', value: t.concrete, unit: 'ลบ.ม.' },
                { label: 'เหล็กเสริม', value: totalKg(groundBeamRebar({ beams })), unit: 'กก.' },
                { label: 'ไม้แบบ', value: t.formwork, unit: 'ตร.ม.' },
                { label: 'คอนกรีตหยาบ', value: t.lean, unit: 'ลบ.ม.' },
            ]} note="ดินถมกลับของหมวดนี้มาจากขั้นตอนฐานรากและเสาตอม่อ" />
        </div>
    );
}
