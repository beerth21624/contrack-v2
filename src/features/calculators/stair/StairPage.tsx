'use client';

import type { ReactNode } from 'react';
import {
    stair, stairRow, stairTotals, STAIR_ANCHORAGE, STAIR_BAR_SIZES, STAIR_GROUPS, STAIR_NAMES, type StairRow,
} from '@/domain/calculators/stair';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { RebarSummary } from '../roof-beam/RebarSummary';

const sizeOptions = STAIR_BAR_SIZES.map(value => ({ value }));
const nameOptions = STAIR_NAMES.map(value => ({ value }));

/** Two-line column header: Excel group (row 4) over the column label (row 7). */
const head = (group: string, label: string): ReactNode => (
    <><div className="text-[10px] font-normal text-gray-500">{group}</div>{label}</>
);

/** Short group names for the column headers of the rebar table. */
const GROUP_SHORT = {
    waistMain: 'เหล็กเสริมหลัก - แม่บันได',
    waistTemp: 'เหล็กกันร้าว - แม่บันได',
    stepMain: 'เหล็กเสริมหลัก - ลูกบันได',
    stepTemp: 'เหล็กกันร้าว - ลูกบันได',
} as const;

const emptyRow = (): StairRow => ({
    name: '', width: 0, waist: 0, rise: 0, run: 0, steps: 0, riser: 0, tread: 0,
    waistMainSize: '', waistMainSpacing: 0, waistTempSize: '', waistTempSpacing: 0,
    stepMainSize: '', stepMainSpacing: 0, stepTempSize: '', stepTempSpacing: 0,
});

