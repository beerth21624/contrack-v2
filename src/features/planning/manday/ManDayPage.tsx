'use client';

// Man-Day_Basic (Excel v5 sheet 02), planning columns O..U: crew per work block → daily wage → calculated
// days S (hint) → typed days T (→ S-Curve duration) and budget U (→ S-Curve budget).
import { Button, Popconfirm, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { NumberCell, SHEET_COLORS, TextCell, formatNumber } from '@/components/sheet/NumberCell';
import { InputNumberField, SheetCard } from '@/components/sheet/SheetFields';
import {
    WAGE_SET_LIMITS, addWageSet, isBuiltInWageSet, removeWageSet, updateWageSet, wageSetLabel, wageSetUsage,
    type ManDayBlockInput, type ManDayBlockResult, type ManDayInput, type WageSet, type WageSetId,
} from '@/domain/planning';
import { CalcText, NoBoqYet, PlanningHeader, StatTile, SummaryBanner, formatDate, money, usePlanning } from '../shared/planning-ui';

interface Row {
    id: string;
    input: ManDayBlockInput;
    result: ManDayBlockResult;
}

const daysDigits = (v: number) => (Number.isInteger(v) ? 0 : 2);

function basisNote(r: ManDayBlockResult, share: number): string | null {
    if (r.labourBasis === 'none') return 'ไม่คำนวณวัน (งานเหมา) — กรอกวันเอง';
    if (r.labourBasis === 'shareOfTotal') return `งานเหมา: คิดค่าแรง ${formatNumber(share * 100, 0)}% ของยอดรวม`;
    return null;
}

/** One wage set in the "ค่าแรงต่อวัน" card: name, ช่าง and คนงาน per day; user sets can be deleted. */
function WageSetFields({ set, usedBy, onChange, onRemove }: {
    set: WageSet; usedBy: number; onChange: (patch: Partial<Omit<WageSet, 'id'>>) => void; onRemove: () => void;
}) {
    const builtIn = isBuiltInWageSet(set.id);
    return (
        <div className="border-t border-gray-100 first:border-t-0 pt-2 first:pt-0 mt-2 first:mt-0">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <span className="text-[12px] text-gray-500 whitespace-nowrap">ชุด {set.id}</span>
                <div className="rounded" style={{ background: SHEET_COLORS.input }}>
                    <TextCell value={set.name} placeholder="ตั้งชื่อชุด" ariaLabel={`ชื่อชุดค่าแรง ${set.id}`}
                        onCommit={v => onChange({ name: (v ?? '').slice(0, WAGE_SET_LIMITS.maxNameLength) })} />
                </div>
                {builtIn ? <span className="w-6" /> : (
                    <Popconfirm title={`ลบชุดค่าแรง ${set.id}?`} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
                        description={usedBy > 0 ? `มี ${String(usedBy)} งานใช้ชุดนี้ จะเปลี่ยนไปใช้ชุด A` : undefined}
                        onConfirm={onRemove}>
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`ลบชุดค่าแรง ${set.id}`} />
                    </Popconfirm>
                )}
            </div>
            <InputNumberField label="ช่าง" unit="บาท/วัน" digits={0} value={set.skilled} onChange={v => onChange({ skilled: v })} />
            <InputNumberField label="คนงาน" unit="บาท/วัน" digits={0} value={set.labourer} onChange={v => onChange({ labourer: v })} />
        </div>
    );
}

