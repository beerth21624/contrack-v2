'use client';

import {
    ceiling, ceilingRowArea, setCeilingCode, CEILING_CODES, CEILING_DEFAULT_PAINT, CEILING_DESCRIPTIONS,
    CEILING_DESCRIPTION_ORDER, CEILING_PAINT_GROUPS, paintGroupLabel, paintKey, SLOPED_CEILING_DEG,
    type CeilingCode, type CeilingInput, type CeilingPaintGroup, type CeilingRow,
} from '@/domain/calculators/ceiling';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import {
    AddButton, ChoiceButtons, EmptyState, FillProgress, NameInput, PlanCard, PlanField, PlanNumber, ResultSummary,
    countFill, fillState, insertAfter, nextCopyName, removeAt, type FillState,
} from '@/components/sheet/journey';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator, type UseCalculator } from '../useCalculator';

const isCode = (v: string): v is CeilingCode => (CEILING_CODES as readonly string[]).includes(v);
const isPaint = (v: string): v is CeilingPaintGroup => (CEILING_PAINT_GROUPS as readonly string[]).includes(v);

/** Scroll the table sideways instead of letting the รายการ dropdown squeeze the number columns. */
const TABLE_MIN_WIDTH = 1240;

/** Journey: short type names, with where the sample house uses each one. */
const PLAIN_TYPE: Record<CeilingCode, string> = {
    C1: 'ยิปซัมบอร์ด 9 มม. (ห้องทั่วไป)',
    C2: 'ยิปซัมบอร์ดกันชื้น 9 มม. (ห้องน้ำ, เฉลียง)',
    C3: 'ไฟเบอร์ซีเมนต์ 4 มม. (ชายคาภายนอก)',
    C4: 'ระแนงไม้ไฟเบอร์ซีเมนต์ 4 นิ้ว',
};
const PLAIN_PAINT: Record<CeilingPaintGroup, string> = {
    ภายใน: 'สีภายใน', ภายนอก: 'สีภายนอก', ไม้ระแนง: 'สีย้อมไม้ (ระแนง)',
};

const newJourneyRow = (): CeilingRow => ({ code: 'C1', width: 0, length: 0, location: '', paint: CEILING_DEFAULT_PAINT.C1 });

/** Journey: the four ceiling types as buttons (short names; the full name is the button's tooltip). */
const TYPE_CHOICES = CEILING_CODES.map(c => ({
    value: c,
    label: { C1: 'ยิปซัมบอร์ด', C2: 'ยิปซัมกันชื้น', C3: 'ไฟเบอร์ซีเมนต์', C4: 'ระแนงไม้' }[c],
    hint: PLAIN_TYPE[c],
}));
const PAINT_CHOICES: { value: CeilingPaintGroup | ''; label: string }[] = [
    ...CEILING_PAINT_GROUPS.map(g => ({ value: g, label: PLAIN_PAINT[g] })),
    { value: '', label: 'ไม่ทาสี' },
];

/** Plan values a room card still needs, in reading order. */
function missingOf(r: CeilingRow): string[] {
    const eaves = r.code === 'C3';
    const out: string[] = [];
    if (r.code === '') out.push('ชนิดฝ้า');
    if (!(r.width > 0)) out.push(eaves ? 'ระยะยื่นชายคา' : 'กว้าง');
    if (!(r.length > 0)) out.push(eaves ? 'ความยาวรอบชายคา' : 'ยาว');
    return out;
}
// A new room already has a type, so a card counts as started once a size is typed.
const stateOf = (r: CeilingRow): FillState => fillState([missingOf(r).length === 0], r.width > 0 || r.length > 0);

