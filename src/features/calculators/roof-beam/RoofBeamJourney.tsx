'use client';

// Journey-mode body of the roof-beam level: one card per beam (or per group of alike beams, lengths added up)
// read off the roof-beam plan, the formulas folded away, and a short result at the end. Same input and
// formulas as /calc.
import {
    newRoofBeamRow, roofBeamRow, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamInput, type RoofBeamRow,
} from '@/domain/calculators/roof-beam';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, insertAfter,
    isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';

const nameOptions = ROOF_BEAM_NAMES.map(v => ({ value: v as string, label: v }));
const label = (r: RoofBeamRow, i: number) => (r.name === '' ? `คานที่ ${i + 1}` : `คาน ${r.name}`);

const L = {
    width: 'ความกว้าง', depth: 'ความลึก', length: 'ความยาวรวม', main: 'เหล็กแกน (บน + ล่าง)', stirrup: 'เหล็กปลอก',
} as const;

const checksOf = (r: RoofBeamRow) => planChecks([
    { label: L.length, ok: isPositive(r.length) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// The stirrups come pre-set (RB6 @0.15): only a typed size, length or bar count marks the beam as started.
], [r.length, r.width, r.depth, r.mainCount].some(isPositive));

export function RoofBeamJourney({ input, outputs, onChange }: {
    input: RoofBeamInput; outputs: Record<string, number>; onChange: (rows: RoofBeamRow[]) => void;
}) {
    const rows = input.rows;
    const set = (i: number, patch: Partial<RoofBeamRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newRoofBeamRow(rows[rows.length - 1])]);
    /** Same section and bars as this beam; the length to fill. */
    const duplicate = (r: RoofBeamRow, i: number) => onChange(insertAfter(rows, i, newRoofBeamRow(r)));

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีคาน — ดูแปลนคานชั้นหลังคา (RB) แล้วเพิ่มทีละแนวคาน (ขนาด ความยาว และเหล็กเสริม)"
                addLabel="เพิ่มคานเส้นแรก" onAdd={add} />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = roofBeamRow(r);
                const k = checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={label(r, i)}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainKg + c.stirrupKg, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบ${label(r, i)}?`}>
                        <PlanGroup title="จากแปลนคานหลังคา">
                            <PlanField label="ชื่อคาน" className="col-span-2">
                                <ChoiceButtons<string> size="small" ariaLabel="ชื่อคาน" value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.length} value={r.length} unit="ม." placeholder="เช่น 4+4.5+3"
                                hint="รวมทุกช่วงของคานขนาดนี้" onChange={v => set(i, { length: v })} />
                        </PlanGroup>
                        <PlanGroup title="ขนาดคาน (จากรูปตัดคาน)">
                            <PlanNumber label={L.width} value={r.width} unit="ม." range={[0.1, 1]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} value={r.depth} unit="ม." range={[0.15, 1.5]} onChange={v => set(i, { depth: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม" hint="บน 3-DB12 ล่าง 3-DB12 → DB12, 6 เส้น" layout="wide">
                            <BarField label={L.main} sizes={ROOF_BEAM_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={ROOF_BEAM_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel="ระยะห่าง @"
                                amountUnit="ม." amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มคานอีกขนาด" onClick={add} />

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ลึก × ยาว · ไม้แบบ = ข้าง 2 ด้าน (2 × ลึก × ยาว) + ท้องคาน (กว้าง × ยาว)</li>
                    <li>ไม้ค้ำยัน = ปัดขึ้น (ยาว ÷ 0.6) ต้น</li>
                    <li>เหล็กแกน = จำนวนเส้น × ยาว · เหล็กปลอก = ปัดขึ้น (ยาว ÷ ระยะห่าง) ปลอก × 2 × (กว้าง + ลึก)</li>
                    <li>เหล็กเสริมแยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.' },
                { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                { label: 'ไม้ค้ำยัน', value: outputs.props ?? 0, unit: 'ต้น', digits: 0 },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
