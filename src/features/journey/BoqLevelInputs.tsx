'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { calculatorInput, computeProject } from '@/domain/project';
import type { BoqItemRow } from '@/domain/boq/types';
import { column } from '@/domain/calculators/column';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { AdvancedSection } from '@/components/sheet/AdvancedSection';
import { FromLevel, ResultSummary } from '@/components/sheet/journey';

const cell = 'border border-gray-200 px-2 py-1 text-[13px]';
const num = `${cell} text-right tabular-nums whitespace-nowrap`;

/** Section of the column plates (one plate per column that carries the roof frame). */
const PLATES_SECTION = 14;

/** Columns counted on the column level (for the column-plate hint). */
function useColumnCount(): number {
    const project = useProjectStore(s => s.project);
    return calculatorInput(project, column).columns.reduce((s, r) => s + (Number.isFinite(r.count) ? r.count : 0), 0);
}

/**
 * For levels with no calculator sheet: the BOQ rows of the level's sections. The quantity is typed from the plan;
 * the unit prices are standard values, folded away.
 */
export function BoqLevelInputs({ sections }: { sections: number[] }) {
    const project = useProjectStore(s => s.project);
    const setOverride = useProjectStore(s => s.setBoqOverride);
    const result = useMemo(() => computeProject(project), [project]);
    const columns = useColumnCount();
    const rows = result.boq.sections
        .filter(s => sections.includes(s.no))
        .flatMap(s => s.rows.filter((r): r is BoqItemRow => r.type === 'item'));
    const total = rows.reduce((s, r) => s + r.total, 0);

    return (
        <div className="flex flex-col gap-4">
            {sections.includes(PLATES_SECTION) && columns > 0 && (
                <FromLevel levelId="column">
                    เสาที่กรอกไว้ {formatNumber(columns, 0)} ต้น — ปกติเสาที่รับโครงหลังคามีเพลทหัวเสาต้นละ 1 จุด
                </FromLevel>
            )}

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                <table className="w-full border-collapse min-w-[420px]">
                    <thead>
                        <tr className="bg-gray-50 text-[12px] text-gray-700">
                            <th className={cell}>รายการ</th>
                            <th className={cell} style={{ width: 110 }}>จำนวน</th>
                            <th className={cell} style={{ width: 70 }}>หน่วย</th>
                            <th className={cell} style={{ width: 120 }}>รวม (บาท)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => {
                            const ov = project.boqOverrides[r.key] ?? {};
                            return (
                                <tr key={r.key}>
                                    <td className={cell}>{r.desc}</td>
                                    <td className={num}>
                                        {r.editable.qty
                                            ? <NumberCell value={r.qty} edited={ov.qty !== undefined} digits={r.qty % 1 === 0 ? 0 : 2} blankZero
                                                onCommit={v => setOverride(r.key, 'qty', v)} ariaLabel={`${r.desc} จำนวน`} />
                                            : formatNumber(r.qty, r.qty % 1 === 0 ? 0 : 2)}
                                    </td>
                                    <td className={`${cell} text-center`}>{r.unit}</td>
                                    <td className={num} style={{ background: SHEET_COLORS.calc }}>{r.total === 0 ? '' : formatNumber(r.total)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <AdvancedSection>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[480px]">
                        <thead>
                            <tr className="bg-gray-50 text-[12px] text-gray-700">
                                <th className={cell}>รายการ</th>
                                <th className={cell} style={{ width: 130 }}>ค่าวัสดุต่อหน่วย (บาท)</th>
                                <th className={cell} style={{ width: 130 }}>ค่าแรงต่อหน่วย (บาท)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => {
                                const ov = project.boqOverrides[r.key] ?? {};
                                return (
                                    <tr key={r.key}>
                                        <td className={cell}>{r.desc} <span className="text-gray-500">/ {r.unit}</span></td>
                                        <td className={num}>
                                            <NumberCell value={r.matUnit} edited={ov.mat !== undefined}
                                                onCommit={v => setOverride(r.key, 'mat', v)} ariaLabel={`${r.desc} ค่าวัสดุ`} />
                                        </td>
                                        <td className={num}>
                                            <NumberCell value={r.labUnit} edited={ov.lab !== undefined}
                                                onCommit={v => setOverride(r.key, 'lab', v)} ariaLabel={`${r.desc} ค่าแรง`} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </AdvancedSection>

            <ResultSummary
                items={total > 0 ? [{ label: 'รวมด่านนี้', value: total, unit: 'บาท', digits: 0 }] : []}
                empty="ใส่จำนวนจากแบบ ระบบจะคิดค่าวัสดุและค่าแรงให้" />
        </div>
    );
}