/** Journey mode: one card per room, read off the ceiling plan; live area per room, results reduced to the totals. */
function CeilingJourney({ input, update, outputs }: {
    input: CeilingInput; update: UseCalculator<CeilingInput>['update']; outputs: Record<string, number>;
}) {
    const rows = input.rows;
    const setRows = (edit: (rows: CeilingRow[]) => CeilingRow[]) => update(p => ({ ...p, rows: edit(p.rows) }));
    const editRow = (i: number, edit: (r: CeilingRow) => CeilingRow) => setRows(rs => rs.map((r, j) => (j === i ? edit(r) : r)));
    const setRow = (i: number, patch: Partial<CeilingRow>) => editRow(i, r => ({ ...r, ...patch }));
    const add = () => setRows(rs => [...rs, newJourneyRow()]);
    // "ทำซ้ำ": the same room right after it, under the next name (ห้องนอน 1 → ห้องนอน 2).
    const duplicate = (i: number) => setRows(rs => {
        const r = rs[i];
        return r ? insertAfter(rs, i, { ...r, location: nextCopyName(r.location, rs.map(x => x.location)) }) : rs;
    });
    const usedTypes = CEILING_CODES.filter(c => (outputs[c] ?? 0) !== 0);
    const states = rows.map(stateOf);

    const card = (r: CeilingRow, i: number) => {
        const state = states[i] ?? 'empty';
        const missing = state === 'missing' ? new Set(missingOf(r)) : new Set<string>();
        const eaves = r.code === 'C3';
        const area = ceilingRowArea(r);
        return (
            <PlanCard key={i} index={i + 1} state={state}
                title={<NameInput value={r.location} placeholder="ชื่อห้อง เช่น ห้องนอน 1" ariaLabel={`ชื่อห้องที่ ${String(i + 1)}`}
                    onChange={location => setRow(i, { location })} />}
                result={area > 0 ? `${formatNumber(area)} ตร.ม.` : undefined}
                onDuplicate={() => duplicate(i)} onDelete={() => setRows(rs => removeAt(rs, i))} hasData={r.width > 0 || r.length > 0}
                deleteTitle="ลบห้องนี้?" missingText={`ยังขาด: ${missingOf(r).join(', ')}`}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3">
                    <PlanField className="sm:col-span-3" label="ชนิดฝ้า">
                        <ChoiceButtons ariaLabel="ชนิดฝ้า" size="small" options={TYPE_CHOICES} value={r.code === '' ? undefined : r.code}
                            onChange={code => editRow(i, row => setCeilingCode(row, code))} />
                    </PlanField>
                    <PlanNumber label={eaves ? 'ระยะยื่นชายคา' : 'กว้าง'} unit="ม." value={r.width}
                        range={eaves ? [0.2, 2] : [0.3, 30]} missing={missing.has(eaves ? 'ระยะยื่นชายคา' : 'กว้าง')}
                        onChange={width => setRow(i, { width })} />
                    <PlanNumber label={eaves ? 'ความยาวรอบชายคา' : 'ยาว'} unit="ม." value={r.length}
                        range={eaves ? [1, 300] : [0.3, 30]} missing={missing.has(eaves ? 'ความยาวรอบชายคา' : 'ยาว')}
                        onChange={length => setRow(i, { length })} />
                    <PlanNumber label="ลาดเอียง" unit="องศา" digits={0} value={r.slope ?? 0} range={[5, 60]}
                        hint="ฝ้าเรียบเว้นว่าง" onChange={slope => setRow(i, { slope })} />
                    <PlanField className="sm:col-span-3" label="ทาสีฝ้า">
                        <ChoiceButtons ariaLabel="ทาสีฝ้า" size="small" options={PAINT_CHOICES} value={r.paint}
                            onChange={paint => setRow(i, { paint })} />
                    </PlanField>
                </div>
            </PlanCard>
        );
    };

    return (
        <>
            <SheetCard title="ห้องและชนิดฝ้า">
                {rows.length === 0
                    ? (
                        <EmptyState text="ยังไม่มีห้อง — เปิดแปลนฝ้าเพดาน แล้วเพิ่มทีละห้อง (ชื่อห้อง ชนิดฝ้า กว้าง × ยาว)"
                            addLabel="เพิ่มห้อง" onAdd={add} />
                    )
                    : (
                        <div className="flex flex-col gap-2">
                            {rows.length >= 5 && <FillProgress {...countFill(states)} noun="ห้อง" />}
                            {rows.map(card)}
                            <AddButton label="เพิ่มห้อง" onClick={add} />
                            <p className="text-[12px] text-gray-500">
                                ห้องรูปตัว L แบ่งเป็น 2 การ์ด · ห้องที่คล้ายกันกด &quot;ทำซ้ำ&quot; แล้วแก้เฉพาะขนาด
                            </p>
                        </div>
                    )}
            </SheetCard>

            <ResultSummary
                items={[
                    ...usedTypes.map(c => ({ label: PLAIN_TYPE[c], value: outputs[c], unit: 'ตร.ม.' })),
                    { label: 'พื้นที่ฝ้ารวม', value: outputs.total, unit: 'ตร.ม.' },
                ]}
                note={CEILING_PAINT_GROUPS.some(g => (outputs[paintKey(g)] ?? 0) !== 0)
                    ? <>ส่งต่อขั้นตอนทาสี: {CEILING_PAINT_GROUPS.filter(g => (outputs[paintKey(g)] ?? 0) !== 0)
                        .map(g => `${PLAIN_PAINT[g]} ${formatNumber(outputs[paintKey(g)])} ตร.ม.`).join(' · ')}</>
                    : 'พื้นที่ฝ้าที่ทาสีจะส่งต่อไปขั้นตอนทาสีให้อัตโนมัติ'} />
        </>
    );
}

