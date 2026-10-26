'use client';

import { fill } from '@/domain/calculators/fill';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

export default function FillPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(fill);

    return (
        <CalculatorShell def={fill} result={result} isDefault={isDefault} onReset={reset}>
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
        </CalculatorShell>
    );
}
