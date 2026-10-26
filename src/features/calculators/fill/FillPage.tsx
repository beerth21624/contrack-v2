'use client';

import { fill, type FillInput } from '@/domain/calculators/fill';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

export default function FillPage() {
    const calc = useCalculator(fill);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={fill} result={result} isDefault={isDefault} onReset={reset}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title="โปรแกรมคำนวณปริมาณดินถม (คิว)">
                        <div className="max-w-xl">
                            <div className="text-[13px] font-medium text-gray-800 pt-1">ขนาดที่ดิน</div>
                            <div className="pl-4">
                                <InputNumberField label="กว้าง" value={input.width} unit="เมตร" onChange={v => update({ width: v })} />
                                <InputNumberField label="ยาว" value={input.length} unit="เมตร" onChange={v => update({ length: v })} />
                            </div>
                            <InputNumberField label="ถมดินสูง" value={input.height} unit="เมตร" onChange={v => update({ height: v })} />
                            <InputNumberField label="เผื่อดินยุบตัว" value={input.settlementPct} unit="%"
                                onChange={v => update({ settlementPct: v })} />
                            <div className="mt-3 border-t border-gray-100 pt-2">
                                <CalcField label="ปริมาณดินที่ต้องสั่ง (Output)" value={outputs.volume} unit="คิว (ลูกบาศก์เมตร)" strong />
                            </div>
                        </div>
                    </SheetCard>

                    <SheetCard title="วัสดุถม">
                        <InputTextField label="วัสดุถม / หมายเหตุ" value={input.material} placeholder="เช่น ดินถม, ทรายถม, ลูกค้าจัดหาเอง"
                            onChange={v => update({ material: v })} />
                        <p className="mt-2 text-[12px] text-gray-500">
                            วัสดุถม (ถ้ามี) ระบุที่หมายเหตุ — ข้อความนี้แสดงในช่องหมายเหตุของ BOQ แถว &quot;ดินถม (ตามสเปค) + บดอัด&quot;.
                            ปริมาณ {formatNumber(outputs.volume)} คิว ส่งเข้าช่องปริมาณของแถวเดียวกัน (BOQ บวก %เผื่อของแถวนั้นอีกชั้น ตั้งต้น 10%)
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** Guided journey: fill area and height off the site plan; the settlement allowance is folded. */
function JourneyView({ calc }: { calc: UseCalculator<FillInput> }) {
    const { input, update, outputs } = calc;
    const volume = outputs.volume ?? 0;
    const area = (Number.isFinite(input.width) ? input.width : 0) * (Number.isFinite(input.length) ? input.length : 0);
    return (
        <>
            <SheetCard title="พื้นที่ที่ต้องถม">
                <div className="max-w-xl">
                    <InputNumberField label="ความกว้างพื้นที่ถม" value={input.width} unit="ม." onChange={v => update({ width: v })} />
                    <InputNumberField label="ความยาวพื้นที่ถม" value={input.length} unit="ม." onChange={v => update({ length: v })} />
                    <InputNumberField label="ความสูงถม" value={input.height} unit="ม."
                        hint="ระดับที่ต้องการ ลบ ระดับดินเดิม" onChange={v => update({ height: v })} />
                    <InputTextField label="วัสดุถม" value={input.material} placeholder="เช่น ดินถม, ทรายถม, ลูกค้าจัดหาเอง"
                        onChange={v => update({ material: v })} />
                </div>
            </SheetCard>

            <AdvancedSection hint="ตั้งไว้ให้แล้ว ไม่ต้องแก้ก็ได้">
                <div className="max-w-xl">
                    <InputNumberField label="เผื่อดินยุบตัว" value={input.settlementPct} digits={0} unit="%"
                        hint="ดินถมยุบตัวเมื่อบดอัด ปกติ 30%" onChange={v => update({ settlementPct: v })} />
                </div>
            </AdvancedSection>

            <ResultSummary
                items={volume > 0 ? [{
                    label: 'ดินที่ต้องสั่ง', value: volume, unit: 'คิว',
                    detail: `พื้นที่ ${formatNumber(area)} ตร.ม. × สูง ${formatNumber(input.height)} ม. + เผื่อยุบตัว ${formatNumber(input.settlementPct, 0)}%`,
                }] : []}
                empty={<>กรอกความกว้าง ความยาว และความสูงถม ระบบจะคิดปริมาณดินให้ — ถ้าไม่ต้องถมดิน กด &quot;ไม่มีงานนี้&quot; ด้านล่าง</>} />
        </>
    );
}
