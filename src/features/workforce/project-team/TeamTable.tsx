'use client';

// The 32 planned tasks by งวด (like the Gantt table) with the wait after each and the crews assigned to it.
// Presentational: rows come from buildTeamRows; the page opens the assign / edit / wait forms. A crew chip whose crew
// is booked elsewhere on the same days carries a small red mark (the clashes in its tooltip). Wide on purpose (desktop
// first): on a phone the table scrolls sideways inside its card.
import { Fragment } from 'react';
import { Button, Tooltip } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { EffectiveTaskLag } from '@/domain/workforce';
import { WORKFORCE_TRADE_LABEL } from '@/shared/contract/workforce';
import { cls, formatDate, installmentColors } from '@/features/planning/shared/planning-ui';
import { dayMonthRange, needText, waitCellText, type TeamAssignment, type TeamInstallment, type TeamTaskRow } from './team-model';

export function TeamTable<A extends TeamAssignment>({
    groups, crewName, canAssign, onAdd, onEdit, waitOf, onEditWait, conflictsOf,
}: {
    groups: readonly TeamInstallment<A>[];
    /** The crew's name (a fallback for a crew the workspace no longer lists). */
    crewName: (crewId: string) => string;
    canAssign: boolean;
    onAdd: (task: TeamTaskRow<A>) => void;
    onEdit: (task: TeamTaskRow<A>, assignment: A) => void;
    /** The effective wait after a task; undefined while the waits load (the column stays empty). */
    waitOf: ((taskId: string) => EffectiveTaskLag) | undefined;
    /** Opens the wait editor; undefined = the waits are read-only. */
    onEditWait: ((task: TeamTaskRow<A>) => void) | undefined;
    /** Clash lines of a chip ("ชนกับ …"); empty when the crew is free elsewhere. */
    conflictsOf: (assignment: A) => readonly string[];
}) {
    const cols = canAssign ? 8 : 7;
    return (
        // relative: the sr-only header (absolute) stays inside the scroller instead of widening the page on phones.
        <div className="relative overflow-x-auto">
            <table className="border-collapse w-full" style={{ minWidth: canAssign ? 1160 : 1060 }}>
                <thead>
                    <tr>
                        <th className={cls.th} style={{ width: 52 }}>ลำดับ</th>
                        <th className={cls.th} style={{ minWidth: 170 }}>งาน</th>
                        <th className={cls.th} style={{ width: 150 }}>ช่วงวันตามแผน</th>
                        <th className={cls.th} style={{ width: 180 }}>รอหลังงาน</th>
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
                                    onAdd={() => onAdd(t)} onEdit={a => onEdit(t, a)}
                                    wait={waitOf?.(t.id)} onEditWait={onEditWait === undefined ? undefined : () => onEditWait(t)}
                                    conflictsOf={conflictsOf} />
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TaskRow<A extends TeamAssignment>({ t, crewName, canAssign, onAdd, onEdit, wait, onEditWait, conflictsOf }: {
    t: TeamTaskRow<A>;
    crewName: (crewId: string) => string;
    canAssign: boolean;
    onAdd: () => void;
    onEdit: (a: A) => void;
    wait: EffectiveTaskLag | undefined;
    onEditWait: (() => void) | undefined;
    conflictsOf: (assignment: A) => readonly string[];
}) {
    const { coverage } = t;
    return (
        <tr className="group hover:bg-orange-50/40" data-task={t.id}>
            <td className={`${cls.td} text-center text-gray-500 tabular-nums`}>{t.id}</td>
            <td className={cls.td}>{t.name}</td>
            <td className={`${cls.td} text-center tabular-nums whitespace-nowrap text-gray-700`}>
                {t.start === null || t.finish === null
                    ? <span className="text-gray-400">ยังไม่กำหนดวัน</span>
                    : t.start === t.finish ? formatDate(t.start) : `${formatDate(t.start).slice(0, 5)}–${formatDate(t.finish)}`}
            </td>
            <td className={cls.td} data-wait={t.id}>
                {wait !== undefined && <WaitCell wait={wait} task={t} onEdit={onEditWait} />}
            </td>
            <td className={`${cls.td} text-center tabular-nums whitespace-nowrap text-gray-700`}>{needText(t.skilled, t.labourers)}</td>
            <td className={`${cls.td} text-gray-700`}>{t.trade === undefined ? '' : WORKFORCE_TRADE_LABEL[t.trade]}</td>
            <td className={cls.td}>
                {t.assignments.length > 0 && (
                    <div className="flex flex-wrap gap-1 py-0.5">
                        {t.assignments.map(a => (
                            <CrewChip key={a.id} name={crewName(a.crewId)} range={dayMonthRange(a.start, a.end)} note={a.note}
                                conflicts={conflictsOf(a)} onClick={canAssign ? () => onEdit(a) : undefined} />
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

/** "7 วัน · บ่มคอนกรีตฐานราก" (+ "แก้แล้ว" for a project override); a button for those who may edit. */
function WaitCell({ wait, task, onEdit }: { wait: EffectiveTaskLag; task: { id: string; name: string }; onEdit: (() => void) | undefined }) {
    const text = waitCellText(wait);
    const body = (
        <>
            {text !== '' && <span className="text-gray-700">{text}</span>}
            {wait.overridden && <span className="ml-1.5 whitespace-nowrap rounded border border-gray-200 px-1 text-[11px] text-gray-500">แก้แล้ว</span>}
        </>
    );
    if (onEdit === undefined) return <span className="text-[12px] leading-snug tabular-nums">{body}</span>;
    return (
        <button type="button" onClick={onEdit} aria-label={`แก้ช่วงรอหลังงาน ${task.id} ${task.name}`}
            className="flex w-full items-center gap-1 rounded-control px-1 -mx-1 py-0.5 min-h-6 text-left text-[12px] leading-snug tabular-nums cursor-pointer hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <span className="min-w-0 flex-1">{body}</span>
            <EditOutlined aria-hidden className="shrink-0 text-gray-400 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100" />
        </button>
    );
}

function CrewChip({ name, range, note, conflicts, onClick }: {
    name: string; range: string; note: string | null; conflicts: readonly string[]; onClick: (() => void) | undefined;
}) {
    const clash = conflicts.length > 0;
    const body = (
        <>
            {clash && <span className="h-2 w-2 shrink-0 rounded-full bg-red-600" aria-hidden data-conflict="" />}
            <span className="truncate max-w-[180px] text-gray-900">{name}</span>
            <span className="text-gray-500 tabular-nums whitespace-nowrap">{range}</span>
        </>
    );
    const base = 'inline-flex items-center gap-1.5 rounded-control border border-gray-200 bg-white px-2 h-6 text-[12px] leading-none';
    // A clash shows in an antd tooltip (with the note under it); without one the note stays a plain title.
    const title = clash ? undefined : note ?? undefined;
    const label = `${name} ${range}${clash ? ` · ${conflicts.join(' · ')}` : ''}`;
    const chip = onClick === undefined
        ? <span className={base} title={title} aria-label={clash ? label : undefined}>{body}</span>
        : (
            <button type="button" onClick={onClick} title={title} aria-label={`แก้ไขทีม ${label}`}
                className={`${base} cursor-pointer hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400`}>
                {body}
            </button>
        );
    if (!clash) return chip;
    return (
        <Tooltip title={(
            <div className="flex flex-col gap-0.5 text-[12px]">
                {conflicts.map(l => <span key={l}>{l}</span>)}
                {note !== null && <span className="opacity-75">{note}</span>}
            </div>
        )}>
            {chip}
        </Tooltip>
    );
}
