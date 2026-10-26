'use client';

import { Alert, Select, type SelectProps } from 'antd';
import {
    piles, composePileSpec, missingPileSpec, PILE_TYPES, PILE_SECTION_GROUPS,
} from '@/domain/calculators/piles';
import type { BoqItemRow } from '@/domain/boq/types';
import { CalcField, InputNumberField, InputTextField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Labelled yellow dropdown, same layout as InputTextField. */
function InputSelectField({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string;
    options: SelectProps<string>['options'];
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
            <span className="text-[13px] text-gray-700">{label}</span>
            <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }}>
                <Select size="small" variant="borderless" allowClear style={{ width: '100%' }} aria-label={label}
                    placeholder={placeholder} value={value || undefined} options={options}
                    onChange={(v: string | undefined) => onChange(v ?? '')} />
            </div>
        </div>
    );
}

export default function PilesPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(piles);
    const spec = composePileSpec(input);
    const missing = missingPileSpec(input);
    const cutHeads = result.boq.sections.flatMap(s => s.rows)
        .find((r): r is BoqItemRow => r.type === 'item' && r.key === 'R39');

    return (
        <CalculatorShell def={piles} result={result} isDefault={isDefault} onReset={reset}
            aside={cutHeads && (
                <SheetCard title="ลิงก์ไปหมวดอื่น">
                    <CalcField label="ตัดหัวเสาเข็ม (6. งานฐานราก) — ใช้จำนวนเสาเข็ม" value={cutHeads.qty} unit="ต้น" digits={0} />
                    <CalcField label="ค่าตัดหัวเสาเข็ม" value={cutHeads.total} unit="บาท" />
                </SheetCard>
            )}>
            <SheetCard title="Spec เสาเข็ม">
                <InputSelectField label="ชนิดเสาเข็ม" value={input.pileType} placeholder="เลือกชนิดเสาเข็ม"
                    options={PILE_TYPES.map(t => ({ value: t }))} onChange={v => update({ pileType: v })} />
                <InputSelectField label="หน้าตัด/รูปทรง" value={input.section} placeholder="เลือกหน้าตัด"
                    options={PILE_SECTION_GROUPS.map(g => ({ label: g.label, options: g.options.map(o => ({ value: o })) }))}
                    onChange={v => update({ section: v })} />
                <InputNumberField label="ความยาว" value={input.length} unit="ม." onChange={v => update({ length: v })} />
                <InputTextField label="spec เพิ่มเติม (ไม่บังคับ)" value={input.extraSpec}
                    placeholder="เช่น รับน้ำหนัก 15 ตัน/ต้น, ยี่ห้อ" onChange={v => update({ extraSpec: v })} />

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2">
                    <span className="text-[13px] font-semibold text-gray-900">หมายเหตุใน BOQ</span>
                    <span className="px-2 py-1 rounded-sm text-[13px]" style={{ background: SHEET_COLORS.calc }}>
                        {spec || '—'}
                    </span>
                </div>
                {missing.length > 0 && (
                    <Alert className="mt-3" type="warning" showIcon title="ต้องใส่ spec ให้ครบ"
                        description={`ยังไม่ระบุ: ${missing.join(', ')}`} />
                )}
            </SheetCard>

            <SheetCard title="ราคาเหมา">
                <InputNumberField label="จำนวน" value={input.count} unit="ต้น" digits={0} onChange={v => update({ count: v })} />
                <InputNumberField label="ราคาเหมาต่อต้น" value={input.pricePerPile} unit="บาท"
                    onChange={v => update({ pricePerPile: v })} />
                <div className="mt-1">
                    <CalcField label="รวมค่าเสาเข็ม" value={(outputs.count ?? 0) * (outputs.pricePerPile ?? 0)} unit="บาท" strong />
                </div>
                <p className="mt-2 text-[12px] text-gray-500">
                    หมายเหตุ: ประเมินราคาแบบเหมา (ค่าเสาเข็ม + ค่าตอก รวมในช่องค่าแรง, ค่าวัสดุ 0) แต่ต้องใส่ spec ให้ครบ —
                    จำนวน {formatNumber(outputs.count, 0)} ต้น × {formatNumber(outputs.pricePerPile)} บาท ส่งเข้า BOQ แถว
                    &quot;เสาเข็ม&quot; และจำนวนต้นใช้กับแถว &quot;ตัดหัวเสาเข็ม&quot; ในหมวด 6
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
