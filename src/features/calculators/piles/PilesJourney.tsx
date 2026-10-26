'use client';

// Guided-journey view of the piling level: the pile spec and count from the foundation plan; the lump price
// per pile folded away. Same input as the Excel-mirror form.
import {
    composePileSpec, missingPileSpec, PILE_SECTION_GROUPS, PILE_TYPES, type PilesInput,
} from '@/domain/calculators/piles';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';
import { JGroup, JNumber, JSelect, JText, ResultSummary } from '../footing/JourneyParts';

export function PilesJourney({ input, update }: { input: PilesInput; update: (patch: Partial<PilesInput>) => void }) {
    const spec = composePileSpec(input);
    const missing = missingPileSpec(input);
    const count = Number.isFinite(input.count) ? input.count : 0;
    const price = Number.isFinite(input.pricePerPile) ? input.pricePerPile : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <JGroup title="เสาเข็ม (จากแปลนฐานราก / รายการประกอบแบบ)">
                    <JSelect<string> label="ชนิดเสาเข็ม" value={input.pileType || undefined} placeholder="เลือกชนิด"
                        options={PILE_TYPES.map(t => ({ value: t }))} onChange={v => update({ pileType: v ?? '' })} />
                    <JSelect<string> label="หน้าตัด / รูปทรง" value={input.section || undefined} placeholder="เลือกหน้าตัด"
                        options={PILE_SECTION_GROUPS.map(g => ({ label: g.label, options: g.options.map(o => ({ value: o })) }))}
                        onChange={v => update({ section: v ?? '' })} />
                    <JNumber label="ความยาวต่อต้น" value={input.length} unit="ม." onChange={v => update({ length: v })} />
                    <JNumber label="จำนวนเสาเข็มทั้งหมด" value={input.count} unit="ต้น" digits={0} onChange={v => update({ count: v })}
                        hint="นับจากแปลนฐานราก (ทุกฐานรวมกัน)" />
                </JGroup>
                <JGroup title="ไม่บังคับ">
                    <JText wide label="spec เพิ่มเติม" value={input.extraSpec} placeholder="เช่น รับน้ำหนัก 15 ตัน/ต้น, ยี่ห้อ"
                        onChange={v => update({ extraSpec: v })} />
                </JGroup>
                {count > 0 && missing.length > 0 && (
                    <div className="mt-3 text-[12px] text-orange-600">ราคาเหมาต้องระบุ spec ให้ครบ — ยังไม่ได้เลือก: {missing.join(', ')}</div>
                )}
            </div>

            <AdvancedSection hint="ไม่ต้องแก้ก็ได้">
                <JGroup title="ราคาเหมา">
                    <JNumber label="ราคาเหมาต่อต้น (ค่าเสาเข็ม + ค่าตอก)" value={input.pricePerPile} unit="บาท"
                        onChange={v => update({ pricePerPile: v })} />
                </JGroup>
            </AdvancedSection>

            <ResultSummary parts={[
                { label: 'เสาเข็ม', value: count, unit: 'ต้น', digits: 0 },
                { label: 'ราคาเหมา', value: price, unit: 'บาท/ต้น', digits: 0 },
                { label: 'รวม', value: count * price, unit: 'บาท', digits: 0 },
            ]} note={<>
                {spec ? <>รายการใน BOQ: {spec}</> : 'ยังไม่ได้ระบุ spec เสาเข็ม'}
                {count > 0 && <> · ค่าตัดหัวเสาเข็ม {formatNumber(count, 0)} ต้น คิดให้เองในด่านฐานราก</>}
            </>} />
        </div>
    );
}
