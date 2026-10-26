'use client';

import { plaster, type PlasterRow } from '@/domain/calculators/plaster';
import { netByPartKey } from '@/domain/calculators/brick';
import type { CalcContext } from '@/domain/calculators/types';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { PlasterTable } from './PlasterTable';
import PlasterJourney from './PlasterJourney';

export default function PlasterPage() {
    return useJourneyMode() ? <PlasterJourney /> : <PlasterSheet />;
}

/** The Excel-mirror sheet (/calc/plaster). */
function PlasterSheet() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(plaster);
    const ctx: CalcContext = { outputs: id => result.calcOutputs[id] };
    const brickNet = (part: string) => result.calcOutputs.brick?.[netByPartKey(part)] ?? 0;

    const setRow = (i: number, patch: Partial<PlasterRow>) =>
        update(p => ({ ...p, rows: p.rows.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

    return (
        <CalculatorShell def={plaster} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณปูนฉาบ">
                <PlasterTable rows={input.rows} onChange={rows => update({ rows })} setRow={setRow} ctx={ctx} brickNet={brickNet} />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม = พื้นที่ก่ออิฐสุทธิของส่วนผนังนี้ (ทุกชนิดอิฐ/ความหนา จากโปรแกรมก่ออิฐ) × จำนวนด้านที่ฉาบ</li>
                    <li>
                        ผนังโครงสร้าง (เสา/คาน) ไม่มีในงานก่ออิฐ — กรอกพื้นที่ต่อด้านเอง
                        (ค่าตัวอย่าง Excel = 1×25 + 0.8×2.6×3 = 31.24 ตร.ม.)
                    </li>
                    <li>ผนังรอบบ้าน: ฉาบภายใน 1 ด้าน + ภายนอก 1 ด้าน · ผนังภายในบ้าน: ฉาบภายใน 2 ด้าน · ผนังภายนอกบ้าน: ฉาบภายนอก 2 ด้าน</li>
                </ul>
            </SheetCard>

            <SheetCard title="สรุปพื้นที่ฉาบปูน (ส่งเข้า BOQ หมวด 18 และงานสี)">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="งานฉาบปูนผนัง (ภายนอก)" value={outputs.exterior} unit="ตร.ม." strong />
                    <CalcField label="งานฉาบปูนผนัง (ภายใน)" value={outputs.interior} unit="ตร.ม." strong />
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
