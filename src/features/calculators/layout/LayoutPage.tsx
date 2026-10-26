'use client';

import {
    layout, layoutLine, LAYOUT_FIXED_ROWS, LAYOUT_LIVE_PREVIEW, type LayoutInput, type LayoutMaterialLine,
} from '@/domain/calculators/layout';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { JNumber, ResultSummary } from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

type Calc = UseCalculator<LayoutInput>;

export default function LayoutPage() {
    const calc = useCalculator(layout);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={layout} result={result} isDefault={isDefault} onReset={reset}
            aside={inJourney ? undefined : (
                <SheetCard title="ผลคำนวณ">
                    <CalcField label="จำนวนผัง" value={outputs.points} digits={0} unit="ผัง" />
                    {LAYOUT_LIVE_PREVIEW.map(p => (
                        <CalcField key={p.output} label={p.label} value={outputs[p.output]} digits={0} unit={p.unit} />
                    ))}
                    <CalcField label="รวมค่าวัสดุ" value={outputs.materialTotal} unit="บาท" />
                    <CalcField label="ค่าแรง" value={outputs.labour} unit="บาท" />
                    <CalcField label="รวมงานวางผัง / ปักหมุด" value={outputs.total} unit="บาท" strong />
                </SheetCard>
            )}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title="ข้อมูลที่กรอก">
                        <InputNumberField label="จำนวนผัง (จุด)" value={input.points} digits={0} unit="จุด"
                            onChange={v => update({ points: v })} />
                        <InputNumberField label="จำนวนไม้ปักหมุด (ต้น)" value={input.stakes} digits={0} unit="ต้น"
                            hint="ตัวอย่าง 21 = จำนวนเสาเข็ม" onChange={v => update({ stakes: v })} />
                        <Allowances calc={calc} />
                        <p className="mt-1 text-[12px] text-gray-500">หมายเหตุ: กรอกช่องสีเหลืองเท่านั้น</p>
                    </SheetCard>

                    <SheetCard title="รายการวัสดุ">
                        <MaterialTable calc={calc} />
                        <p className="mt-2 text-[12px] text-gray-500">
                            จำนวนก่อนเผื่อ = ฐานต่อ 1 ผัง × จำนวนผัง + ฐานคงที่ · จำนวนสั่งซื้อ = ปัดขึ้น(จำนวนก่อนเผื่อ × (1 + เผื่อ)) ·
                            รวมราคา = จำนวนสั่งซื้อ × ราคาต่อหน่วย
                        </p>
                    </SheetCard>

                    <SheetCard title="ตัวอย่างรายการใน BOQ">
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
                                        <td className={td}>หมวด 4</td>
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
                </>
            )}
        </CalculatorShell>
    );
}

/** เผื่อวัสดุ and the labour lump sum. */
function Allowances({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <>
            <InputNumberField label="เผื่อวัสดุ (%)" value={input.waste} percent unit="%"
                onChange={v => update({ waste: v })} />
            <InputNumberField label="ค่าแรงวางผัง / ปักหมุด" value={input.labour} unit="บาท"
                onChange={v => update({ labour: v })} />
        </>
    );
}

/** The material table (5 sheet rows plus added rows). */
function MaterialTable({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    const setRow = (i: number, patch: Partial<LayoutMaterialLine>) => update(p => ({
        ...p, materials: p.materials.map((x, j) => (j === i ? { ...x, ...patch } : x)),
    }));
    return (
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
    );
}

/** Guided journey: the two counts off the foundation plan; recipe, waste and labour folded. */
function JourneyView({ calc }: { calc: Calc }) {
    const { input, update, outputs, result } = calc;
    const row = result.boq.sections.find(s => s.no === 4)?.rows.find(r => r.key === 'R32');
    const lumpSum = row?.type === 'item' ? row.total : 0;
    const counted = (outputs.points ?? 0) > 0 || (outputs.stakes ?? 0) > 0;
    return (
        <>
            <SheetCard title="จุดวางผังและหมุด">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-w-xl">
                    <JNumber label="จำนวนจุดวางผัง" value={input.points} digits={0} unit="จุด"
                        hint="นับจุดตั้งผังไม้ตามแนวเสา/แนวกริดรอบอาคาร" onChange={v => update({ points: v })} />
                    <JNumber label="จำนวนหมุด" value={input.stakes} digits={0} unit="ต้น"
                        hint="ปกติเท่ากับจำนวนเสาเข็ม" onChange={v => update({ stakes: v })} />
                </div>
            </SheetCard>

            <AdvancedSection title="รายการวัสดุและค่าตั้งต้น">
                <Allowances calc={calc} />
                <div className="mt-3">
                    <MaterialTable calc={calc} />
                </div>
            </AdvancedSection>

            <ResultSummary
                items={counted
                    ? LAYOUT_LIVE_PREVIEW.map(p => ({ label: p.label, value: outputs[p.output], unit: p.unit, digits: 0 }))
                    : []}
                empty="กรอกจำนวนจุดวางผังและจำนวนหมุด ระบบจะคิดไม้ที่ต้องสั่งให้"
                note={<>ค่าวางผัง / ปักหมุด เหมา <b className="tabular-nums">{formatNumber(lumpSum, 0)}</b> บาท
                    คิดรวมในราคาทั้งโครงการแล้ว (ปรับราคาได้ที่หน้า BOQ)</>} />
        </>
    );
}
