'use client';

import type { ReactNode } from 'react';
import {
    roofBeam, roofBeamRow, roofBeamTotals, ROOF_BEAM_BAR_SIZES, ROOF_BEAM_NAMES, type RoofBeamRow,
} from '@/domain/calculators/roof-beam';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '@/components/sheet/RebarSummary';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { RoofBeamJourney } from './RoofBeamJourney';

const sizeOptions = ROOF_BEAM_BAR_SIZES.map(value => ({ value }));
const nameOptions = ROOF_BEAM_NAMES.map(value => ({ value }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

const MAIN = 'เหล็กเสริมหลัก';
const STIRRUP = 'เหล็กปลอก';

export default function RoofBeamPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(roofBeam);
    const inJourney = useJourneyMode();
    if (inJourney) {
        return (
            <CalculatorShell def={roofBeam} result={result} isDefault={isDefault} onReset={reset}>
                <RoofBeamJourney input={input} outputs={outputs} onChange={next => update({ rows: next })} />
            </CalculatorShell>
        );
    }
    const rows = input.rows.map(roofBeamRow);
    const totals = roofBeamTotals(input);
    const res = (i: number) => rows[i];

    return (
        <CalculatorShell def={roofBeam} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานคานดาดฟ้า">
                <RebarSummary groups={[
                    { label: 'ปริมาณเหล็กเสริมหลัก (กก.)', kg: totals.main },
                    { label: 'ปริมาณเหล็กปลอก (กก.)', kg: totals.stirrup },
                ]} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="ไม้ค้ำยัน (ต้น)" value={outputs.props} unit="ต้น" digits={0} strong />
                    <CalcField label="ไม้แบบ (ตร.ม.)" value={outputs.formwork} unit="ตร.ม." strong />
                    <CalcField label="คอนกรีต โครงสร้าง (ลบ.ม.)" value={outputs.concrete} unit="ลบ.ม." digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title="ตารางคานดาดฟ้า">
                <EditableTable<RoofBeamRow>
                    rows={input.rows}
                    onChange={next => update({ rows: next })}
                    newRow={() => ({
                        name: '', width: 0, depth: 0, length: 0, mainSize: '', mainCount: 0, stirrupSize: '', stirrupSpacing: 0,
                    })}
                    addLabel="+ เพิ่มคาน"
                    columns={[
                        { kind: 'select', key: 'name', title: 'ชื่อคาน', width: 80, options: nameOptions,
                            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
                        { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                        { kind: 'number', key: 'depth', title: 'ลึก (ม.)', width: 70, get: r => r.depth, set: (r, v) => ({ ...r, depth: v }) },
                        { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80, get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                        { kind: 'select', key: 'mainSize', title: head(MAIN, 'ขนาด'), width: 90, options: sizeOptions,
                            get: r => r.mainSize, set: (r, v) => ({ ...r, mainSize: v }) },
                        { kind: 'number', key: 'mainCount', title: head(MAIN, 'จำนวน (เส้น)'), width: 70, digits: 0,
                            get: r => r.mainCount, set: (r, v) => ({ ...r, mainCount: v }) },
                        { kind: 'calc', key: 'mainLength', title: head(MAIN, 'ความยาว รวม (ม.)'), width: 90, get: (_, i) => res(i)?.mainLength ?? null },
                        { kind: 'calc', key: 'mainKg', title: head(MAIN, 'น้ำหนัก (กก.)'), width: 90, get: (_, i) => res(i)?.mainKg ?? null },
                        { kind: 'select', key: 'stirrupSize', title: head(STIRRUP, 'ขนาด'), width: 90, options: sizeOptions,
                            get: r => r.stirrupSize, set: (r, v) => ({ ...r, stirrupSize: v }) },
                        { kind: 'number', key: 'stirrupSpacing', title: head(STIRRUP, 'ระยะห่าง @ (ม.)'), width: 80,
                            get: r => r.stirrupSpacing, set: (r, v) => ({ ...r, stirrupSpacing: v }) },
                        { kind: 'calc', key: 'stirrupCount', title: head(STIRRUP, 'จำนวน (ปลอก)'), width: 70, digits: 0,
                            get: (_, i) => res(i)?.stirrupCount ?? null },
                        { kind: 'calc', key: 'stirrupPerimeter', title: head(STIRRUP, 'ความยาว /เส้น (ม.)'), width: 80,
                            get: (_, i) => res(i)?.stirrupPerimeter ?? null },
                        { kind: 'calc', key: 'stirrupLength', title: head(STIRRUP, 'ความยาว รวม (ม.)'), width: 90,
                            get: (_, i) => res(i)?.stirrupLength ?? null },
                        { kind: 'calc', key: 'stirrupKg', title: head(STIRRUP, 'น้ำหนัก (กก.)'), width: 90, get: (_, i) => res(i)?.stirrupKg ?? null },
                        { kind: 'calc', key: 'props', title: head('ไม้แบบ', 'ไม้ค้ำยัน (ต้น)'), width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
                        { kind: 'calc', key: 'formwork', title: head('ไม้แบบ', 'ไม้แบบ (ตร.ม.)'), width: 80, get: (_, i) => res(i)?.formwork ?? null },
                        { kind: 'calc', key: 'concrete', title: head('คอนกรีต', 'คอนกรีต โครงสร้าง (ลบ.ม.)'), width: 90, digits: 3,
                            get: (_, i) => res(i)?.concrete ?? null },
                    ]}
                />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>จำนวนปลอก = ปัดขึ้น(ยาว ÷ ระยะห่าง) · ความยาวปลอก/เส้น = 2 × (กว้าง + ลึก) · ไม้ค้ำยัน = ปัดขึ้น(ยาว ÷ 0.6) ต้น</p>
                    <p>
                        ไม้แบบ = 2 × ลึก × ยาว + กว้าง × ยาว (ข้าง 2 ด้าน + ท้องคาน). ใน Excel สูตรคือ 2 × ลึก × ยาว + กว้าง
                        (บวกความกว้างครั้งเดียว) = {formatNumber(outputs.formworkExcel)} ตร.ม. — แก้ตามข้อตัดสินใจ D1
                    </p>
                    <p>เหล็กเสริมส่งเข้า BOQ แยกตามขนาด พร้อม %เผื่อตามขนาด (RB6 6 %, RB9 9 %, DB12–DB20 12 %) และลวดผูกเหล็ก 3 %</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