export default function CeilingPage() {
    const { input, update, reset, outputs, result, isDefault } = useCalculator(ceiling);
    const inJourney = useJourneyMode();

    if (inJourney) {
        return (
            <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
                <CeilingJourney input={input} outputs={outputs} update={update} />
            </CalculatorShell>
        );
    }

    return (
        <CalculatorShell def={ceiling} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title=": ตารางคำนวณปริมาณฝ้าเพดาน">
                {/* The long รายการ texts would otherwise squeeze กว้าง/ยาว to ~40 px (62.30 shown as "62."). */}
                <div className="overflow-x-auto">
                    <div style={{ minWidth: TABLE_MIN_WIDTH }}>
                        <EditableTable<CeilingRow>
                            rows={input.rows}
                            onChange={rows => update({ rows })}
                            newRow={() => ({ code: '', width: 0, length: 0, location: '', paint: '' })}
                            addLabel="+ เพิ่มรายการ"
                            columns={[
                                { kind: 'select', key: 'code', title: 'สัญลักษณ์', width: 80,
                                    options: CEILING_CODES.map(v => ({ value: v })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                // Excel's C column is its own dropdown; here it selects the same code (O-13), in Excel's list order.
                                { kind: 'select', key: 'desc', title: 'รายการ', width: 380,
                                    options: CEILING_DESCRIPTION_ORDER.map(c => ({ value: c, label: CEILING_DESCRIPTIONS[c] })),
                                    get: r => r.code, set: (r, v) => ({ ...r, code: isCode(v) ? v : '' }) },
                                { kind: 'number', key: 'width', title: 'กว้าง (ม.)', width: 80,
                                    get: r => r.width, set: (r, v) => ({ ...r, width: v }) },
                                { kind: 'number', key: 'length', title: 'ยาว (ม.)', width: 80,
                                    get: r => r.length, set: (r, v) => ({ ...r, length: v }) },
                                { kind: 'number', key: 'slope', title: 'ลาดเอียง (องศา)', width: 80, digits: 0,
                                    get: r => r.slope ?? 0, set: (r, v) => ({ ...r, slope: v }) },
                                { kind: 'calc', key: 'area', title: 'รวม (ตร.ม.)', width: 90, get: r => ceilingRowArea(r) },
                                { kind: 'text', key: 'location', title: 'ตำแหน่ง', width: 150,
                                    get: r => r.location, set: (r, v) => ({ ...r, location: v }) },
                                { kind: 'select', key: 'paint', title: 'แยกงานทาสี', width: 150,
                                    options: CEILING_PAINT_GROUPS.map(g => ({ value: g, label: paintGroupLabel(g) })),
                                    get: r => r.paint, set: (r, v) => ({ ...r, paint: isPaint(v) ? v : '' }) },
                            ]}
                        />
                    </div>
                </div>
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>รวม (ตร.ม.) = กว้าง × ยาว</li>
                    <li>
                        ฝ้าลาดเอียง (เช่น ฝ้าเฉลียงใต้หลังคา): รวม = กว้าง × ยาว ÷ cos(องศา) — ตัวอย่าง Excel เฉลียง 1–2
                        ใช้ {SLOPED_CEILING_DEG}° (ฝ้าเรียบใส่ 0)
                    </li>
                    <li>สัญลักษณ์ C1–C4 ใช้รวมปริมาณเข้า BOQ หมวด 19 · แยกงานทาสี ใช้รวมพื้นที่ทาสีฝ้าในโปรแกรมงานทาสี</li>
                </ul>
            </SheetCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SheetCard title="สรุปพื้นที่ฝ้าเพดาน (ส่งเข้า BOQ หมวด 19)">
                    {CEILING_CODES.map(c => (
                        <CalcField key={c} label={`${c} ${CEILING_DESCRIPTIONS[c]}`} value={outputs[c]} unit="ตร.ม." />
                    ))}
                    <CalcField label="รวมทั้งหมด" value={outputs.total} unit="ตร.ม." strong />
                </SheetCard>
                <SheetCard title="สรุปพื้นที่ทาสีฝ้า (ส่งเข้าโปรแกรมงานทาสี)">
                    {CEILING_PAINT_GROUPS.map(g => (
                        <CalcField key={g} label={paintGroupLabel(g)} value={outputs[paintKey(g)]} unit="ตร.ม." />
                    ))}
                </SheetCard>
            </div>
        </CalculatorShell>
    );
}
