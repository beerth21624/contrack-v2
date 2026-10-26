'use client';

// Guided-journey view of the piling level: the pile spec and count from the foundation plan; the lump price
// per pile folded away. Same input as the Excel-mirror form.
import {
    composePileSpec, missingPileSpec, PILE_SECTION_GROUPS, PILE_TYPES, type PilesInput,
} from '@/domain/calculators/piles';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    ChoiceButtons, JGroup, JNumber, JSelect, JText, PlanField, PlanNumber, ResultSummary,
} from '@/components/sheet/journey';

const typeOptions = PILE_TYPES.map(t => ({ value: t as string, label: t }));

export function PilesJourney({ input, update }: { input: PilesInput; update: (patch: Partial<PilesInput>) => void }) {
    const spec = composePileSpec(input);
    const missing = missingPileSpec(input);
    const count = Number.isFinite(input.count) ? input.count : 0;
    const price = Number.isFinite(input.pricePerPile) ? input.pricePerPile : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <JGroup title="เสาเข็ม (จากแปลนฐานราก / รายการประกอบแบบ)">
                    <PlanField label="ชนิดเสาเข็ม" className="col-span-2">
                        <ChoiceButtons<string> size="small" ariaLabel="ชนิดเสาเข็ม" value={input.pileType === '' ? undefined : input.pileType}
                            options={typeOptions} onChange={v => update({ pileType: v })} />
                    </PlanField>
                    <JSelect<string> label="หน้าตัด / รูปทรง" value={input.section || undefined} placeholder="เลือกหน้าตัด"
                        options={PILE_SECTION_GROUPS.map(g => ({ label: g.label, options: g.options.map(o => ({ value: o })) }))}
                        onChange={v => update({ section: v ?? '' })} />
                    <PlanNumber label="ความยาวต่อต้น" value={input.length} unit="ม." range={[1, 40]} onChange={v => update({ length: v })} />
                    <JNumber label="จำนวนเสาเข็มทั้งหมด" value={input.count} unit="ต้น" digits={0} onChange={v => update({ count: v })}
                        hint="นับจากแปลนฐานราก (ทุกฐานรวมกัน)" />
                </JGroup>
                <JGroup title="">
                    <JText wide label="รายละเอียดเพิ่มเติม (ถ้ามี)" value={input.extraSpec} placeholder="เช่น รับน้ำหนัก 15 ตัน/ต้น, ยี่ห้อ"
                        onChange={v => update({ extraSpec: v })} />
                </JGroup>
                {count > 0 && missing.length > 0 && (
                    <div className="mt-3 text-[12px] text-red-600">ยังขาด: {missing.join(', ')} — ราคาเหมาต้องระบุรายละเอียดเข็มให้ครบ</div>
                )}
            </div>

            <AdvancedSection>
                <JGroup title="ราคาเหมา">
                    <JNumber label="ราคาเหมาต่อต้น (ค่าเสาเข็ม + ค่าตอก)" value={input.pricePerPile} unit="บาท"
                        onChange={v => update({ pricePerPile: v })} />
                </JGroup>
            </AdvancedSection>

            {/* The money is มูลค่าขั้นตอนนี้ in the bottom bar. */}
            <ResultSummary items={[
                { label: 'เสาเข็ม', value: count, unit: 'ต้น', digits: 0, detail: `ราคาเหมาต้นละ ${formatNumber(price, 0)} บาท` },
            ]} note={count > 0 ? <>
                {spec ? <>รายการใน BOQ: {spec}</> : 'ยังไม่ได้เลือกชนิดและหน้าตัดเสาเข็ม'}
                {' · '}ค่าตัดหัวเสาเข็ม {formatNumber(count, 0)} ต้น คิดให้อัตโนมัติในขั้นตอนฐานราก
            </> : undefined}
            empty={<>เลือกชนิดเสาเข็ม หน้าตัด ความยาว และใส่จำนวนต้นจากแปลนฐานราก — หากไม่ใช้เสาเข็ม กด &quot;ไม่มีในโครงการนี้&quot; ด้านล่าง</>} />
        </div>
    );
}
