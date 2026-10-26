'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/project-store';
import { computeProject } from '@/domain/project';
import type { BoqItemRow } from '@/domain/boq/types';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const cell = 'border border-gray-200 px-2 py-1 text-[13px]';
const num = `${cell} text-right tabular-nums whitespace-nowrap`;

/** For levels with no calculator sheet: the BOQ rows of the level's sections, quantity and prices typed directly. */
export function BoqLevelInputs({ sections }: { sections: number[] }) {
    const project = useProjectStore(s => s.project);
    const setOverride = useProjectStore(s => s.setBoqOverride);
    const result = useMemo(() => computeProject(project), [project]);
    const rows = result.boq.sections
        .filter(s => sections.includes(s.no))
        .flatMap(s => s.rows.filter((r): r is BoqItemRow => r.type === 'item'));

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
                <thead>
                    <tr className="bg-gray-50 text-[12px] text-gray-700">
                        <th className={cell}>รายการ</th>
                        <th className={cell} style={{ width: 110 }}>จำนวน</th>
                        <th className={cell} style={{ width: 70 }}>หน่วย</th>
                        <th className={cell} style={{ width: 110 }}>ค่าวัสดุ/หน่วย</th>
                        <th className={cell} style={{ width: 110 }}>ค่าแรง/หน่วย</th>
                        <th className={cell} style={{ width: 120 }}>รวม</th>
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
                                        ? <NumberCell value={r.qty} edited={ov.qty !== undefined} digits={r.qty % 1 === 0 ? 0 : 2}
                                            onCommit={v => setOverride(r.key, 'qty', v)} ariaLabel={`${r.desc} จำนวน`} />
                                        : formatNumber(r.qty)}
                                </td>
                                <td className={`${cell} text-center`}>{r.unit}</td>
                                <td className={num}>
                                    <NumberCell value={r.matUnit} edited={ov.mat !== undefined}
                                        onCommit={v => setOverride(r.key, 'mat', v)} ariaLabel={`${r.desc} ค่าวัสดุ`} />
                                </td>
                                <td className={num}>
                                    <NumberCell value={r.labUnit} edited={ov.lab !== undefined}
                                        onCommit={v => setOverride(r.key, 'lab', v)} ariaLabel={`${r.desc} ค่าแรง`} />
                                </td>
                                <td className={num} style={{ background: SHEET_COLORS.calc }}>{formatNumber(r.total)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
