'use client';

// ─── /workspace/board: กระดานจัดคน — every crew of the workspace across every project, day by day (W2) ───
// docs/workforce/00-crew-management-design.md §3.3, §4 (detection only) and §5. Signed-in only, module on (same states
// as ทีมช่างและบุคลากร). The board is computed by src/domain/workforce/board.ts from the crews, the assignments around
// the window and each project's waits (a missing task-lags endpoint means defaults only).
// W3 (§4 step 2): คำแนะนำ below the board (SuggestionsPanel), the live before/after of a bar being moved (BarPanel),
// and มูลค่าวันว่าง in the summary when wages are visible.
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Result, Segmented, Select, Spin, Switch, Tooltip, Typography } from 'antd';
import { InfoCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    MAX_TASK_LAG_DAYS, WORKFORCE_TRADE_LABEL, type CrewAssignmentDto, type CrewAssignmentQuery, type TaskLag, type WorkspaceDto,
} from '@/shared/contract';
import {
    BOARD_PRESET_LABEL, boardDays, boardQueryRange, boardTotals, buildCrewBoard, presetWindow, stepWindow,
    type BoardPreset, type BoardWindow,
} from '@/domain/workforce/board';
import { scenarioMetrics } from '@/domain/workforce/scenario';
import { isApiError } from '@/features/cloud/api/errors';
import {
    assignmentsKey, useCrews, usePeople, usePlatformModules, useWorkspaceTaskLags, workforceAbilities, workforceApi,
} from '@/features/cloud/api/workforce';
import { useCurrentWorkspace, useProjects } from '@/features/cloud/query/hooks';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { ModuleOff } from '../crews/CrewsPage';
import { isoDay } from '../crews/logic';
import { BarPanel } from './BarPanel';
import { CrewTimeline } from './CrewTimeline';
import { SuggestionsPanel } from './SuggestionsPanel';
import { idleValueCell } from './suggest-view';
import {
    barDomId, boardCrews, conflictText, filterRows, percent, projectColours, projectsInRows, windowLabel,
    type BoardNames, type RowFilter,
} from './view';

const { Title, Text } = Typography;

export const BOARD_TITLE = 'กระดานจัดคน';
const PRESETS: BoardPreset[] = ['2w', '1m', '3m'];
const NO_LAGS: readonly TaskLag[] = [];

export function BoardPage() {
    return (
        <RequireSignIn next="/workspace/board" title={BOARD_TITLE}>
            <ModuleGate />
        </RequireSignIn>
    );
}

function ModuleGate() {
    const modules = usePlatformModules();
    if (modules.isLoading) return spinner;
    if (modules.data?.includes('workforce') !== true) return <ModuleOff />;
    return <BoardContent />;
}

function BoardContent() {
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    if (isLoading) return spinner;
    if (workspace === undefined) return <Result status="info" title="ยังไม่มีพื้นที่ทำงาน" />;
    return <WorkspaceBoard key={workspace.id} workspace={workspace} workspaces={workspaces} onSelect={select} />;
}

/** The assignments that feed the window; the previous window's stay on screen while the next one loads. */
function useBoardAssignments(workspaceId: string, q: CrewAssignmentQuery) {
    return useQuery({
        queryKey: assignmentsKey(workspaceId, q),
        queryFn: () => workforceApi.listAssignments(workspaceId, q),
        placeholderData: keepPreviousData,
    });
}

