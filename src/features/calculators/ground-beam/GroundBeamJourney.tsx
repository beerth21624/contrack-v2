'use client';

// Guided-journey view of the ground-beam sheet: one card per beam type of the ground-beam plan (one row of the
// sheet = every span of that type, lengths added up). Same input and calculation as the Excel-mirror table.
import {
    groundBeamRebar, groundBeamRow, groundBeamTotals, newGroundBeamRow, type GroundBeamRow,
} from '@/domain/calculators/ground-beam';
import { totalKg } from '@/domain/calculators/footing';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import {
    AddButton, ElementCard, EmptyState, JBar, JGroup, JNumber, JText, ResultSummary, resultText,
} from '@/components/sheet/journey';

const label = (r: GroundBeamRow, i: number) => r.name.trim() || `แบบที่ ${i + 1}`;

export function GroundBeamJourney({ beams, onChange }: { beams: GroundBeamRow[]; onChange: (beams: GroundBeamRow[]) => void }) {
    const set = (i: number, patch: Partial<GroundBeamRow>) => onChange(beams.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    const add = () => onChange([...beams, newGroundBeamRow(beams)]);

    if (beams.length === 0) {
        return (
            <EmptyState
                text={<>ยังไม่มีคานคอดิน — เปิดแปลนคานคอดินดูว่ามีคานกี่แบบ แล้วเพิ่มทีละแบบพร้อมความยาวรวมทุกช่วง</>}
                addLabel="เพิ่มคานคอดินแบบแรก" onAdd={add} />
        );
    }

    const t = groundBeamTotals({ beams });

    return (
        <div className="flex flex-col gap-4">
            {beams.map((r, i) => {
                const c = groundBeamRow(r);
                return (
                    <ElementCard key={i} title={`คานคอดิน ${label(r, i)}`}
                        onDelete={() => onChange(beams.filter((_, j) => j !== i))} deleteTitle={`ลบคาน ${label(r, i)}?`}
                        result={resultText([
                            { label: 'คอนกรีต', value: c.concrete, unit: 'ลบ.ม.' },
                            { label: 'เหล็ก', value: c.mainWeight + c.stirrupWeight, unit: 'กก.' },
                            { label: 'ไม้แบบ', value: c.formwork, unit: 'ตร.ม.' },
                        ])}>
                        <JGroup title="จากแปลนคานคอดิน">
                            <JText label="ชื่อคาน" value={r.name} placeholder="เช่น B1" onChange={v => set(i, { name: v })} />
                            <JNumber label="ความยาวรวมทุกช่วง" value={r.length} unit="ม." onChange={v => set(i, { length: v })}
                                hint="บวกทุกช่วงของคานแบบนี้ พิมพ์ 4+3.5+4 ได้" />
                        </JGroup>
                        <JGroup title="ขนาดคาน (จากรูปตัดคาน)">
                            <JNumber label="ความกว้าง" value={r.width} unit="ม." onChange={v => set(i, { width: v })} />
                            <JNumber label="ความลึก" value={r.depth} unit="ม." onChange={v => set(i, { depth: v })} />
                        </JGroup>
                        <JGroup title="เหล็กเสริม (จากรูปตัดคาน)">
                            <JBar label="เหล็กเสริมหลัก (บน + ล่าง)" size={r.mainSize} onSize={v => set(i, { mainSize: v })}
                                amount={r.mainCount} onAmount={v => set(i, { mainCount: v })} />
                            <JBar label="เหล็กปลอก ระยะห่าง" size={r.stirrupSize} onSize={v => set(i, { stirrupSize: v })}
                                amount={r.stirrupSpacing} onAmount={v => set(i, { stirrupSpacing: v })} amountUnit="ม." amountDigits={2}
                                hint="เช่น RB6 @ 0.15 ม." />
                        </JGroup>
                    </ElementCard>
                );
            })}

            <AddButton label="เพิ่มคานคอดินแบบถัดไป" onClick={add} />

            <AdvancedSection title="ค่าตั้งต้น" hint="ไม่ต้องแก้ก็ได้">
                <div className="flex flex-col gap-3">
                    <JGroup title="คอนกรีตหยาบรองท้องคาน หนา">
                        {beams.map((r, i) => (
                            <JNumber key={i} label={`คาน ${label(r, i)}`} value={r.leanThickness} unit="ม."
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
            ]} note="ดินถมกลับของหมวดนี้มาจากด่านฐานรากและเสาตอม่อ" />
        </div>
    );
}