export default function StairPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(stair);
    const rows = input.rows.map(stairRow);
    const totals = stairTotals(input);
    const res = (i: number) => rows[i];
    const onChange = (next: StairRow[]) => update({ rows: next });

    const W = 'ขนาดแม่บันได';
    const S = 'ขนาดลูกบันได';
    const sizeColumns: SheetColumn<StairRow>[] = [
        { kind: 'select', key: 'name', title: 'ชื่อบันได', width: 130, options: nameOptions,
            get: r => r.name, set: (r, v) => ({ ...r, name: v }) },
        { kind: 'number', key: 'width', title: head(W, 'กว้าง (ม.)'), width: 70, get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
        { kind: 'number', key: 'waist', title: head(W, 'หนา (ม.)'), width: 70, get: r => r.waist, set: (r, v) => ({ ...r, waist: v }) },
        { kind: 'number', key: 'rise', title: head(W, 'สูง (ม.)'), width: 70, get: r => r.rise, set: (r, v) => ({ ...r, rise: v }) },
        { kind: 'number', key: 'run', title: head(W, 'ยาว แนวราบ (ม.)'), width: 70, get: r => r.run, set: (r, v) => ({ ...r, run: v }) },
        { kind: 'calc', key: 'inclined', title: head(W, 'ยาว แนวเอียง (ม.)'), width: 80, get: (_, i) => res(i)?.inclined ?? null },
        { kind: 'number', key: 'steps', title: head(S, 'จำนวน (ขั้น)'), width: 70, digits: 0, get: r => r.steps, set: (r, v) => ({ ...r, steps: v }) },
        { kind: 'number', key: 'riser', title: head(S, 'สูง ลูกตั้ง (ม.)'), width: 70, get: r => r.riser, set: (r, v) => ({ ...r, riser: v }) },
        { kind: 'number', key: 'tread', title: head(S, 'กว้าง ลูกนอน (ม.)'), width: 70, get: r => r.tread, set: (r, v) => ({ ...r, tread: v }) },
    ];

    const rebarColumns: SheetColumn<StairRow>[] = [
        { kind: 'label', key: 'name', title: 'ชื่อบันได', width: 110, get: r => r.name },
        ...STAIR_GROUPS.flatMap((grp): SheetColumn<StairRow>[] => {
            const g = GROUP_SHORT[grp.key];
            return [
                { kind: 'select', key: `${grp.key}-size`, title: head(g, 'ขนาด'), width: 85, options: sizeOptions,
                    get: r => r[grp.size], set: (r, v) => ({ ...r, [grp.size]: v }) },
                { kind: 'number', key: `${grp.key}-spacing`, title: head(g, 'ระยะห่าง (ม.)'), width: 70,
                    get: r => r[grp.spacing], set: (r, v) => ({ ...r, [grp.spacing]: v }) },
                { kind: 'calc', key: `${grp.key}-count`, title: head(g, 'จำนวน (เส้น)'), width: 65, digits: 0,
                    get: (_, i) => res(i)?.[grp.key].count ?? null },
                { kind: 'calc', key: `${grp.key}-length`, title: head(g, 'ยาว รวม (ม.)'), width: 75,
                    get: (_, i) => res(i)?.[grp.key].length ?? null },
                { kind: 'calc', key: `${grp.key}-kg`, title: head(g, 'น้ำหนัก (กก.)'), width: 75,
                    get: (_, i) => res(i)?.[grp.key].kg ?? null },
            ];
        }),
    ];

    const FW = 'ไม้แบบ (ตร.ม.)';
    const CO = 'คอนกรีตโครงสร้าง (ลบ.ม.)';
    const formworkColumns: SheetColumn<StairRow>[] = [
        { kind: 'label', key: 'name', title: 'ชื่อบันได', width: 110, get: r => r.name },
        { kind: 'calc', key: 'props', title: 'ไม้ค้ำยัน (ต้น)', width: 70, digits: 0, get: (_, i) => res(i)?.props ?? null },
        { kind: 'calc', key: 'soffit', title: head(FW, 'ท้อง แม่บันได'), width: 80, get: (_, i) => res(i)?.soffit ?? null },
        { kind: 'calc', key: 'waistSides', title: head(FW, 'ข้าง แม่บันได'), width: 80, get: (_, i) => res(i)?.waistSides ?? null },
        { kind: 'calc', key: 'stepSides', title: head(FW, 'ข้าง ลูกบันได'), width: 80, get: (_, i) => res(i)?.stepSides ?? null },
        { kind: 'calc', key: 'risers', title: head(FW, 'กั้น ขั้นบันได'), width: 80, get: (_, i) => res(i)?.risers ?? null },
        { kind: 'calc', key: 'formwork', title: head(FW, 'รวม'), width: 80, get: (_, i) => res(i)?.formwork ?? null },
        { kind: 'calc', key: 'waistConcrete', title: head(CO, 'แม่บันได'), width: 80, digits: 3, get: (_, i) => res(i)?.waistConcrete ?? null },
        { kind: 'calc', key: 'stepConcrete', title: head(CO, 'ลูกบันได'), width: 80, digits: 3, get: (_, i) => res(i)?.stepConcrete ?? null },
        { kind: 'calc', key: 'concrete', title: head(CO, 'รวม'), width: 80, digits: 3, get: (_, i) => res(i)?.concrete ?? null },
    ];

    return (
        <CalculatorShell def={stair} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="สรุปปริมาณงานงานบันได">
                <RebarSummary groups={STAIR_GROUPS.map(grp => ({ label: grp.title, kg: totals.groups[grp.key] }))} />
                <div className="mt-3 max-w-md ml-auto">
                    <CalcField label="ไม้ค้ำยัน (ต้น)" value={outputs.props} unit="ต้น" digits={0} strong />
                    <CalcField label="ไม้แบบ (ตร.ม.)" value={outputs.formwork} unit="ตร.ม." strong />
                    <CalcField label="คอนกรีตโครงสร้าง (ลบ.ม.)" value={outputs.concrete} unit="ลบ.ม." digits={3} strong />
                </div>
            </SheetCard>

            <SheetCard title="ขนาดบันได">
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} newRow={emptyRow} addLabel="+ เพิ่มบันได"
                    columns={sizeColumns} />
            </SheetCard>

            <SheetCard title="เหล็กเสริม">
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} canDelete={false} columns={rebarColumns} />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>เหล็กเสริมหลัก - แม่บันได: จำนวน = ปัดขึ้น(กว้าง ÷ ระยะห่าง), ยาวรวม = (ยาวแนวเอียง + {STAIR_ANCHORAGE} ม.) × จำนวน</p>
                    <p>เหล็กกันร้าว - แม่บันได: จำนวน = ปัดขึ้น(ยาวแนวเอียง ÷ ระยะห่าง), ยาวรวม = กว้าง × จำนวน</p>
                    <p>เหล็กเสริมหลัก - ลูกบันได: จำนวน = ปัดขึ้น(กว้าง ÷ ระยะห่าง), ยาวรวม = จำนวน × (ยาวแนวราบ + สูง)</p>
                    <p>เหล็กกันร้าว - ลูกบันได: จำนวน = 2 × จำนวนขั้น (ไม่ใช้ระยะห่าง ตาม Excel), ยาวรวม = จำนวน × กว้าง</p>
                    <p>เหล็กเสริมส่งเข้า BOQ แยกตามขนาด พร้อม %เผื่อตามขนาด (RB6 6 %, RB9 9 %, DB12–DB20 12 %) และลวดผูกเหล็ก 3 %</p>
                </div>
            </SheetCard>

            <SheetCard title="ไม้แบบ / คอนกรีต">
                <EditableTable<StairRow> rows={input.rows} onChange={onChange} canDelete={false} columns={formworkColumns} />
                <div className="mt-3 text-[12px] text-gray-500 space-y-1">
                    <p>ไม้ค้ำยัน = ปัดขึ้น(ท้องแม่บันได ÷ 0.6) ต้น · ท้อง = กว้าง × ยาวแนวเอียง · ข้างแม่บันได = 2 × หนา × ยาวแนวเอียง</p>
                    <p>ข้างลูกบันได = 2 × สูงลูกตั้ง × ยาวแนวเอียง · กั้นขั้นบันได = จำนวนขั้น × สูงลูกตั้ง × กว้าง</p>
                    <p>คอนกรีต แม่บันได = หนา × ยาวแนวเอียง × กว้าง · ลูกบันได = จำนวนขั้น × ½ × ลูกนอน × ลูกตั้ง × กว้าง</p>
                </div>
            </SheetCard>
        </CalculatorShell>
    );
}
