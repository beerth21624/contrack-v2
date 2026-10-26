'use client';

// Table shared by the "ท่อน้ำทิ้ง_Waste Pipe" and "ท่อน้ำดี_Water Pipe" pages (Excel sheets 05 / 06 have the same layout).
import type { CalculatorDef } from '@/domain/calculators/types';
import type { ProjectResult } from '@/domain/project';
import {
    runLength, sizeFromLabel, sizeMismatches, unlinkedRuns,
    type PipeBoqLine, type PipePlainLabel, type PipeRun, type PipeRunsInput,
} from '@/domain/calculators/waste-pipe/pipe-runs';
import { EditableTable } from '@/components/sheet/EditableTable';
import { CalcField, SheetCard } from '@/components/sheet/SheetFields';
import { formatNumber } from '@/components/sheet/NumberCell';
import { useJourneyMode } from '@/features/journey/JourneyMode';
import { PipeRunsJourney } from './PipeRunsJourney';

const NO_DEPS = { outputs: () => undefined };

export function PipeRunsSheet({ def, input, onChange, result, subtitle, items, sizes, lines, plain, noun }: {
    def: CalculatorDef<PipeRunsInput>;
    input: PipeRunsInput;
    onChange: (runs: PipeRun[]) => void;
    result: ProjectResult;
    subtitle: string;
    /** Excel dropdown lists of B (รายการ) and C (ขนาดท่อ/ชนิด). */
    items: readonly string[];
    sizes: readonly string[];
    lines: readonly PipeBoqLine[];
    /** Guided journey: plain names of the B options, and what the pipes are (e.g. "ท่อน้ำทิ้ง"). */
    plain: Record<string, PipePlainLabel>;
    noun: string;
}) {
    const inJourney = useJourneyMode();
    if (inJourney) {
        return <PipeRunsJourney def={def} input={input} onChange={onChange} result={result} items={items}
            sizes={sizes} lines={lines} plain={plain} noun={noun} />;
    }
    const sectionNo = def.sections[0] ?? 0;
    const out = def.compute(input, NO_DEPS);
    const boqDesc = (line: PipeBoqLine) => {
        const row = result.boq.sections.find(s => s.no === sectionNo)?.rows.find(r => r.key === line.line);
        return row?.desc ?? line.size;
    };
    const unlinked = unlinkedRuns(input, lines);
    const mismatches = sizeMismatches(input, lines);
    const positional = lines.map(l => l.size).join(', ');

    return (
        <>
            <SheetCard title={subtitle}>
                <EditableTable<PipeRun>
                    rows={input.runs}
                    onChange={onChange}
                    lockedRows={lines.length}
                    newRow={() => ({ label: '', size: '', horizontal: 0, vertical: 0 })}
                    addLabel="+ เพิ่มรายการ"
                    columns={[
                        { kind: 'select', key: 'label', title: 'รายการ', width: 260,
                            options: items.map(v => ({ value: v })),
                            get: r => r.label,
                            // The item name ends with its pipe size: pick that size too (it can still be changed).
                            set: (r, v) => ({ ...r, label: v, size: sizeFromLabel(v, sizes) || r.size }) },
                        { kind: 'select', key: 'size', title: 'ขนาดท่อ/ชนิด', width: 120,
                            options: sizes.map(v => ({ value: v })),
                            get: r => r.size.trim(), set: (r, v) => ({ ...r, size: v }) },
                        { kind: 'number', key: 'horizontal', title: 'ยาว แนวราบ (ม.)', width: 110,
                            get: r => r.horizontal, set: (r, v) => ({ ...r, horizontal: v }) },
                        { kind: 'number', key: 'vertical', title: 'ยาว แนวดิ่ง (ม.)', width: 110,
                            get: r => r.vertical, set: (r, v) => ({ ...r, vertical: v }) },
                        { kind: 'calc', key: 'length', title: 'ยาว รวม (ม.)', width: 110, get: r => runLength(r) },
                    ]}
                />
                <ul className="mt-3 list-disc pl-5 text-[12px] text-gray-500 space-y-0.5">
                    <li>ยาว รวม = ยาว แนวราบ + ยาว แนวดิ่ง</li>
                    <li>
                        แถว 1–{lines.length} ส่งเข้า BOQ หมวด {sectionNo} ตามลำดับแถวเหมือน Excel ({positional});
                        แถวที่เพิ่มเองจะรวมเข้าแถว BOQ ที่มีขนาดท่อเดียวกัน
                    </li>
                    <li>ใน BOQ คิดเผื่อ 15 %, ค่าแรงคิดจากปริมาณเผื่อแล้ว และวัสดุอุปกรณ์สิ้นเปลือง 50 % ของค่าวัสดุและค่าแรง</li>
                </ul>
                {(unlinked.length > 0 || mismatches.length > 0) && (
                    <ul className="mt-2 list-disc pl-5 text-[12px] text-orange-600 space-y-0.5">
                        {unlinked.map(u => (
                            <li key={`u${u.index}`}>
                                แถว {u.index + 1} ({u.size || 'ไม่ระบุขนาดท่อ'}) ยาว {formatNumber(u.length)} ม.
                                — ไม่มีแถวขนาดนี้ใน BOQ จึงไม่ถูกนำไปคิดราคา
                            </li>
                        ))}
                        {mismatches.map(m => (
                            <li key={`m${m.index}`}>
                                แถว {m.index + 1} เลือก {m.size} แต่ส่งเข้า BOQ แถว &quot;{boqDesc(m.line)}&quot;
                                ซึ่งตั้งราคาไว้สำหรับ {m.line.size} — ตรวจราคา/หน่วยในหน้า BOQ
                            </li>
                        ))}
                    </ul>
                )}
            </SheetCard>

            <SheetCard title={`สรุปความยาวท่อ (ส่งเข้า BOQ หมวด ${sectionNo})`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {lines.map(l => (
                        <CalcField key={l.line} label={boqDesc(l)} value={out[l.line]} unit="ม." strong />
                    ))}
                    <CalcField label="ยาว รวมทุกแถว" value={out.total} unit="ม." />
                    {(out.unlinked ?? 0) !== 0 && <CalcField label="ไม่มีแถวใน BOQ" value={out.unlinked} unit="ม." />}
                </div>
            </SheetCard>
        </>
    );
}
