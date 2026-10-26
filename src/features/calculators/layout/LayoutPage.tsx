'use client';

import {
    layout, layoutLine, LAYOUT_FIXED_ROWS, LAYOUT_LIVE_PREVIEW, type LayoutMaterialLine,
} from '@/domain/calculators/layout';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

export default function LayoutPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(layout);

    const setRow = (i: number, patch: Partial<LayoutMaterialLine>) => update(p => ({
        ...p, materials: p.materials.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));

    return (
        <CalculatorShell def={layout} result={result} isDefault={isDefault} onReset={reset}
            aside={(
                <SheetCard title="LIVE PREVIEW">
                    <CalcField label="จำนวนผัง" value={outputs.points} digits={0} unit="ผัง" />
                    {LAYOUT_LIVE_PREVIEW.map(p => (
                        <CalcField key={p.output} label={p.label} value={outputs[p.output]} digits={0} unit={p.unit} />
                    ))}
                    <CalcField label="รวมค่าวัสดุ" value={outputs.materialTotal} unit="บาท" />
                    <CalcField label="ค่าแรง" value={outputs.labour} unit="บาท" />
                    <CalcField label="รวม Step 04" value={outputs.total} unit="บาท" strong />
                </SheetCard>
            )}>
            <SheetCard title="INPUT">
                <InputNumberField label="จำนวนผัง (จุด)" value={input.points} digits={0} unit="จุด"
                    onChange={v => update({ points: v })} />
                <InputNumberField label="จำนวนไม้ปักหมุด (ต้น)" value={input.stakes} digits={0} unit="ต้น"
                    hint="ตัวอย่าง 21 = จำนวนเสาเข็ม" onChange={v => update({ stakes: v })} />
                <InputNumberField label="เผื่อวัสดุ (%)" value={input.waste} percent unit="%"
                    onChange={v => update({ waste: v })} />
                <InputNumberField label="ค่าแรงวางผัง / ปักหมุด" value={input.labour} unit="บาท"
                    onChange={v => update({ labour: v })} />
                <p className="mt-1 text-[12px] text-gray-500">หมายเหตุ: กรอกช่องสีเหลืองเท่านั้น</p>
            </SheetCard>

            <SheetCard title="รายการวัสดุ">
                <EditableTable<LayoutMaterialLine>
                    rows={input.materials}
                    onChange={materials => update({ materials })}
                    lockedRows={LAYOUT_FIXED_ROWS}
                    newRow={() => ({ item: '', unit: '', perPoint: 0, fixed: 0, unitPrice: 0 })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        {
                            kind: 'label', key: 'item', title: 'รายการวัสดุ',
                            get: (r, i) => i < LAYOUT_FIXED_ROWS
                                ? r.item
                                : <TextCell value={r.item} placeholder="ชื่อรายการ" onCommit={v => setRow(i, { item: v ?? '' })} />,
                        },
                        { kind: 'text', key: 'unit', title: 'หน่วย', width: 70, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                        { kind: 'number', key: 'perPoint', title: 'ฐานต่อ 1 ผัง', width: 90, get: r => r.perPoint, set: (r, v) => ({ ...r, perPoint: v }) },
                        {
                            kind: 'label', key: 'fixed', title: 'ฐานคงที่', width: 90,
                            get: (r, i) => r.fixedFromStakes
                                ? (
                                    <div className="text-right tabular-nums px-1 py-0.5 rounded-sm" style={{ background: SHEET_COLORS.calc }}
                                        title="= จำนวนไม้ปักหมุด (ต้น)">
                                        {formatNumber(input.stakes)}
                                    </div>
                                )
                                : <NumberCell value={r.fixed} ariaLabel="ฐานคงที่" onCommit={v => setRow(i, { fixed: v ?? 0 })} />,
                        },
                        { kind: 'calc', key: 'before', title: 'จำนวนก่อนเผื่อ', width: 100, get: r => layoutLine(r, input).beforeWaste },
                        { kind: 'calc', key: 'order', title: 'จำนวนสั่งซื้อ', width: 100, get: r => layoutLine(r, input).orderQty },
                        { kind: 'number', key: 'unitPrice', title: 'ราคาต่อหน่วย', width: 100, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                        { kind: 'calc', key: 'total', title: 'รวมราคา', width: 100, get: r => layoutLine(r, input).total },
                    ]}
                />
                <p className="mt-2 text-[12px] text-gray-500">
                    จำนวนก่อนเผื่อ = ฐานต่อ 1 ผัง × จำนวนผัง + ฐานคงที่ · จำนวนสั่งซื้อ = ปัดขึ้น(จำนวนก่อนเผื่อ × (1 + เผื่อ)) ·
                    รวมราคา = จำนวนสั่งซื้อ × ราคาต่อหน่วย
                </p>
            </SheetCard>

            <SheetCard title="BOQ PREVIEW">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-[12px] text-gray-700">
                                <th className={td}>หมวด</th><th className={td}>รายการ</th><th className={td}>หน่วย</th>
                                <th className={td}>ปริมาณ</th><th className={td}>ค่าวัสดุ</th><th className={td}>ค่าแรง</th>
                                <th className={td}>รวม</th><th className={td}>หมายเหตุ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className={td}>ขั้นตอน 4</td>
                                <td className={td}>วางผัง / ปักหมุด</td>
                                <td className={`${td} text-center`}>เหมา</td>
                                <td className={tdNum}>1</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.materialTotal)}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.labour)}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs.total)}</td>
                                <td className={td}>รวมวัสดุตามรายการคำนวณ</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    ยังไม่ส่งเข้า BOQ อัตโนมัติ: ชีตวางผังจริงเป็น Google Sheet ภายนอกที่ยังไม่ได้รับไฟล์ (ราคาในภาพสไลด์เป็น 0)
                    BOQ แถว &quot;วางผัง / ปักหมุด&quot; จึงยังใช้ราคาที่ Excel พิมพ์ไว้ (วัสดุ 4,000 / ค่าแรง 1,500 บาท) ซึ่งแก้ได้ที่หน้า BOQ
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
