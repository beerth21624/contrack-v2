'use client';

// The 32 planned tasks by งวด (like the Gantt table) with the crews assigned to each. Presentational: rows come from
// buildTeamRows; the page opens the assign / edit form. Wide on purpose (desktop first): on a phone the table scrolls
// sideways inside its card.
import { Fragment } from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { WORKFORCE_TRADE_LABEL } from '@/shared/contract/workforce';
import { cls, formatDate, installmentColors } from '@/features/planning/shared/planning-ui';
import { dayMonthRange, needText, type TeamAssignment, type TeamInstallment, type TeamTaskRow } from './team-model';

export function TeamTable<A extends TeamAssignment>({ groups, crewName, canAssign, onAdd, onEdit }: {
    groups: readonly TeamInstallment<A>[];
    /** The crew's name (a fallback for a crew the workspace no longer lists). */
    crewName: (crewId: string) => string;
    canAssign: boolean;
    onAdd: (task: TeamTaskRow<A>) => void;
    onEdit: (task: TeamTaskRow<A>, assignment: A) => void;
}) {
    const cols = canAssign ? 7 : 6;
    return (
        <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: canAssign ? 980 : 880 }}>
                <thead>
                    <tr>
                        <th className={cls.th} style={{ width: 52 }}>ลำดับ</th>
                        <th className={cls.th} style={{ minWidth: 170 }}>งาน</th>
                        <th className={cls.th} style={{ width: 150 }}>ช่วงวันตามแผน</th>
                        <th className={cls.th} style={{ width: 130 }}>คนที่ต้องใช้</th>
                        <th className={cls.th} style={{ width: 150 }}>สายงาน</th>
                        <th className={cls.th} style={{ minWidth: 220 }}>ทีมที่จัด</th>
                        {canAssign && <th className={cls.th} style={{ width: 96 }}><span className="sr-only">จัดทีม</span></th>}
                    </tr>
                </thead>
                <tbody>
                    {groups.map(g => (
                        <Fragment key={g.no}>
                            <tr>
                                <td className={`${cls.td} text-center font-semibold`} style={installmentColors(g.no)}>{g.no}.0</td>
                                <td className={`${cls.td} font-semibold`} colSpan={cols - 1} style={installmentColors(g.no)}>{g.label}</td>
                            </tr>
                            {g.tasks.map(t => (
                                <TaskRow key={t.id} t={t} crewName={crewName} canAssign={canAssign}
                                    onAdd={() => onAdd(t)} onEdit={a => onEdit(t, a)} />
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TaskRow<A extends TeamAssignment>({ t, crewName, canAssign, onAdd, onEdit }: {
    t: TeamTaskRow<A>;
    crewName: (crewId: string) => string;
    canAssign: boolean;
    onAdd: () => void;
    onEdit: (a: A) => void;
}) {
    const { coverage } = t;
    return (
        <tr className="hover:bg-orange-50/40" data-task={t.id}>
            <td className={`${cls.td} text-center text-gray-500 tabular-nums`}>{t.id}</td>
            <td className={cls.td}>{t.name}</td>
            <td className={`${cls.td} text-center tabular-nums whitespace-nowrap text-gray-700`}>
                {t.start === null || t.finish === null
                    ? <span className="text-gray-400">ยังไม่กำหนดวัน</span>
                    : t.start === t.finish ? formatDate(t.start) : `${formatDate(t.start).slice(0, 5)}–${formatDate(t.finish)}`}
            </td>
            <td className={`${cls.td} text-center tabular-nums whitespace-nowrap text-gray-700`}>{needText(t.skilled, t.labourers)}</td>
            <td className={`${cls.td} text-gray-700`}>{t.trade === undefined ? '' : WORKFORCE_TRADE_LABEL[t.trade]}</td>
            <td className={cls.td}>
                {t.assignments.length > 0 && (
                    <div className="flex flex-wrap gap-1 py-0.5">
                        {t.assignments.map(a => (
                            <CrewChip key={a.id} name={crewName(a.crewId)} range={dayMonthRange(a.start, a.end)} note={a.note}
                                onClick={canAssign ? () => onEdit(a) : undefined} />
                        ))}
                    </div>
                )}
                {coverage.status === 'partly' && coverage.plannedDays > 0 && (
                    <div className="text-[12px] text-amber-600 tabular-nums">
                        มีทีม {coverage.coveredDays} จาก {coverage.plannedDays} วันตามแผน
                    </div>
                )}
                {coverage.status === 'none' && !canAssign && <span className="text-[12px] text-gray-400">ยังไม่มีทีม</span>}
            </td>
            {canAssign && (
                <td className={`${cls.td} text-center`}>
                    <Button size="small" type="link" icon={<PlusOutlined />} onClick={onAdd} aria-label={`จัดทีมงาน ${t.id} ${t.name}`}>
                        จัดทีม
                    </Button>
                </td>
            )}
        </tr>
    );
}

function CrewChip({ name, range, note, onClick }: { name: string; range: string; note: string | null; onClick: (() => void) | undefined }) {
    const body = (
        <>
            <span className="truncate max-w-[180px] text-gray-900">{name}</span>
            <span className="text-gray-500 tabular-nums whitespace-nowrap">{range}</span>
        </>
    );
    const base = 'inline-flex items-center gap-1.5 rounded-control border border-gray-200 bg-white px-2 h-6 text-[12px] leading-none';
    const title = note ?? undefined;
    if (onClick === undefined) return <span className={base} title={title}>{body}</span>;
    return (
        <button type="button" onClick={onClick} title={title} aria-label={`แก้ไขทีม ${name} ${range}`}
            className={`${base} cursor-pointer hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400`}>
            {body}
        </button>
    );
}
