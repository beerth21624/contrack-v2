'use client';

import type { ReactNode } from 'react';
import {
    precastSlab, precastPanel, precastSlabTotals, PS_BAR_SIZES, type PrecastPanelRow,
} from '@/domain/calculators/precast-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import type { BoqItemRow } from '@/domain/boq/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

/** Column title with the Excel group header (row 3/4) above the column header (row 7). */
const head = (group: string, title: string): ReactNode => (
    <>
        <div className="text-[10px] font-normal text-gray-500 leading-tight">{group}</div>
        <div>{title}</div>
    </>
);

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums';

export default function PrecastSlabPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(precastSlab);
    const totals = precastSlabTotals(input);
    const shearKeyRows = result.boq.sections.flatMap(s => s.rows)
        .filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith('precast-slab:shear-key:'));

    const newRow = (): PrecastPanelRow => {
        const last = input.panels[input.panels.length - 1];
        return last
            ? { ...last, width: 0, length: 0 }
            : { width: 0, length: 0, keySize: 'RB6', keySpacing: 0.35, keyBarLength: 0.8, topping: 0.05 };
    };

    return (
        <CalculatorShell def={precastSlab} result={result} isDefault={isDefault} onReset={reset}
            aside={(
                <SheetCard title="ส่งเข้า BOQ หมวด 8 — 4) เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป">
                    {shearKeyRows.length === 0
                        ? <p className="text-[12px] text-gray-500">ไม่มีเหล็ก Shear Key</p>
                        : shearKeyRows.map(r => (
                            <div key={r.key}>
                                <CalcField label={`${r.desc} (สุทธิ)`} value={r.qty} unit="กก." />
                                <CalcField label={`ค่าวัสดุ + ค่าแรง (เผื่อ ${formatNumber(r.waste * 100, 0)}%)`} value={r.total} unit="บาท" />
                            </div>
                        ))}
                    <p className="mt-1 text-[12px] text-gray-500">ไม่มีแถวลวดผูกเหล็ก (ตาม Excel)</p>
                </SheetCard>
            )}>
            <SheetCard title="สรุปปริมาณงานพื้นสำเร็จรูป">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <CalcField label="แผ่นพื้น สำเร็จรูป" value={outputs.area} unit="ตร.ม." strong />
                    <CalcField label="เหล็กไวร์เมช" value={outputs.wiremesh} unit="ตร.ม." strong />
                    <CalcField label="ไม้แบบ" value={outputs.formwork} unit="ตร.ม." strong />
                    <CalcField label="คอนกรีต ทับหน้า" value={outputs.concrete} unit="ลบ.ม." digits={4} strong />
                </div>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={th}>ปริมาณเหล็ก Shear Key (กก.)</th>
                                {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-gray-200 px-2 py-1 text-[13px]">รวม</td>
                                {REBAR_SIZES.map(s => (
                                    <td key={s} className={`${td} font-semibold`} style={{ background: SHEET_COLORS.calc }}>
                                        {formatNumber(totals.shearKey[s])}
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </SheetCard>

            <SheetCard title="ข้อมูลพื้นสำเร็จรูป">
                <EditableTable<PrecastPanelRow>
                    rows={input.panels}
                    onChange={panels => update({ panels })}
                    newRow={newRow}
                    addLabel="+ เพิ่มแผ่นพื้น"
                    columns={[
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 70, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'calc', key: 'area', title: head('แผ่นพื้น', 'แผ่นพื้น (ตร.ม)'), width: 80, get: r => precastPanel(r).area },
                        { kind: 'calc', key: 'wiremesh', title: head('เหล็กไวร์เมช', 'ไวร์เมช (ตร.ม.)'), width: 80, get: r => precastPanel(r).wiremesh },
                        { kind: 'select', key: 'keySize', title: head('เหล็ก Shear Key', 'ขนาด'), width: 90,
                            options: PS_BAR_SIZES.map(s => ({ value: s })), get: r => r.keySize, set: (r, v) => ({ ...r, keySize: v }) },
                        { kind: 'number', key: 'keySpacing', title: head('เหล็ก Shear Key', 'ระยะห่าง (ม.)'), width: 70,
                            get: r => r.keySpacing, set: (r, v) => ({ ...r, keySpacing: v }) },
                        { kind: 'number', key: 'keyBarLength', title: head('เหล็ก Shear Key', 'ความยาว /เส้น (ม.)'), width: 70,
                            get: r => r.keyBarLength, set: (r, v) => ({ ...r, keyBarLength: v }) },
                        { kind: 'calc', key: 'keyCount', title: head('เหล็ก Shear Key', 'จำนวน (เส้น)'), width: 70, digits: 0,
                            get: r => precastPanel(r).keyCount },
                        { kind: 'calc', key: 'keyTotalLength', title: head('เหล็ก Shear Key', 'ความยาว รวม (ม.)'), width: 80,
                            get: r => precastPanel(r).keyTotalLength },
                        { kind: 'calc', key: 'keyWeight', title: head('เหล็ก Shear Key', 'น้ำหนัก (กก.)'), width: 80,
                            get: r => precastPanel(r).keyWeight },
                        { kind: 'calc', key: 'perimeter', title: head('ไม้แบบ', 'ยาว (ม.)'), width: 70, get: r => precastPanel(r).perimeter },
                        { kind: 'calc', key: 'formwork', title: head('ไม้แบบ', 'ปริมาณ (ตร.ม.)'), width: 80, get: r => precastPanel(r).formwork },
                        { kind: 'number', key: 'topping', title: head('คอนกรีตทับหน้า', 'หนา (ม.)'), width: 70,
                            get: r => r.topping, set: (r, v) => ({ ...r, topping: v }) },
                        { kind: 'calc', key: 'concrete', title: head('คอนกรีตทับหน้า', 'คอนกรีต (ลบ.ม.)'), width: 80, digits: 4,
                            get: r => precastPanel(r).concrete },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>1 แถว = 1 แผง (กว้าง × ยาว) · ไวร์เมช = พื้นที่แผ่นพื้น</li>
                    <li>เหล็ก Shear Key: จำนวน = ปัดขึ้น (2 × กว้าง ÷ ระยะห่าง), ยาวเส้นละ 0.80 ม. (ตาม Excel)</li>
                    <li>ไม้แบบ = เส้นรอบรูป 2 × (กว้าง + ยาว) × ความหนาคอนกรีตทับหน้า · คอนกรีตทับหน้า = พื้นที่ × หนา</li>
                    <li>
                        ส่งเข้า BOQ หมวด 10: พื้นสำเร็จรูป {formatNumber(outputs.area)} ตร.ม. (ไม้ค้ำยัน = 0.1 × พื้นที่ ลบ.ฟ. คิดใน BOQ),
                        ไวร์เมช {formatNumber(outputs.wiremesh)} ตร.ม., ไม้แบบ {formatNumber(outputs.formwork)} ตร.ม.,
                        คอนกรีต {formatNumber(outputs.concrete, 4)} ลบ.ม. · เหล็ก Shear Key ส่งเข้าหมวด 8 (งานคานคอดิน)
                    </li>
                </ul>
            </SheetCard>
        </CalculatorShell>
    );
}
