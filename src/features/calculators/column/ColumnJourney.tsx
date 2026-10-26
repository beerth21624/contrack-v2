'use client';

// Journey-mode body of the column level: one card per column type (C1, C2 …) read off the column plan and
// detail, the formulas folded away, and a short result at the end. Same input and formulas as /calc.
import {
    columnRowCalc, COLUMN_BAR_SIZES, COLUMN_NAMES, newColumnRow, type ColumnInput, type ColumnRow,
} from '@/domain/calculators/column';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary, insertAfter,
    isPositive, nextFreeName, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';

const nameOptions = COLUMN_NAMES.map(v => ({ value: v as string, label: v }));
const label = (r: ColumnRow, i: number) => (r.name === '' ? `แบบที่ ${i + 1}` : r.name);

const L = {
    count: 'จำนวนต้น', width: 'ความกว้าง', depth: 'ความยาว', height: 'ความสูงเสา', main: 'เหล็กยืน', stirrup: 'เหล็กปลอก',
} as const;

const checksOf = (r: ColumnRow) => planChecks([
    { label: L.count, ok: isPositive(r.count) },
    { label: L.width, ok: isPositive(r.width) },
    { label: L.depth, ok: isPositive(r.depth) },
    { label: L.height, ok: isPositive(r.height) },
    { label: L.main, ok: isPositive(r.mainCount) && r.mainSize !== '' },
    { label: L.stirrup, ok: isPositive(r.stirrupSpacing) && r.stirrupSize !== '' },
// Height and bars may be copied from the previous column: the count or the size marks a column as started.
], [r.count, r.width, r.depth].some(isPositive));

export function ColumnJourney({ input, outputs, onChange }: {
    input: ColumnInput; outputs: Record<string, number>; onChange: (columns: ColumnRow[]) => void;
}) {
    const rows = input.columns;
    const set = (i: number, patch: Partial<ColumnRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const freeName = () => nextFreeName(COLUMN_NAMES, rows.map(r => r.name));
    const add = () => onChange([...rows, { ...newColumnRow(rows[rows.length - 1]), name: freeName() }]);
    /** Same size, height and bars; the count to fill. */
    const duplicate = (r: ColumnRow, i: number) => onChange(insertAfter(rows, i, { ...r, name: freeName(), count: 0 }));

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีเสา — ดูแปลนเสาและรูปขยายเสา แล้วเพิ่มทีละแบบ (C1, C2 …) พร้อมจำนวนต้น"
                addLabel="เพิ่มเสา C1" onAdd={add} />
        );
    }

    const nextName = freeName();

    return (
        <div className="flex flex-col gap-4">
            {rows.map((r, i) => {
                const c = columnRowCalc(r);
                const k = checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} scope={{ listKey: 'columns', itemIndex: i }} state={k.state} hasData={k.hasData} missingText={k.missingText}
                        title={`เสา ${label(r, i)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainWeight + c.stirrupWeight, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบเสา ${label(r, i)}?`}>
                        <PlanGroup title="จากแปลนเสา">
                            <PlanField label="ชื่อเสา">
                                <ChoiceButtons<string> size="small" ariaLabel="ชื่อเสา" value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.count} fieldKey="count" value={r.count} unit="ต้น" digits={0} onChange={v => set(i, { count: v })} />
                        </PlanGroup>
                        <PlanGroup title="ขนาดเสา (จากรูปขยายเสา)">
                            <PlanNumber label={L.width} fieldKey="width" value={r.width} unit="ม." range={[0.1, 1.5]} onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.depth} fieldKey="depth" value={r.depth} unit="ม." range={[0.1, 1.5]} onChange={v => set(i, { depth: v })} />
                            <PlanNumber label={L.height} fieldKey="height" value={r.height} unit="ม." range={[1, 12]} placeholder="เช่น 0.55+3.5"
                                hint="จากหลังฐานรากถึงใต้คานบน" onChange={v => set(i, { height: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม ต่อ 1 ต้น" hint="เช่น 6-DB12 ปลอก RB6 @0.15" layout="wide">
                            <BarField label={L.main} sizes={COLUMN_BAR_SIZES} size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <BarField label={L.stirrup} sizes={COLUMN_BAR_SIZES} size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountLabel="ระยะห่าง @"
                                amountUnit="ม." amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label={nextName === '' ? 'เพิ่มเสาอีกแบบ' : `เพิ่มเสา ${nextName}`} onClick={add} />

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = จำนวนต้น × กว้าง × ยาว × สูง · ไม้แบบ = จำนวนต้น × 2 × (กว้าง + ยาว) × สูง</li>
                    <li>เหล็กยืน = จำนวนต้น × จำนวนเส้น × ความสูงเสา</li>
                    <li>เหล็กปลอก = ปัดขึ้น (สูง ÷ ระยะห่าง) ปลอกต่อต้น × 2 × (กว้าง + ยาว)</li>
                    <li>เหล็กเสริมเสานับรวมในงานเหล็กเสริม แยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.' },
                { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
