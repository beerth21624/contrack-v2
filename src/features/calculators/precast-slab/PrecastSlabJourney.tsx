'use client';

// Journey-mode body of the precast-slab level: one short card per span read off the slab plan, the shear-key
// bar and topping (standard values) folded away, and a short result at the end. Same input and formulas as /calc.
import {
    newPrecastPanel, precastPanel, PS_BAR_SIZES, type PrecastPanelRow, type PrecastSlabInput,
} from '@/domain/calculators/precast-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, EmptyState, FillProgress, PlanCard, PlanNumber, ResultSummary, countFill, insertAfter, isPositive, planChecks,
    removeAt, resultText,
} from '@/components/sheet/journey';

const sizeOptions = PS_BAR_SIZES.map(v => ({ value: v }));
const L = { width: 'ความกว้างช่วง', length: 'ความยาวช่วง' } as const;
/** Show the fill progress only once the list is long enough to lose track of. */
const PROGRESS_FROM = 5;

const checksOf = (r: PrecastPanelRow) => planChecks([
    { label: L.width, ok: isPositive(r.width) },
    { label: L.length, ok: isPositive(r.length) },
]);

export function PrecastSlabJourney({ input, outputs, onChange }: {
    input: PrecastSlabInput; outputs: Record<string, number>; onChange: (panels: PrecastPanelRow[]) => void;
}) {
    const rows = input.panels;
    const set = (i: number, patch: Partial<PrecastPanelRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...rows, newPrecastPanel(rows[rows.length - 1])]);
    /** A span of the same size (rooms of one size are common). */
    const duplicate = (r: PrecastPanelRow, i: number) => onChange(insertAfter(rows, i, { ...r }));
    const shearKey = REBAR_SIZES.reduce((s, size) => s + (outputs[`rebar.${size}`] ?? 0), 0);

    if (rows.length === 0) {
        return (
            <EmptyState text="ยังไม่มีพื้นสำเร็จรูป — ดูแปลนพื้น (PS) แล้วเพิ่มทีละช่วง (กว้าง × ยาว)"
                addLabel="เพิ่มช่วงแรก" onAdd={add} />
        );
    }

    const checks = rows.map(checksOf);

    return (
        <div className="flex flex-col gap-3">
            {rows.length >= PROGRESS_FROM && (
                <FillProgress {...countFill(checks.map(c => c.state))} noun="ช่วง" doneText="ครบทุกช่วงแล้ว" />
            )}

            {rows.map((r, i) => {
                const c = precastPanel(r);
                const k = checks[i] ?? checksOf(r);
                return (
                    <PlanCard key={i} index={i + 1} state={k.state} hasData={k.hasData} missingText={k.missingText} compact
                        title={`ช่วงที่ ${String(i + 1)}`}
                        result={k.state === 'empty' ? undefined : resultText([
                            { label: 'พื้นที่', value: c.area, unit: 'ตร.ม.' },
                        ])}
                        onDuplicate={() => duplicate(r, i)}
                        onDelete={() => onChange(removeAt(rows, i))} deleteTitle={`ลบช่วงที่ ${i + 1}?`}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                            <PlanNumber label={L.width} value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <PlanNumber label={L.length} value={r.length} unit="ม." onChange={v => set(i, { length: v })} />
                        </div>
                    </PlanCard>
                );
            })}

            <AddButton label="เพิ่มช่วงถัดไป" onClick={add} />

            <AdvancedSection title="เหล็กล็อคหัวแผ่น และคอนกรีตทับหน้า" hint="ค่ามาตรฐาน ไม่ต้องแก้ก็ได้">
                <EditableTable<PrecastPanelRow>
                    rows={rows}
                    onChange={onChange}
                    canDelete={false}
                    columns={[
                        { kind: 'label', key: 'panel', title: 'ช่วง', width: 100,
                            get: (r, i) => `${String(i + 1)}. ${formatNumber(r.width)} × ${formatNumber(r.length)} ม.` },
                        { kind: 'select', key: 'keySize', title: 'เหล็กล็อคหัวแผ่น', width: 90, options: sizeOptions,
                            get: r => r.keySize, set: (r, v) => ({ ...r, keySize: v }) },
                        { kind: 'number', key: 'keySpacing', title: 'ระยะห่าง (ม.)', width: 80,
                            get: r => r.keySpacing, set: (r, v) => ({ ...r, keySpacing: v }) },
                        { kind: 'number', key: 'keyBarLength', title: 'ยาวเส้นละ (ม.)', width: 80,
                            get: r => r.keyBarLength, set: (r, v) => ({ ...r, keyBarLength: v }) },
                        { kind: 'number', key: 'topping', title: 'คอนกรีตทับหน้า หนา (ม.)', width: 100,
                            get: r => r.topping, set: (r, v) => ({ ...r, topping: v }) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>พื้นสำเร็จรูป และไวร์เมช = กว้าง × ยาว · ไม้ค้ำยันคิดจากพื้นที่ให้อัตโนมัติ</li>
                    <li>เหล็กล็อคหัวแผ่น: จำนวน = ปัดขึ้น (2 × กว้าง ÷ ระยะห่าง) เส้น × ยาวเส้นละ (นับรวมในงานคานคอดิน)</li>
                    <li>คอนกรีตทับหน้า = พื้นที่ × หนา · ไม้แบบขอบ = 2 × (กว้าง + ยาว) × หนา</li>
                </ul>
            </AdvancedSection>

            <ResultSummary
                items={[
                    { label: 'พื้นสำเร็จรูป', value: outputs.area ?? 0, unit: 'ตร.ม.' },
                    { label: 'คอนกรีตทับหน้า', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                ]}
                minor={[
                    { label: 'ไวร์เมช', value: outputs.wiremesh ?? 0, unit: 'ตร.ม.' },
                    { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                    { label: 'เหล็กล็อคหัวแผ่น', value: shearKey, unit: 'กก.', digits: 1 },
                ]}
            />
        </div>
    );
}
