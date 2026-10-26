'use client';

// Journey-mode body of the roof-slab level: one card per panel read off the roof-slab plan, the formulas folded
// away, and a short result at the end. Same input and formulas as /calc.
import {
    newRoofSlabRow, roofSlabRow, ROOF_SLAB_BAR_SIZES, ROOF_SLAB_LAYERS, ROOF_SLAB_NAMES, type RoofSlabInput, type RoofSlabRow,
} from '@/domain/calculators/roof-slab';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, BarField, ChoiceButtons, EmptyState, FillProgress, PlanCard, PlanField, PlanGroup, PlanNumber, ResultSummary,
    countFill, insertAfter, isPositive, planChecks, rebarSummaryItem, removeAt, resultText,
} from '@/components/sheet/journey';

const nameOptions = ROOF_SLAB_NAMES.map(v => ({ value: v as string, label: v }));
const layerOptions = ROOF_SLAB_LAYERS.map(v => ({ value: v as number, label: `${v} ชั้น` }));
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const L = { width: 'ความกว้าง', length: 'ความยาว', thickness: 'ความหนา', bars: 'เหล็กเสริม' } as const;

const checksOf = (r: RoofSlabRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
    { label: L.thickness, ok: isPositive(r.thickness) },
    { label: L.bars, ok: r.size !== '' && isPositive(r.spacing) && isPositive(r.layers) },
// Thickness and bars are copied from the previous panel: the panel's own size marks it as started.
], isPositive(r.width) || isPositive(r.length));

export function RoofSlabJourney({ input, outputs, onChange }: {
    input: RoofSlabInput; outputs: Record<string, number>; onChange: (rows: RoofSlabRow[]) => void;
}) {
    const rows = input.rows;
    const set = (i: number, patch: Partial<RoofSlabRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newRoofSlabRow(rows[rows.length - 1])]);
    /** A panel of the same size and spec (each panel is its own card). */
    const duplicate = (r: RoofSlabRow, i: number) => onChange(insertAfter(rows, i, { ...r }));

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีพื้นดาดฟ้า — ดูแปลนพื้นดาดฟ้า (RS) แล้วเพิ่มทีละผืน (กว้าง × ยาว × หนา และเหล็กเสริม)"
                addLabel="เพิ่มพื้นผืนแรก" onAdd={add} />
        );
    }

    const checks = rows.map(checksOf);

    return (
        <div className="flex flex-col gap-3">
            {rows.length >= PROGRESS_FROM && (
                <FillProgress {...countFill(checks.map(c => c.state))} noun="ผืน" doneText="ครบทุกผืนแล้ว" />
            )}

            {rows.map((r, i) => {
                const c = roofSlabRow(r);
                const k = checks[i] ?? checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={`ผืนที่ ${String(i + 1)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.', digits: 3 },
                            { label: 'เหล็ก', value: c.kg, unit: 'กก.', digits: 1 },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบพื้นผืนที่ ${i + 1}?`}>
                        <PlanGroup title="ขนาดผืน (จากแปลนพื้นดาดฟ้า)">
                            <PlanField label="ชื่อพื้น">
                                <ChoiceButtons<string> size="small" ariaLabel="ชื่อพื้น" value={r.name === '' ? undefined : r.name}
                                    options={nameOptions} onChange={v => set(i, { name: v })} />
                            </PlanField>
                            <PlanNumber label={L.width} value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} value={r.length} unit="ม." onChange={v => set(i, { length: v })} />
                            <PlanNumber label={L.thickness} value={r.thickness} unit="ม." presets={[0.1, 0.12, 0.15]} range={[0.05, 0.4]}
                                onChange={v => set(i, { thickness: v })} />
                        </PlanGroup>
                        <PlanGroup title="เหล็กเสริม" hint="เช่น RB9 @0.20 ม. 2 ชั้น" layout="wide">
                            <BarField label={L.bars} sizes={ROOF_SLAB_BAR_SIZES} size={r.size} onSize={v => set(i, { size: v })}
                                amount={r.spacing} onAmount={v => set(i, { spacing: v })} amountLabel="ระยะห่าง @" amountUnit="ม."
                                amountDigits={2} presets={[0.15, 0.2]} range={[0.05, 0.5]} />
                            <PlanField label="วางเหล็ก">
                                <ChoiceButtons<number> size="small" ariaLabel="วางเหล็ก" value={r.layers} options={layerOptions}
                                    onChange={v => set(i, { layers: v })} />
                            </PlanField>
                        </PlanGroup>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มพื้นอีกผืน" onClick={add} />

            <AdvancedSection title="วิธีคิด" hint="ระบบคิดให้อัตโนมัติ">
                <ul className="list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>คอนกรีต = กว้าง × ยาว × หนา · ไม้แบบท้องพื้น = กว้าง × ยาว · ไม้ค้ำยัน = ปัดขึ้น (พื้นที่ ÷ 0.6) ต้น</li>
                    <li>เหล็กเสริม = กว้าง × ยาว ÷ ระยะห่าง × 2 ทิศทาง × จำนวนชั้น (ม.) × น้ำหนักเหล็กต่อเมตร</li>
                    <li>เหล็กเสริมแยกตามขนาด พร้อมเผื่อและลวดผูกเหล็ก</li>
                </ul>
            </AdvancedSection>

            <ResultSummary items={[
                { label: 'คอนกรีต', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                { label: 'ไม้ค้ำยัน', value: outputs.props ?? 0, unit: 'ต้น', digits: 0 },
                rebarSummaryItem(outputs),
            ]} />
        </div>
    );
}
