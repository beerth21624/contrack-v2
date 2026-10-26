'use client';

import {
    siteCamp, campLine, CAMP_GROUPS, type CampGroupDef, type CampMaterialLine, type SiteCampInput,
} from '@/domain/calculators/site-camp';
import type { ProjectResult } from '@/domain/project';
import type { BoqItemRow } from '@/domain/boq/types';
import { EditableTable } from '@/components/sheet/EditableTable';
import { InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

/** Room-count inputs with the sheet's hints (deck p16). */
const ROOM_FIELDS: { key: CampGroupDef['rooms']; label: string; hint: string; size: string }[] = [
    { key: 'workerRooms', label: 'จำนวนห้องพักคนงาน', hint: 'ฐานตัวอย่าง: 4 ห้อง ขนาด 2.4 x 3.6 ม.', size: 'ห้องละ 2.4 x 3.6 ม.' },
    { key: 'toilets', label: 'จำนวนห้องน้ำ', hint: 'ฐานตัวอย่าง: 2 ห้อง ขนาด 1.2 x 1.2 ม.', size: 'ห้องละ 1.2 x 1.2 ม.' },
    { key: 'showers', label: 'จำนวนห้องอาบน้ำ', hint: 'ฐานตัวอย่าง: 1 ห้อง ขนาด 1.5 x 3.0 ม.', size: 'ห้องละ 1.5 x 3.0 ม.' },
    { key: 'stores', label: 'จำนวนสโตร์เก็บของ', hint: 'ฐานตัวอย่าง: 1 ห้อง ขนาด 2.4 x 2.4 ม.', size: 'ห้องละ 2.4 x 2.4 ม.' },
];

const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

type Calc = UseCalculator<SiteCampInput>;

export default function SiteCampPage() {
    const calc = useCalculator(siteCamp);
    const inJourney = useJourneyMode();
    const { input, update, reset, outputs, result, isDefault } = calc;

    return (
        <CalculatorShell def={siteCamp} result={result} isDefault={isDefault} onReset={reset}
            aside={inJourney ? undefined : <TakeOffSummary outputs={outputs} input={input} />}>
            {inJourney ? <JourneyView calc={calc} /> : (
                <>
                    <SheetCard title="ข้อมูลที่ต้องกรอก" extra={<span className="text-[12px] text-gray-500">STEP 03 : เตรียมพื้นที่หน้างาน (Site Preparation)</span>}>
                        {ROOM_FIELDS.map(f => (
                            <InputNumberField key={f.key} label={f.label} value={input[f.key]} digits={0} unit="ห้อง" hint={f.hint}
                                onChange={v => update({ [f.key]: v } as Partial<SiteCampInput>)} />
                        ))}
                        <Allowances calc={calc} />
                    </SheetCard>

                    <SheetCard title="รายการวัสดุ">
                        <MaterialTables calc={calc}
                            emptyText="ยังไม่มีรายการ — ภาพในสไลด์ตัดไม่ถึงหมวดนี้ กรอกเพิ่มได้จนกว่าจะได้ชีตจริง" />
                        <p className="mt-3 text-[12px] text-gray-500">
                            ปริมาณคำนวณ = ปริมาณฐาน × จำนวนที่กรอก ÷ ฐานต่อ · ปริมาณรวมเผื่อ = ปัดขึ้น(ปริมาณคำนวณ × (1 + เผื่อ)) ·
                            รวมวัสดุ = ปริมาณรวมเผื่อ × ราคาต่อหน่วย
                        </p>
                        <p className="mt-1 text-[12px] text-gray-500">
                            ชีตนี้เป็น Google Sheet ภายนอกที่ยังไม่ได้รับไฟล์จริง — สร้างจากภาพในสไลด์ (รายการหมวดห้องอาบน้ำ / สโตร์เก็บของยังไม่ทราบ)
                        </p>
                    </SheetCard>
                </>
            )}
        </CalculatorShell>
    );
}

/** เผื่อวัสดุสูญเสีย and ค่าแรงติดตั้ง %. */
function Allowances({ calc }: { calc: Calc }) {
    const { input, update } = calc;
    return (
        <>
            {/* Sheet hint "แก้เป็น 0.05 = 5%" is for a fraction cell; this field is typed in percent. */}
            <InputNumberField label="เผื่อวัสดุสูญเสีย" value={input.waste} percent unit="%" hint="แก้เป็น 5 = 5%"
                onChange={v => update({ waste: v })} />
            <InputNumberField label="ค่าแรงติดตั้ง" value={input.labourRate} percent unit="% ของค่าวัสดุ" hint="ใช้คำนวณ BOQ รวม"
                onChange={v => update({ labourRate: v })} />
        </>
    );
}

/** The take-off table, one block per หมวด. */
function MaterialTables({ calc, emptyText }: { calc: Calc; emptyText: string }) {
    const { input, update, outputs } = calc;

    /** Replace one group's rows, keeping the table ordered by group. */
    const setGroupRows = (group: CampGroupDef['id'], rows: CampMaterialLine[]) => update(p => ({
        ...p,
        materials: CAMP_GROUPS.flatMap(g => (g.id === group ? rows : p.materials.filter(m => m.group === g.id))),
    }));

    return (
        <div className="flex flex-col gap-5">
            {CAMP_GROUPS.map(g => {
                const rows = input.materials.filter(m => m.group === g.id);
                return (
                    <div key={g.id}>
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-semibold text-[13px] text-gray-800">หมวด: {g.label}</span>
                            <span className="text-[12px] text-gray-500">จำนวนที่กรอก {formatNumber(input[g.rooms], 0)} ห้อง</span>
                            <span className="ml-auto text-[13px] tabular-nums">
                                รวมวัสดุ <b>{formatNumber(outputs[`mat_${g.id}`])}</b> บาท
                            </span>
                        </div>
                        {rows.length === 0 && <p className="text-[12px] text-gray-500 mb-1">{emptyText}</p>}
                        <EditableTable<CampMaterialLine>
                            rows={rows}
                            onChange={r => setGroupRows(g.id, r)}
                            newRow={() => ({ group: g.id, code: '', item: '', unit: '', baseQty: 0, basePer: input[g.rooms] > 0 ? input[g.rooms] : 1, unitPrice: 0 })}
                            addLabel={`+ เพิ่มรายการ (${g.label})`}
                            columns={[
                                { kind: 'text', key: 'code', title: 'รหัส', width: 130, get: r => r.code, set: (r, v) => ({ ...r, code: v }) },
                                { kind: 'text', key: 'item', title: 'รายการวัสดุ', get: r => r.item, set: (r, v) => ({ ...r, item: v }) },
                                { kind: 'text', key: 'unit', title: 'หน่วย', width: 64, get: r => r.unit, set: (r, v) => ({ ...r, unit: v }) },
                                { kind: 'number', key: 'baseQty', title: 'ปริมาณฐาน', width: 84, get: r => r.baseQty, set: (r, v) => ({ ...r, baseQty: v }) },
                                { kind: 'number', key: 'basePer', title: 'ฐานต่อ', width: 64, digits: 0, get: r => r.basePer, set: (r, v) => ({ ...r, basePer: v }) },
                                { kind: 'calc', key: 'rooms', title: 'จำนวนที่กรอก', width: 72, digits: 0, get: r => campLine(r, input).rooms },
                                { kind: 'calc', key: 'calcQty', title: 'ปริมาณคำนวณ', width: 84, get: r => campLine(r, input).calcQty },
                                { kind: 'calc', key: 'grossQty', title: 'ปริมาณรวมเผื่อ', width: 84, get: r => campLine(r, input).grossQty },
                                { kind: 'number', key: 'unitPrice', title: 'ราคาต่อหน่วย', width: 90, get: r => r.unitPrice, set: (r, v) => ({ ...r, unitPrice: v }) },
                                { kind: 'calc', key: 'total', title: 'รวมวัสดุ', width: 96, get: r => campLine(r, input).total },
                                { kind: 'text', key: 'note', title: 'หมายเหตุ', width: 100, get: r => r.note ?? '', set: (r, v) => ({ ...r, note: v || undefined }) },
                            ]}
                        />
                    </div>
                );
            })}
        </div>
    );
}

/** The BOQ row a group's room count feeds (its per-room price is typed in the BOQ). */
function boqRow(result: ProjectResult, line: CampGroupDef['boqLine']): BoqItemRow | undefined {
    const row = result.boq.sections.find(s => s.no === 3)?.rows.find(r => r.key === line);
    return row?.type === 'item' ? row : undefined;
}

/** Guided journey: how many rooms of each kind; the take-off recipe, waste and labour % are folded. */
function JourneyView({ calc }: { calc: Calc }) {
    const { input, update, result } = calc;
    const groups = CAMP_GROUPS.map(g => {
        const row = boqRow(result, g.boqLine);
        return { g, rooms: input[g.rooms], perRoom: row ? row.matUnit + row.labUnit : 0, total: row?.total ?? 0 };
    });
    const total = groups.reduce((s, x) => s + x.total, 0);
    const anyRoom = groups.some(x => x.rooms > 0);
    return (
        <>
            <SheetCard title="สิ่งที่ต้องสร้างในไซต์">
                <p className="mb-2 text-[12px] text-gray-500">ใส่จำนวนห้องที่ต้องสร้าง ถ้าไม่ต้องสร้างใส่ 0</p>
                {ROOM_FIELDS.map(f => (
                    <InputNumberField key={f.key} label={f.label} value={input[f.key]} digits={0} unit="ห้อง" hint={f.size}
                        onChange={v => update({ [f.key]: v } as Partial<SiteCampInput>)} />
                ))}
            </SheetCard>

            <AdvancedSection title="รายการวัสดุและค่าตั้งต้น" hint="สูตรวัสดุต่อห้องตั้งไว้ให้แล้ว ใช้เป็นรายการสั่งซื้อ">
                <Allowances calc={calc} />
                <div className="mt-3">
                    <MaterialTables calc={calc} emptyText="ยังไม่มีรายการวัสดุของหมวดนี้ เพิ่มได้ถ้าต้องการ" />
                </div>
            </AdvancedSection>

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="text-[12px] font-semibold text-green-700">ผลลัพธ์</div>
                {anyRoom
                    ? (
                        <>
                            <div className="flex flex-col gap-0.5 text-[13px] text-gray-800 tabular-nums">
                                {groups.filter(x => x.rooms > 0).map(x => (
                                    <span key={x.g.id}>
                                        {x.g.boqDesc} {formatNumber(x.rooms, 0)} ห้อง
                                        <span className="text-gray-500"> (ห้องละ {formatNumber(x.perRoom, 0)} บาท)</span>
                                        {' '}= <b>{formatNumber(x.total, 0)}</b> บาท
                                    </span>
                                ))}
                            </div>
                            <div className="mt-1 text-[15px] text-gray-800">
                                แคมป์คนงานรวม <b className="tabular-nums">{formatNumber(total, 0)}</b> บาท
                            </div>
                        </>
                    )
                    : <div className="text-[13px] text-gray-600">กรอกจำนวนห้องพัก ห้องน้ำ ห้องอาบน้ำ หรือสโตร์ที่ต้องสร้าง ระบบจะคิดราคาให้</div>}
            </div>
        </>
    );
}

/** Take-off totals per group, for reference: the BOQ prices are not linked yet. */
function TakeOffSummary({ outputs, input }: { outputs: Record<string, number>; input: SiteCampInput }) {
    const pct = formatNumber(input.labourRate * 100, 0);
    return (
        <SheetCard title="สรุปค่าวัสดุจากรายการคำนวณ (อ้างอิง)">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-[12px] text-gray-700">
                            <th className={td}>หมวด</th><th className={td}>ห้อง</th><th className={td}>รวมวัสดุ</th>
                            <th className={td}>ค่าแรง {pct}%</th><th className={td}>วัสดุ / ห้อง</th><th className={td}>ค่าแรง / ห้อง</th>
                        </tr>
                    </thead>
                    <tbody>
                        {CAMP_GROUPS.map(g => (
                            <tr key={g.id}>
                                <td className={td}>{g.label}</td>
                                <td className={tdNum}>{formatNumber(input[g.rooms], 0)}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`mat_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`lab_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`matPerRoom_${g.id}`])}</td>
                                <td className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(outputs[`labPerRoom_${g.id}`])}</td>
                            </tr>
                        ))}
                        <tr className="font-semibold">
                            <td className={td} colSpan={2}>รวม</td>
                            <td className={tdNum}>{formatNumber(outputs.materialTotal)}</td>
                            <td className={tdNum}>{formatNumber(outputs.labour)}</td>
                            <td className={`${td} text-right`} colSpan={2}>รวมทั้งหมด {formatNumber(outputs.total)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p className="mt-2 text-[12px] text-gray-500">
                จำนวนห้องส่งเข้า BOQ (ปริมาณแถว ห้องพักคนงาน / ห้องน้ำคนงาน / ห้องอาบน้ำ / สโตร์เก็บของ) ส่วนราคาวัสดุและค่าแรงต่อห้อง
                ยังกำหนดที่หน้า BOQ (Excel พิมพ์ไว้ 7,000 / 4,700 / 4,500 / 7,000) จนกว่าจะได้ชีตคำนวณฉบับเต็ม
                ยอดในตารางนี้ใช้อ้างอิงเท่านั้น
            </p>
        </SheetCard>
    );
}
