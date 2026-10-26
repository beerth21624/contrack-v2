'use client';

// Guided-journey view of the two pipe-run sheets (ท่อน้ำทิ้ง / ท่อน้ำดี): the fixed main rows (one per pipe size the
// BOQ prices) with only their lengths to fill, optional extra runs, prices folded away, and a short length summary.
// Same input and calculation as the Excel-mirror table in PipeRunsSheet.
import { Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { CalculatorDef } from '@/domain/calculators/types';
import type { BoqItemRow } from '@/domain/boq/types';
import type { ProjectResult } from '@/domain/project';
import {
    normalizeSize, plainLabel, runLength, sizeFromLabel, sizeMismatches, unlinkedRuns,
    type PipeBoqLine, type PipePlainLabel, type PipeRun, type PipeRunsInput,
} from '@/domain/calculators/waste-pipe/pipe-runs';
import { EditableTable, type SheetColumn } from '@/components/sheet/EditableTable';
import { SheetCard } from '@/components/sheet/SheetFields';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { formatNumber } from '@/components/sheet/NumberCell';

const NO_DEPS = { outputs: () => undefined };
const EMPTY_RUN: PipeRun = { label: '', size: '', horizontal: 0, vertical: 0 };

const colTitle = (title: string, hint: string) => (
    <div>
        <div>{title}</div>
        <div className="font-normal text-[11px] text-gray-400">{hint}</div>
    </div>
);

const lengthColumns: SheetColumn<PipeRun>[] = [
    { kind: 'number', key: 'horizontal', title: colTitle('แนวราบ (ม.)', 'วัดตามแปลน'), width: 110,
        get: r => r.horizontal, set: (r, v) => ({ ...r, horizontal: v }) },
    { kind: 'number', key: 'vertical', title: colTitle('แนวดิ่ง (ม.)', 'ท่อขึ้น-ลงผนัง/พื้น'), width: 110,
        get: r => r.vertical, set: (r, v) => ({ ...r, vertical: v }) },
    { kind: 'calc', key: 'length', title: colTitle('รวม (ม.)', 'ระบบคิดให้'), width: 100, get: r => runLength(r) },
];

export function PipeRunsJourney({ def, input, onChange, result, items, sizes, lines, plain, noun }: {
    def: CalculatorDef<PipeRunsInput>;
    input: PipeRunsInput;
    onChange: (runs: PipeRun[]) => void;
    result: ProjectResult;
    items: readonly string[];
    sizes: readonly string[];
    lines: readonly PipeBoqLine[];
    plain: Record<string, PipePlainLabel>;
    /** What the pipes are, e.g. "ท่อน้ำทิ้ง". */
    noun: string;
}) {
    const n = lines.length;
    const template = (def.blank?.() ?? def.defaults()).runs;
    const fixed = lines.map((_, i) => input.runs[i] ?? template[i] ?? EMPTY_RUN);
    const extras = input.runs.slice(n);
    const out = def.compute(input, NO_DEPS);
    const setFixed = (rows: PipeRun[]) => onChange([...rows, ...extras]);
    const setExtras = (rows: PipeRun[]) => onChange([...fixed, ...rows]);
    const addExtra = () => setExtras([...extras, EMPTY_RUN]);

    /** Plain name of a main row: its own item when known, else its own text, else the Excel item of that row. */
    const fixedName = (i: number): string => {
        const own = fixed[i]?.label ?? '';
        const known = plainLabel(own, plain);
        if (known) return known.name;
        if (own.trim() !== '') return own.trim();
        return plainLabel(template[i]?.label ?? '', plain)?.name ?? `ท่อ ${lines[i]?.size ?? ''}`;
    };
    const fixedHint = (i: number) => plainLabel(fixed[i]?.label ?? '', plain)?.hint
        ?? plainLabel(template[i]?.label ?? '', plain)?.hint;

    const sectionNo = def.sections[0] ?? 0;
    const boqRow = (line: PipeBoqLine) => result.boq.sections.find(s => s.no === sectionNo)?.rows
        .find((r): r is BoqItemRow => r.type === 'item' && r.key === line.line);

    const mismatches = sizeMismatches(input, lines);
    const unlinked = unlinkedRuns(input, lines);
    const itemOptions = items.map(v => ({ value: v, label: plainLabel(v, plain)?.name ?? v }));
    const waste = lines.map(boqRow).find(r => r !== undefined)?.waste;

    return (
        <>
            <SheetCard title="ท่อหลัก">
                <p className="mb-2 text-[13px] text-gray-600">
                    กรอกความยาวท่อแต่ละชนิดจากแบบ ถ้ามีหลายแนวให้รวมความยาวมาใส่ในแถวเดียว
                    ระบบบวกแนวราบกับแนวดิ่งให้เอง
                </p>
                <EditableTable<PipeRun>
                    rows={fixed}
                    onChange={setFixed}
                    canDelete={false}
                    columns={[
                        {
                            kind: 'label', key: 'pipe', title: 'ท่อ', width: 280,
                            get: (_, i) => (
                                <div className="py-0.5">
                                    <div className="font-medium text-gray-800">{fixedName(i)}</div>
                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                        <Tag color="blue" className="!mr-0">{lines[i]?.size}</Tag>
                                        <span className="text-[11px] text-gray-400">{fixedHint(i)}</span>
                                    </div>
                                </div>
                            ),
                        },
                        ...lengthColumns,
                    ]}
                />
                <p className="mt-2 text-[12px] text-gray-500">
                    แถวท่อหลักลบไม่ได้ เพราะแต่ละแถวคือท่อ 1 ขนาดที่ตั้งราคาไว้แล้ว — ถ้าแบบไม่มีท่อชนิดนั้น ปล่อยเป็น 0
                </p>
                {mismatches.map(m => (
                    <div key={m.index} className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-[13px] text-orange-700">
                        <span>
                            &quot;{fixedName(m.index)}&quot; ถูกเปลี่ยนเป็นท่อ {m.size} แต่ราคาที่ใช้คิดยังเป็นราคาท่อ {m.line.size}
                        </span>
                        <Button size="small" onClick={() => setFixed(fixed.map((r, i) => (i === m.index
                            ? { ...r, size: m.line.size, label: template[i]?.label ?? r.label }
                            : r)))}>
                            กลับเป็นท่อ {m.line.size}
                        </Button>
                    </div>
                ))}
            </SheetCard>

            <SheetCard title={`${noun}เพิ่มเติม (ถ้ามี)`}>
                {extras.length === 0
                    ? (
                        <div className="flex flex-col items-center gap-3 py-3 text-center">
                            <p className="text-[13px] text-gray-500 m-0">
                                อยากแยกกรอกเป็นแนว ๆ (เช่น ห้องน้ำชั้น 2) เพิ่มได้ที่นี่
                                — ความยาวจะรวมเข้ากับท่อขนาดเดียวกันข้างบน
                            </p>
                            <Button type="dashed" size="large" icon={<PlusOutlined />} onClick={addExtra}>
                                เพิ่ม{noun}อีกแนว
                            </Button>
                        </div>
                    )
                    : (
                        <EditableTable<PipeRun>
                            rows={extras}
                            onChange={setExtras}
                            newRow={() => EMPTY_RUN}
                            addLabel={`เพิ่ม${noun}อีกแนว`}
                            columns={[
                                { kind: 'select', key: 'label', title: 'ชนิดท่อ', width: 240, options: itemOptions,
                                    get: r => r.label,
                                    // The item ends with its pipe size: pick that size too (it can still be changed).
                                    set: (r, v) => ({ ...r, label: v, size: sizeFromLabel(v, sizes) || r.size }) },
                                { kind: 'select', key: 'size', title: 'ขนาด', width: 110,
                                    options: sizes.map(v => ({ value: v })),
                                    get: r => normalizeSize(r.size), set: (r, v) => ({ ...r, size: v }) },
                                ...lengthColumns,
                            ]}
                        />
                    )}
                {unlinked.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-[13px] text-orange-600 space-y-0.5">
                        {unlinked.map(u => (
                            <li key={u.index}>
                                แถวที่ {u.index - n + 1}: {u.size === ''
                                    ? 'ยังไม่ได้เลือกขนาดท่อ'
                                    : `ไม่มีราคาท่อขนาด ${u.size}`} — ความยาว {formatNumber(u.length)} ม. ยังไม่ถูกนำไปคิดเงิน
                            </li>
                        ))}
                    </ul>
                )}
            </SheetCard>

            <AdvancedSection>
                <table className="w-full max-w-lg border-collapse text-[13px]">
                    <thead>
                        <tr className="text-gray-600">
                            <th className="text-left font-semibold py-1">ท่อ</th>
                            <th className="text-right font-semibold py-1">ค่าท่อ / ม.</th>
                            <th className="text-right font-semibold py-1">ค่าแรง / ม.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((l, i) => {
                            const row = boqRow(l);
                            return (
                                <tr key={l.line} className="border-t border-gray-100">
                                    <td className="py-1">{l.size} <span className="text-gray-400">{fixedName(i)}</span></td>
                                    <td className="py-1 text-right tabular-nums">{formatNumber(row?.matUnit, 0)} บาท</td>
                                    <td className="py-1 text-right tabular-nums">{formatNumber(row?.labUnit, 0)} บาท</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <ul className="mt-2 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    {waste !== undefined && <li>คิดเผื่อเศษท่อ {formatNumber(waste * 100, 0)} % (ค่าแรงคิดจากความยาวที่เผื่อแล้ว)</li>}
                    <li>ข้อต่อและวัสดุสิ้นเปลือง คิดเพิ่ม 50 % ของค่าท่อและค่าแรง</li>
                    <li>แก้ราคาได้ที่หน้า BOQ</li>
                </ul>
            </AdvancedSection>

            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="text-[12px] font-semibold text-green-800 mb-1">สรุปความยาว{noun}</div>
                <div className="flex flex-col gap-0.5">
                    {lines.map((l, i) => (
                        <div key={l.line} className="flex items-baseline gap-2 text-[14px]">
                            <span className="font-medium text-gray-800">ท่อ {l.size}</span>
                            <span className="text-[12px] text-gray-500 truncate">{fixedName(i)}</span>
                            <span className="ml-auto tabular-nums font-semibold">รวม {formatNumber(out[l.line])} ม.</span>
                        </div>
                    ))}
                    {lines.length > 1 && (
                        <div className="flex items-baseline gap-2 text-[13px] border-t border-green-200 mt-1 pt-1 text-gray-700">
                            <span>ทุกขนาด</span>
                            <span className="ml-auto tabular-nums">{formatNumber((out.total ?? 0) - (out.unlinked ?? 0))} ม.</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
