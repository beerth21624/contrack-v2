'use client';

// Journey-mode body of the stair level: one card per stair, sizes read off the stair detail (total rise and run
// follow steps × riser / tread), then the bars of the waist slab and steps, the formulas folded away, and a short
// result at the end. Same input and formulas as /calc.
import {
    newStairRow, stairRow, withStepChange, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_NAMES, type StairInput, type StairRow,
} from '@/domain/calculators/stair';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, isPositive,
    nextFreeName, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';

const nameOptions = STAIR_NAMES.map(v => ({ value: v as string, label: v }));
const sizeOptions = STAIR_BAR_SIZES.map(s => ({ value: s as string, label: s }));
const label = (r: StairRow, i: number) => (r.name === '' ? `บันได ${i + 1}` : r.name);

const rowKg = (r: StairRow) => {
    const c = stairRow(r);
    return c.waistMain.kg + c.waistTemp.kg + c.stepMain.kg + c.stepTemp.kg;
};

const L = {
    steps: 'จำนวนขั้น', riser: 'ลูกตั้ง สูง', tread: 'ลูกนอน กว้าง', width: 'ความกว้างบันได', waist: 'ท้องบันได หนา',
    rise: 'สูงรวม', run: 'ยาวแนวราบ',
} as const;

const checksOf = (r: StairRow) => planChecks([
    { label: L.steps, ok: isPositive(r.steps) },
    { label: L.riser, ok: isPositive(r.riser) },
    { label: L.tread, ok: isPositive(r.tread) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.waist, ok: isPositive(r.waist) },
    { label: L.rise, ok: isPositive(r.rise) },
    { label: L.run, ok: isPositive(r.run) },
// The bars come pre-set (RB9 @0.15): the sizes of the stair mark it as started.
], [r.steps, r.riser, r.tread, r.width, r.waist, r.rise, r.run].some(isPositive));

export function StairJourney({ input, outputs, onChange }: {
    input: StairInput; outputs: Record<string, number>; onChange: (rows: StairRow[]) => void;
}) {
    const rows = input.rows;
    const replace = (i: number, row: StairRow) => onChange(rows.map((r, j) => (j === i ? row : r)));
    const set = (i: number, patch: Partial<StairRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, { ...newStairRow(rows[rows.length - 1]), name: nextFreeName(STAIR_NAMES, rows.map(r => r.name)) }]);

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีบันได — ดูรูปขยายบันได แล้วเพิ่มทีละชุด (จำนวนขั้น ลูกตั้ง ลูกนอน และความกว้าง)"
                addLabel="เพิ่มบันไดชุดแรก" onAdd={add} />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = stairRow(r);
                const k = checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={label(r, i)}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.', digits: 3 },
                            { label: 'เหล็ก', value: rowKg(r), unit: 'กก.', digits: 1 },
                        ])}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบ${label(r, i)}?`}>
                        <PlanGroup title="ลูกบันได (จากรูปขยายบันได)">
                            <PlanField label="ชื่อบันได" className="col-span-2 sm:col-span-3 lg:col-span-4">
                                <ChoiceButtons<string> size="small" ariaLabel="ชื่อบันได" value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.steps} value={r.steps} unit="ขั้น" digits={0}
                                onChange={v => replace(i, withStepChange(r, { steps: v }))} />
                            <PlanNumber label={L.riser} value={r.riser} unit="ม." range={[0.1, 0.3]}
                                onChange={v => replace(i, withStepChange(r, { riser: v }))} />
                            <PlanNumber label={L.tread} value={r.tread} unit="ม." range={[0.15, 0.5]}
                                onChange={v => replace(i, withStepChange(r, { tread: v }))} />
                        </PlanGroup>
                        <PlanGroup title="แม่บันได" hint="สูงรวมและยาวแนวราบ ระบบเติมจากจำนวนขั้นให้ — แก้เองได้ถ้ามีชานพัก">
                            <PlanNumber label={L.width} value={r.width} unit="ม." range={[0.5, 5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.waist} value={r.waist} unit="ม." range={[0.05, 0.4]} onChange={v => set(i, { waist: v })} />
                            <PlanNumber label={L.rise} value={r.rise} unit="ม." onChange={v => set(i, { rise: v })} />
                            <PlanNumber label={L.run} value={r.run} unit="ม." onChange={v => set(i, { run: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม" hint="ตั้งไว้ RB9 @0.15 ม. — แก้ตามรูปขยายบันได" layout="wide">
                            <BarField label="ท้องบันได เหล็กหลัก" sizes={STAIR_BAR_SIZES} size={r.waistMainSize}
                                onSize={v => set(i, { waistMainSize: v })} amount={r.waistMainSpacing}
                                onAmount={v => set(i, { waistMainSpacing: v })} amountLabel="ระยะห่าง @" amountUnit="ม." amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <BarField label="ท้องบันได เหล็กกันร้าว" sizes={STAIR_BAR_SIZES} size={r.waistTempSize}
                                onSize={v => set(i, { waistTempSize: v })} amount={r.waistTempSpacing}
                                onAmount={v => set(i, { waistTempSpacing: v })} amountLabel="ระยะห่าง @" amountUnit="ม." amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <BarField label="ลูกบันได เหล็กหลัก" sizes={STAIR_BAR_SIZES} size={r.stepMainSize}
                                onSize={v => set(i, { stepMainSize: v })} amount={r.stepMainSpacing}
                                onAmount={v => set(i, { stepMainSpacing: v })} amountLabel="ระยะห่าง @" amountUnit="ม." amountDigits={2}
                                presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <PlanField label="ลูกบันได เหล็กกันร้าว" hint="คิดขั้นละ 2 เส้น">
                                <ChoiceButtons<string> size="small" ariaLabel="ลูกบันได เหล็กกันร้าว ขนาดเหล็ก"
                                    value={r.stepTempSize === '' ? undefined : r.stepTempSize} options={sizeOptions}
                                    onChange={v => set(i, { stepTempSize: v })} />
                            </PlanField>
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มบันไดอีกชุด" onClick={add} />

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>ยาวแนวเอียง = √(ยาวแนวราบ² + สูงรวม²)</li>
                    <li>คอนกรีต = ท้องบันได (หนา × ยาวแนวเอียง × กว้าง) + ลูกบันได (จำนวนขั้น × ½ × ลูกนอน × ลูกตั้ง × กว้าง)</li>
                    <li>ไม้แบบ = ท้อง + ข้างท้องบันได + ข้างลูกบันได + ไม้กั้นขั้น · ไม้ค้ำยัน = ปัดขึ้น (พื้นที่ท้อง ÷ 0.6) ต้น</li>
                    <li>เหล็กหลักท้องบันได = ปัดขึ้น (กว้าง ÷ ระยะห่าง) เส้น × (ยาวแนวเอียง + {STAIR_ANCHORAGE} ม. ระยะฝัง)</li>
                    <li>เหล็กกันร้าวท้องบันได = ปัดขึ้น (ยาวแนวเอียง ÷ ระยะห่าง) เส้น × กว้าง</li>
                    <li>เหล็กหลักลูกบันได = ปัดขึ้น (กว้าง ÷ ระยะห่าง) เส้น × (ยาวแนวราบ + สูงรวม) · เหล็กกันร้าวลูกบันได = 2 × จำนวนขั้น × กว้าง</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
