'use client';

// Journey-mode body of the precast-slab level: the spans read off the slab plan first, the shear-key bar and
// topping (standard values) folded away, and a short result at the end. Same input and formulas as /calc.
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
    newPrecastPanel, precastPanel, PS_BAR_SIZES, type PrecastPanelRow, type PrecastSlabInput,
} from '@/domain/calculators/precast-slab';
import { REBAR_SIZES } from '@/domain/boq/slots';
import { EditableTable } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const sizeOptions = PS_BAR_SIZES.map(v => ({ value: v }));

interface SummaryItem { label: string; value: number; unit: string; digits?: number; detail?: string }

/** Green "what this level comes to" line. */
function ResultSummary({ items, minor }: { items: SummaryItem[]; minor?: SummaryItem[] }) {
    const text = (i: SummaryItem) => `${i.label} ${formatNumber(i.value, i.digits ?? 2)} ${i.unit}${i.detail ? ` (${i.detail})` : ''}`;
    return (
        <div className="rounded-lg border border-green-200 px-4 py-3" style={{ background: SHEET_COLORS.calc }}>
            <div className="text-[12px] font-semibold text-green-800">ผลรวมด่านนี้</div>
            <div className="text-[16px] font-semibold text-gray-900 tabular-nums">{items.map(text).join(' · ')}</div>
            {minor && <div className="text-[12px] text-gray-600 tabular-nums mt-0.5">{minor.map(text).join(' · ')}</div>}
        </div>
    );
}

export function PrecastSlabJourney({ input, outputs, onChange }: {
    input: PrecastSlabInput; outputs: Record<string, number>; onChange: (panels: PrecastPanelRow[]) => void;
}) {
    const rows = input.panels;
    const add = () => onChange([...rows, newPrecastPanel(rows[rows.length - 1])]);
    const shearKey = REBAR_SIZES.reduce((s, size) => s + (outputs[`rebar.${size}`] ?? 0), 0);

    return (
        <>
            <SheetCard title="พื้นสำเร็จรูปแต่ละช่วง" extra={rows.length > 0 ? <span className="text-[12px] text-gray-500">{rows.length} ช่วง</span> : undefined}>
                {rows.length === 0
                    ? (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="text-[14px] text-gray-600">
                                ยังไม่มีพื้นสำเร็จรูป — ดูแปลนพื้น (PS) แล้วเพิ่มทีละช่วง (กว้าง × ยาว)
                            </div>
                            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={add}>เพิ่มช่วงแรก</Button>
                        </div>
                    )
                    : (
                        <>
                            <EditableTable<PrecastPanelRow>
                                rows={rows}
                                onChange={onChange}
                                newRow={i => newPrecastPanel(rows[i - 1])}
                                addLabel="เพิ่มช่วง"
                                columns={[
                                    { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 90, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                    { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 90, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                    { kind: 'calc', key: 'area', title: 'พื้นที่ (ตร.ม.)', width: 90, get: r => precastPanel(r).area },
                                    { kind: 'calc', key: 'concrete', title: 'คอนกรีตทับหน้า (ลบ.ม.)', width: 100, digits: 3,
                                        get: r => precastPanel(r).concrete },
                                ]}
                            />
                            <p className="mt-2 text-[12px] text-gray-500">
                                1 แถว = 1 ช่วงพื้น (ห้องหรือช่วงระหว่างคาน) วัดกว้าง × ยาวตามแปลนพื้น · ช่องตัวเลขพิมพ์บวกได้ เช่น 1.5+2.3
                            </p>
                        </>
                    )}
            </SheetCard>

            <AdvancedSection title="เหล็กล็อคหัวแผ่น และคอนกรีตทับหน้า" hint="ค่ามาตรฐาน ไม่ต้องแก้ก็ได้">
                {rows.length === 0
                    ? <p className="text-[12px] text-gray-500">เพิ่มช่วงพื้นก่อน แล้วค่าของแต่ละช่วงจะแสดงที่นี่</p>
                    : (
                        <EditableTable<PrecastPanelRow>
                            rows={rows}
                            onChange={onChange}
                            canDelete={false}
                            columns={[
                                { kind: 'label', key: 'panel', title: 'ช่วง', width: 100,
                                    get: r => `${formatNumber(r.width)} × ${formatNumber(r.length)} ม.` },
                                { kind: 'select', key: 'keySize', title: 'เหล็กล็อคหัวแผ่น', width: 90, options: sizeOptions,
                                    get: r => r.keySize, set: (r, v) => ({ ...r, keySize: v }) },
                                { kind: 'number', key: 'keySpacing', title: 'ระยะห่าง (ม.)', width: 80,
                                    get: r => r.keySpacing, set: (r, v) => ({ ...r, keySpacing: v }) },
                                { kind: 'number', key: 'keyBarLength', title: 'ยาวเส้นละ (ม.)', width: 80,
                                    get: r => r.keyBarLength, set: (r, v) => ({ ...r, keyBarLength: v }) },
                                { kind: 'number', key: 'topping', title: 'คอนกรีตทับหน้า หนา (ม.)', width: 100,
                                    get: r => r.topping, set: (r, v) => ({ ...r, topping: v }) },
                            ]}
                        />
                    )}
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>พื้นสำเร็จรูป และไวร์เมช = กว้าง × ยาว · ไม้ค้ำยันคิดจากพื้นที่ให้อัตโนมัติ</li>
                    <li>เหล็กล็อคหัวแผ่น: จำนวน = ปัดขึ้น (2 × กว้าง ÷ ระยะห่าง) เส้น × ยาวเส้นละ (นับรวมในงานคานคอดิน)</li>
                    <li>คอนกรีตทับหน้า = พื้นที่ × หนา · ไม้แบบขอบ = 2 × (กว้าง + ยาว) × หนา</li>
                </ul>
            </AdvancedSection>

            {rows.length > 0 && (
                <ResultSummary
                    items={[
                        { label: 'พื้นสำเร็จรูป', value: outputs.area ?? 0, unit: 'ตร.ม.' },
                        { label: 'คอนกรีตทับหน้า', value: outputs.concrete ?? 0, unit: 'ลบ.ม.', digits: 3 },
                    ]}
                    minor={[
                        { label: 'ไวร์เมช', value: outputs.wiremesh ?? 0, unit: 'ตร.ม.' },
                        { label: 'ไม้แบบ', value: outputs.formwork ?? 0, unit: 'ตร.ม.' },
                        { label: 'เหล็กล็อคหัวแผ่น', value: shearKey, unit: 'กก.', digits: 1 },
                    ]}
                />
            )}
        </>
    );
}