function WorkspaceBoard({ workspace, workspaces, onSelect }: {
    workspace: WorkspaceDto; workspaces: WorkspaceDto[]; onSelect: (id: string) => void;
}) {
    const abilities = workforceAbilities(workspace.role);
    const [today] = useState(() => isoDay(new Date()));
    const [preset, setPreset] = useState<BoardPreset>('1m');
    const [win, setWin] = useState<BoardWindow>(() => presetWindow('1m', today));
    const [filter, setFilter] = useState<RowFilter>({ trade: undefined, projectId: undefined, problemsOnly: false });
    const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

    const crews = useCrews(workspace.id);
    const people = usePeople(workspace.id);
    const projects = useProjects(workspace.id);
    const lags = useWorkspaceTaskLags(workspace.id);
    const range = boardQueryRange(win, today, MAX_TASK_LAG_DAYS);
    // Open-ended forward (no `to`): the before/after (W3) needs every later task of a project for its finish and its
    // knock-ons; the board itself only draws the window.
    const query = useMemo((): CrewAssignmentQuery => ({ from: range.from }), [range.from]);
    const assignments = useBoardAssignments(workspace.id, query);

    const names = useMemo((): BoardNames => {
        const project = new Map((projects.data ?? []).map(p => [p.id, p.name]));
        const crew = new Map((crews.data ?? []).map(c => [c.id, c.name]));
        return { project: id => project.get(id) ?? 'โครงการอื่น', crew: id => crew.get(id) ?? 'ทีม' };
    }, [projects.data, crews.data]);
    const peopleById = useMemo(() => new Map((people.data ?? []).map(p => [p.id, p])), [people.data]);
    // A 404 (endpoint not there yet) or any failure: every project uses the default waits.
    const lagsByProject = useMemo(
        () => new Map((lags.data ?? []).map(p => [p.projectId, p.lags] as const)),
        [lags.data],
    );

    const all = assignments.data;
    const board = useMemo(() => {
        const list = all ?? [];
        return buildCrewBoard(boardCrews(crews.data ?? [], list, win), list, lagsByProject, win, today);
    }, [all, crews.data, win, lagsByProject, today]);
    const days = useMemo(() => boardDays(win), [win]);
    const rows = useMemo(() => filterRows(board.rows, filter, today), [board.rows, filter, today]);
    const totals = boardTotals(rows);
    // มูลค่าวันว่าง of the shown crews (the same rows as the other numbers of the summary).
    const idleValue = useMemo(() => {
        const shownCrews = rows.map(r => r.crew);
        return idleValueCell(scenarioMetrics(shownCrews, all ?? [], lagsByProject, win, today), shownCrews);
    }, [rows, all, lagsByProject, win, today]);
    const conflicts = useMemo(
        () => rows.flatMap(r => r.conflicts).sort((x, y) => (x.from < y.from ? -1 : x.from > y.from ? 1 : 0)),
        [rows],
    );
    const shownProjects = useMemo(() => projectsInRows(board.rows), [board.rows]);
    const colours = useMemo(() => projectColours(shownProjects, names.project), [shownProjects, names]);
    const tradesOnBoard = useMemo(() => [...new Set(board.rows.map(r => r.crew.trade))], [board.rows]);

    const open = useCallback((id: string) => { setSelectedId(id); }, []);
    const openAndScroll = (id: string) => {
        setSelectedId(id);
        document.getElementById(barDomId(id))?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    };

    const selected: CrewAssignmentDto | undefined = selectedId === undefined ? undefined : all?.find(a => a.id === selectedId);
    const selectedConflicts = selected === undefined ? []
        : board.rows.find(r => r.crew.id === selected.crewId)?.conflicts.filter(c => c.a.id === selected.id || c.b.id === selected.id) ?? [];

    const disabled = [crews.error, assignments.error].some(e => isApiError(e) && e.code === 'module_disabled');
    if (disabled) return <ModuleOff />;

    const wsName = workspace.kind === 'personal' ? 'พื้นที่ส่วนตัว' : workspace.name;
    const lagsFailed = lags.isError && !(isApiError(lags.error) && lags.error.status === 404);
    const loading = crews.isLoading || (assignments.isLoading && all === undefined);
    const noCrews = !crews.isLoading && (crews.data ?? []).filter(c => c.archivedAt === null).length === 0;

    const setPresetTo = (p: BoardPreset) => {
        setPreset(p);
        // Keep looking at the same days: the new window holds today when today is in view, else the old first day.
        setWin(presetWindow(p, win.from <= today && today <= win.to ? today : win.from));
    };

    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full min-w-0">
            <div className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Title level={3} style={{ margin: 0 }}>{BOARD_TITLE}</Title>
                    <Text type="secondary" className="text-[13px] block truncate" title={wsName}>
                        {wsName} · ทุกทีม ทุกโครงการ{!abilities.assign && ' · ดูได้อย่างเดียว'}
                    </Text>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link href="/workspace/crews"><Button>ทีมช่างและบุคลากร</Button></Link>
                    {workspaces.length > 1 && (
                        <Select value={workspace.id} onChange={onSelect} aria-label="พื้นที่ทำงาน" className="w-full md:!w-[240px]"
                            options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? 'ส่วนตัว' : w.name }))} />
                    )}
                </div>
            </div>

            {noCrews ? (
                <div className="bg-white border border-gray-200 rounded-card shadow-card">
                    <Result status="info" title="ยังไม่มีทีมช่าง" subTitle="เพิ่มทีมแรกก่อน แล้วจัดทีมเข้างานในแท็บ ทีมงาน ของแต่ละโครงการ"
                        extra={<Link href="/workspace/crews"><Button type="primary">ไปที่ทีมช่างและบุคลากร</Button></Link>} />
                </div>
            ) : (
                <>
                    <Summary totals={totals} idleValue={idleValue} />

                    <div className="bg-white border border-gray-200 rounded-card shadow-card min-w-0">
                        <div className="flex flex-col gap-3 p-4 md:px-5 md:pt-5 md:pb-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Segmented<BoardPreset> value={preset} onChange={setPresetTo}
                                    options={PRESETS.map(p => ({ value: p, label: BOARD_PRESET_LABEL[p] }))} />
                                <div className="flex items-center gap-1">
                                    <Button aria-label="ก่อนหน้า" icon={<LeftOutlined />} onClick={() => setWin(stepWindow(preset, win, -1))} />
                                    <Button onClick={() => setWin(presetWindow(preset, today))}>วันนี้</Button>
                                    <Button aria-label="ถัดไป" icon={<RightOutlined />} onClick={() => setWin(stepWindow(preset, win, 1))} />
                                </div>
                                <span className="text-[14px] font-medium text-gray-900 tabular-nums">{windowLabel(win)}</span>
                                {assignments.isPlaceholderData && <Spin size="small" />}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Select<string> allowClear placeholder="ทุกสายงาน" aria-label="สายงาน" className="w-full sm:!w-[200px]"
                                    value={filter.trade} onChange={v => setFilter(f => ({ ...f, trade: tradesOnBoard.find(t => t === v) }))}
                                    options={tradesOnBoard.map(t => ({ value: t, label: WORKFORCE_TRADE_LABEL[t] }))} />
                                <Select<string> allowClear placeholder="ทุกโครงการ" aria-label="โครงการ" className="w-full sm:!w-[260px]"
                                    value={filter.projectId} onChange={v => setFilter(f => ({ ...f, projectId: v }))}
                                    showSearch={{ optionFilterProp: 'label' }}
                                    options={shownProjects.map(id => ({ value: id, label: names.project(id) }))} />
                                <label className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer sm:ml-1">
                                    <Switch size="small" checked={filter.problemsOnly} onChange={v => setFilter(f => ({ ...f, problemsOnly: v }))} />
                                    แสดงเฉพาะที่มีปัญหา
                                </label>
                            </div>
                            <Legend projects={shownProjects} colours={colours} names={names} />
                            {lagsFailed && <div className="text-[12px] text-gray-500">อ่านช่วงรอที่โครงการตั้งไว้ไม่ได้ ใช้ค่าตั้งต้นแทน</div>}
                        </div>

                        <div className="border-t border-gray-200 overflow-auto max-h-[70vh] overscroll-x-contain rounded-b-card">
                            {loading ? spinner : rows.length === 0 ? (
                                <div className="p-10 text-center text-[13px] text-gray-500">
                                    {filter.problemsOnly ? 'ไม่มีทีมที่มีปัญหาในช่วงนี้' : 'ไม่มีทีมตามที่เลือก'}
                                </div>
                            ) : (
                                <CrewTimeline key={`${preset}:${win.from}`} rows={rows} window={win} days={days} preset={preset} today={today} colours={colours}
                                    names={names} peopleById={peopleById} selectedId={selectedId} focusProjectId={filter.projectId}
                                    onOpen={open} />
                            )}
                        </div>
                    </div>

                    {conflicts.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card min-w-0">
                            <div className="text-[16px] font-semibold text-gray-900 mb-3">จุดชน <span className="text-red-600 tabular-nums">{conflicts.length}</span></div>
                            <ul className="flex flex-col divide-y divide-gray-100">
                                {conflicts.map(c => (
                                    <li key={`${c.a.id}:${c.b.id}`} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                                        <span className="flex-1 min-w-0 text-[14px] text-gray-800">
                                            <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-red-600 mr-2 align-middle" />
                                            {conflictText(c, names)}
                                        </span>
                                        <Button size="small" onClick={() => openAndScroll(c.a.id)} className="self-start sm:self-auto">ดูบนกระดาน</Button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <SuggestionsPanel workspaceId={workspace.id} crews={crews.data ?? []} assignments={all}
                        ready={all !== undefined && !assignments.isPlaceholderData && crews.data !== undefined && !lags.isLoading && !projects.isLoading}
                        lagsByProject={lagsByProject} window={win} today={today} names={names} canAct={abilities.assign} />
                </>
            )}

            {selected !== undefined && (
                <BarPanel workspaceId={workspace.id} assignment={selected} conflicts={selectedConflicts}
                    lags={lagsByProject.get(selected.projectId) ?? NO_LAGS} crews={crews.data ?? []} names={names}
                    assignments={all ?? []} lagsByProject={lagsByProject} boardWindow={win} today={today}
                    colour={colours.get(selected.projectId) ?? { fill: '#E5E7EB', accent: '#6B7280', text: '#111827' }}
                    canAssign={abilities.assign} onOpen={openAndScroll} onClose={() => setSelectedId(undefined)} />
            )}
        </div>
    );
}

const IDLE_VALUE_HINT = 'คิดจากค่าแรงต่อวันของทีม × วันว่าง (กรณีจ่ายทีมทุกวัน)';

function Summary({ totals, idleValue }: { totals: ReturnType<typeof boardTotals>; idleValue: ReturnType<typeof idleValueCell> }) {
    const cells: { label: string; value: string; note: string; tone?: string; hint?: string }[] = [
        { label: 'อัตราการใช้ทีมเฉลี่ย', value: percent(totals.averageUtilisation), note: `${String(totals.crews)} ทีม ในช่วงที่แสดง` },
        {
            label: 'จุดชน', value: String(totals.conflicts),
            note: totals.conflicts > 0 ? 'ทีมเดียวกันถูกจัดซ้อนวัน' : 'ไม่มีทีมที่ถูกจัดซ้อนวัน',
            tone: totals.conflicts > 0 ? 'text-red-600' : undefined,
        },
        {
            label: 'วันว่างรวม', value: `${String(totals.idleCrewDays)} วัน`,
            note: totals.waitCrewDays > 0 ? `รวมช่วงรอ ${String(totals.waitCrewDays)} วัน` : 'ทุกทีมรวมกัน',
        },
        { label: 'ทีมที่ว่างวันนี้', value: String(totals.crewsIdleToday), note: `จาก ${String(totals.crews)} ทีม` },
    ];
    // Shown only when some crew's ฿/day is visible to this role (never ฿0 for an unknown cost).
    if (idleValue !== null) {
        cells.push({
            label: 'มูลค่าวันว่าง', value: idleValue.value, hint: IDLE_VALUE_HINT,
            note: idleValue.partial ? 'บางทีมไม่มีค่าแรง' : 'กรณีจ่ายทีมทุกวัน',
        });
    }
    const five = cells.length === 5;
    // 1px gaps over a grey ground draw the dividers, whatever the number of cells per row.
    return (
        <div className={`bg-gray-100 border border-gray-200 rounded-card shadow-card overflow-hidden grid gap-px grid-cols-2 ${five ? 'lg:grid-cols-5' : 'md:grid-cols-4'}`}>
            {cells.map((c, i) => (
                <div key={c.label} className={`bg-white p-4 md:p-5 min-w-0 ${five && i === 4 ? 'col-span-2 lg:col-span-1' : ''}`}>
                    <div className="text-[13px] text-gray-600 truncate">
                        {c.hint === undefined ? c.label : (
                            <Tooltip title={c.hint}>
                                <span className="cursor-help">{c.label} <InfoCircleOutlined className="text-[12px] text-gray-400" aria-label={c.hint} /></span>
                            </Tooltip>
                        )}
                    </div>
                    <div className={`text-[28px] leading-[1.25] font-semibold tabular-nums truncate ${c.tone ?? 'text-gray-900'}`} title={c.value}>{c.value}</div>
                    <div className="text-[12px] text-gray-500 truncate">{c.note}</div>
                </div>
            ))}
        </div>
    );
}

function Legend({ projects, colours, names }: {
    projects: readonly string[]; colours: ReadonlyMap<string, { fill: string; accent: string }>; names: BoardNames;
}) {
    const sorted = [...projects].sort((a, b) => names.project(a).localeCompare(names.project(b), 'th'));
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-gray-600">
            {sorted.map(id => {
                const c = colours.get(id);
                return (
                    <span key={id} className="flex items-center gap-1.5 min-w-0 max-w-full">
                        <span aria-hidden className="shrink-0 w-3 h-3 rounded-[3px]"
                            style={{ background: c?.fill, borderLeft: `3px solid ${c?.accent ?? '#6B7280'}` }} />
                        <span className="truncate max-w-[260px]" title={names.project(id)}>{names.project(id)}</span>
                    </span>
                );
            })}
            <span className="flex items-center gap-1.5">
                <span aria-hidden className="w-5 h-3 rounded-[3px] border border-dashed border-gray-400"
                    style={{ backgroundImage: 'repeating-linear-gradient(135deg, #9CA3AF55 0 2px, transparent 2px 5px)' }} />
                ช่วงรอ (ทีมว่าง)
            </span>
            <span className="flex items-center gap-1.5">
                <span aria-hidden className="w-5 h-3 rounded-[3px] bg-red-50" style={{ boxShadow: 'inset 0 0 0 1.5px #DC2626' }} />
                ชนกัน
            </span>
        </div>
    );
}