export function ManDayPage() {
    const { planning, input, stored, setPlanning, result } = usePlanning();
    const md = input.manday;
    const res = planning.manday;
    const sched = planning.schedule;
    const save = (next: ManDayInput) => setPlanning({ manday: next });

    const rows: Row[] = res.blocks.map(b => ({
        id: b.id,
        result: b,
        input: md.blocks[b.id] ?? { skilled: b.skilled, labourers: b.labourers, wageSet: b.wageSet, days: b.days },
    }));
    const saveRows = (next: Row[]) => save({ ...md, blocks: { ...md.blocks, ...Object.fromEntries(next.map(r => [r.id, r.input])) } });
    const setBlock = (id: string, patch: Partial<ManDayBlockInput>) =>
        saveRows(rows.map(r => (r.id === id ? { ...r, input: { ...r.input, ...patch } } : r)));

    const differs = rows.filter(r => r.result.suggestedDays !== null && r.result.suggestedDays !== r.input.days);
    const applyAllSuggested = () => saveRows(rows.map(r => (
        r.result.suggestedDays === null ? r : { ...r, input: { ...r.input, days: r.result.suggestedDays } }
    )));
    const setWage = (id: WageSetId, patch: Partial<Omit<WageSet, 'id'>>) => save(updateWageSet(md, id, patch));
    const rates = (s: WageSet) => `${formatNumber(s.skilled, 0)}/${formatNumber(s.labourer, 0)}`;

    const columns: SheetColumn<Row>[] = [
        {
            kind: 'label', key: 'title', title: 'งาน', width: 250,
            get: r => {
                const note = basisNote(r.result, md.subcontractLabourShare);
                return (
                    <div className="min-w-[200px] leading-tight py-0.5">
                        <span className="text-gray-400 mr-1 tabular-nums">{r.id}</span>{r.result.title}
                        <div className="text-[11px] text-gray-400">หมวด BOQ {r.result.section}{note ? ` · ${note}` : ''}</div>
                    </div>
                );
            },
        },
        { kind: 'number', key: 'skilled', title: <>1.ช่าง<br /><span className="font-normal">(คน)</span></>, width: 64, digits: 0, get: r => r.input.skilled, set: (r, v) => ({ ...r, input: { ...r.input, skilled: v } }) },
        { kind: 'number', key: 'labourers', title: <>2.คนงาน<br /><span className="font-normal">(คน)</span></>, width: 64, digits: 0, get: r => r.input.labourers, set: (r, v) => ({ ...r, input: { ...r.input, labourers: v } }) },
        { kind: 'calc', key: 'crew', title: <>3.จำนวนคน<br /><span className="font-normal">(คน)</span></>, width: 72, digits: 0, get: r => r.result.crew },
        {
            kind: 'select', key: 'set', title: <>ชุดค่าแรง<br /><span className="font-normal">(ช่าง/คนงาน)</span></>, width: 130, popupWidth: 280,
            options: md.wageSets.map(s => ({
                value: s.id,
                selectedLabel: <span className="tabular-nums">{s.id} · {rates(s)}</span>,
                label: (
                    <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate">{wageSetLabel(s)}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">{rates(s)}</span>
                    </span>
                ),
            })),
            // The set R really used: an unknown id in a stored block shows (and computes) as the task's Excel set.
            get: r => r.result.wageSet, set: (r, v) => ({ ...r, input: { ...r.input, wageSet: v } }),
        },
        { kind: 'calc', key: 'wage', title: <>4.ค่าแรงต่อวัน<br /><span className="font-normal">(รวม บาท)</span></>, width: 96, digits: 0, get: r => r.result.dailyWage },
        { kind: 'calc', key: 'labour', title: <>ค่าแรงของงาน<br /><span className="font-normal">(จาก BOQ บาท)</span></>, width: 110, digits: 2, get: r => (r.result.labourBasis === 'none' ? null : r.result.labourCost) },
        {
            kind: 'label', key: 'calcDays', title: <>5.วันตามค่าแรง<br /><span className="font-normal">(วัน)</span></>, width: 84,
            get: r => (
                <Tooltip title={r.result.calcDays === null
                    ? (r.result.labourBasis === 'none' ? 'งานนี้ไม่มีสูตรใน Excel' : 'ยังไม่มีคนทำงาน (ค่าแรงต่อวัน = 0)')
                    : 'ค่าแรงของงาน ÷ ค่าแรงต่อวัน'}>
                    <div><CalcText>{r.result.calcDays === null ? '–' : formatNumber(r.result.calcDays, 2)}</CalcText></div>
                </Tooltip>
            ),
        },
        {
            kind: 'label', key: 'days', title: <>6.วันที่ใช้จริง<br /><span className="font-normal">(ประเมิน วัน)</span></>, width: 110,
            get: r => {
                const s = r.result.suggestedDays;
                return (
                    <div className="flex items-center gap-1">
                        <div className="w-[56px]">
                            <NumberCell value={r.input.days} digits={daysDigits(r.input.days)} ariaLabel={`${r.result.title} วันประเมิน`}
                                onCommit={v => setBlock(r.id, { days: v ?? s ?? 0 })} />
                        </div>
                        {s !== null && s !== r.input.days && (
                            <Tooltip title={`ใช้ค่าที่คำนวณ (ปัดเศษ) = ${s} วัน`}>
                                <Button size="small" type="link" className="!px-0.5" icon={<UndoOutlined />}
                                    aria-label={`ใช้ค่าที่คำนวณ ${s} วัน`} onClick={() => setBlock(r.id, { days: s })}>{s}</Button>
                            </Tooltip>
                        )}
                    </div>
                );
            },
        },
        { kind: 'calc', key: 'budget', title: <>7.งบประมาณ<br /><span className="font-normal">(บาท)</span></>, width: 116, digits: 2, get: r => r.result.budget },
    ];

    const footer = (
        <tr className="font-semibold bg-gray-50">
            <td className="border border-gray-200 px-2 py-1 text-right text-[13px]" colSpan={9}>รวมเวลา / รวมงบประมาณ</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">{formatNumber(res.totalDays, daysDigits(res.totalDays))} วัน</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-[13px]">{formatNumber(res.totalBudget, 2)}</td>
        </tr>
    );

    return (
        <div className="flex flex-col gap-4">
            <PlanningHeader current="/man-day" title="ประเมินจำนวนคน-วัน (Man-Day) และงบประมาณ" sheetName="Man-Day_Basic"
                isDefault={stored.manday === undefined} onReset={() => setPlanning({ manday: undefined })} />
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />

            {/* The totals (days, budget, project duration) are the tiles below: the banner says what they mean. */}
            <SummaryBanner headline={<>จัดคน {rows.length} งาน</>}>
                <span>
                    &quot;รวมเวลา&quot; คือผลรวมวันของทุกงาน บางงานทำพร้อมกัน ระยะเวลาโครงการจริงจึงสั้นกว่า (ดูได้ในหน้า S-Curve)
                </span>
                <span>กรอกจำนวนช่าง/คนงาน ระบบคำนวณวันจากค่าแรงใน BOQ ให้ แล้วใส่วันที่คิดว่าจะใช้จริงในช่อง &quot;วันที่ใช้จริง&quot;</span>
            </SummaryBanner>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                <SheetCard title="ค่าแรงต่อวัน">
                    {md.wageSets.map(s => (
                        <WageSetFields key={s.id} set={s} usedBy={wageSetUsage(md, s.id).length}
                            onChange={patch => setWage(s.id, patch)} onRemove={() => save(removeWageSet(md, s.id))} />
                    ))}
                    {md.wageSets.length < WAGE_SET_LIMITS.maxSets && (
                        <Button type="dashed" size="small" icon={<PlusOutlined />} className="mt-2"
                            onClick={() => save(addWageSet(md).input)}>เพิ่มชุดค่าแรง</Button>
                    )}
                    <div className="border-t border-gray-100 mt-3 pt-2">
                        <InputNumberField label="งานเหมา: ค่าแรง % ของยอดรวม" percent value={md.subcontractLabourShare}
                            onChange={v => save({ ...md, subcontractLabourShare: v })} />
                    </div>
                </SheetCard>
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatTile label="รวมเวลา (ผลรวมวันทุกงาน)" value={formatNumber(res.totalDays, 0)} unit="วัน" />
                    <StatTile label="ระยะเวลาโครงการ (S-Curve)" value={sched.durationDays} unit="วัน"
                        hint={sched.start && sched.finish ? `${formatDate(sched.start)} – ${formatDate(sched.finish)}` : undefined} />
                    <StatTile label="รวมงบประมาณ" value={money(res.totalBudget)} unit="บาท" />
                    <div className="col-span-2 sm:col-span-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-gray-700 flex flex-wrap items-center gap-2">
                        {differs.length === 0
                            ? <span>วันประเมินทุกงานเท่ากับค่าที่คำนวณ (ปัดเศษ)</span>
                            : (
                                <>
                                    <span>วันประเมิน {differs.length} งาน ต่างจากค่าที่คำนวณ (ปัดเศษ)</span>
                                    <Popconfirm title="ตั้งวันประเมินทุกงาน = ค่าที่คำนวณ (ปัดเศษ)?" okText="ตั้งค่า" cancelText="ยกเลิก"
                                        onConfirm={applyAllSuggested}>
                                        <Button size="small" icon={<UndoOutlined />}>ใช้ค่าที่คำนวณทุกงาน</Button>
                                    </Popconfirm>
                                </>
                            )}
                    </div>
                </div>
            </div>

            <SheetCard title="วางแผน Man-Day และงบประมาณ">
                <EditableTable rows={rows} columns={columns} onChange={saveRows} canDelete={false} footer={footer} />
                <div className="text-[12px] text-gray-500 mt-2">
                    ช่องเหลือง = กรอกเอง · ช่องเขียว = ระบบคำนวณ · ปุ่ม <UndoOutlined /> ข้างวันประเมิน = ใช้ค่าที่คำนวณ (ปัดเศษ)
                </div>
            </SheetCard>
        </div>
    );
}

export default ManDayPage;
