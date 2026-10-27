'use client';

// ─── ทีมงาน (W1, docs/workforce/00-crew-management-design.md §3.2): crews on the project's 32 planned tasks ───
// The fourth planning step of a company (cloud) project while the workforce module is on: the site supervisors on
// top, then every planned task by งวด with its planned days, the crew Man-Day asks for, its trade and the crews
// assigned. Owners, admins and estimators assign; viewers read. Guest projects and module-off projects get a short
// explanation instead. W2 adds the wait after each task (ช่วงรอหลังงาน, editable by those who assign) and a red mark
// on a crew chip whose crew is booked elsewhere on the same days. Nothing here changes a planning number.
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button, Spin, Typography } from 'antd';
import type { CrewAssignmentDto, TaskLag } from '@/shared/contract';
import { MODULE_LABEL } from '@/shared/contract';
import { effectiveTaskLag, type CrewBusySpan } from '@/domain/workforce';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import {
    useCrewAssignments, useCrews, useProjectTaskLags, workforceAbilities,
} from '@/features/cloud/api/workforce';
import { useProjects } from '@/features/cloud/query/hooks';
import { NoBoqYet, PlanningSteps, usePlanning } from '@/features/planning/shared/planning-ui';
import { AssignCrewModal } from './AssignCrewModal';
import {
    UNKNOWN_CREW_NAME, WORKSPACE_CREWS_HREF, useOpenCloudProject, useProjectWorkforceState, type OpenCloudProject,
} from './project-workforce';
import { SupervisorsCard } from './SupervisorsCard';
import { TeamTable } from './TeamTable';
import { WaitEditModal } from './WaitEditModal';
import {
    buildTeamRows, chipConflicts, conflictLines, conflictSummaryText, otherProjectConflictCount, teamSummary, teamSummaryText,
    type BusyContext, type TeamTaskRow,
} from './team-model';

const NO_OVERRIDES: readonly TaskLag[] = [];
const NO_CLASHES: readonly string[] = [];

const { Title, Text } = Typography;

function Header({ children }: { children?: ReactNode }) {
    return (
        <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card flex flex-col gap-3">
            <PlanningSteps current="/team" />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <div className="min-w-0">
                    <Title level={4} style={{ margin: 0 }}>ทีมงาน</Title>
                    <Text type="secondary" className="text-[12px]">จัดทีมช่างเข้างานตามแผน และระบุผู้คุมงานของโครงการ</Text>
                </div>
                {children !== undefined && <div className="ml-auto text-[13px] text-gray-700 tabular-nums">{children}</div>}
            </div>
        </div>
    );
}

/** Why the page is empty: a guest project, or the module is off. */
function Unavailable({ guest }: { guest: boolean }) {
    return (
        <div className="flex flex-col gap-4">
            <Header />
            <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center">
                <div className="text-[14px] text-gray-700 max-w-xl">
                    {guest
                        ? 'หน้าทีมงานใช้กับโครงการของบริษัท (โครงการบนคลาวด์) ที่เปิดโมดูล "' + MODULE_LABEL.workforce + '"'
                        : 'โมดูล "' + MODULE_LABEL.workforce + '" ยังไม่เปิดใช้ในระบบนี้'}
                </div>
                <div className="text-[12px] text-gray-500 max-w-xl">
                    {guest
                        ? 'โครงการในเครื่องนี้ยังวางแผน Man-Day, S-Curve และ Cash Flow ได้ตามเดิม — เปิดโครงการของบริษัทเพื่อจัดทีมช่าง'
                        : 'ระบบยังทำ BOQ และวางแผนได้ตามเดิม ติดต่อผู้ดูแลระบบเพื่อเปิดโมดูล'}
                </div>
                {guest && (
                    <Link href="/projects"><Button type="primary">ไปที่โครงการทั้งหมด</Button></Link>
                )}
            </div>
        </div>
    );
}

export function ProjectTeamPage() {
    const cloud = useOpenCloudProject();
    const state = useProjectWorkforceState();
    if (cloud === undefined) return <Unavailable guest />;
    if (state === 'loading') return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    if (state === 'off') return <Unavailable guest={false} />;
    return <ProjectTeam cloud={cloud} />;
}

interface Editing { task: TeamTaskRow<CrewAssignmentDto>; assignment: CrewAssignmentDto | undefined }

function ProjectTeam({ cloud }: { cloud: OpenCloudProject }) {
    const { planning, result } = usePlanning();
    const abilities = workforceAbilities(cloud.role);
    const filter = useMemo(() => ({ projectId: cloud.projectId }), [cloud.projectId]);
    const assignments = useCrewAssignments(cloud.workspaceId, filter);
    const crews = useCrews(cloud.workspaceId);
    /** Every assignment of the workspace (shared with the assign form's availability): clashes with other projects. */
    const workspaceAssignments = useCrewAssignments(cloud.workspaceId);
    const projects = useProjects(cloud.workspaceId);
    const lags = useProjectTaskLags(cloud.projectId);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [waitTask, setWaitTask] = useState<TeamTaskRow<CrewAssignmentDto> | null>(null);

    const groups = useMemo(
        () => buildTeamRows(planning.schedule, planning.manday, assignments.data ?? []),
        [planning.schedule, planning.manday, assignments.data],
    );
    const summary = teamSummary(groups);
    const names = useMemo(() => new Map((crews.data ?? []).map(c => [c.id, c.name])), [crews.data]);
    const crewName = (id: string) => names.get(id) ?? UNKNOWN_CREW_NAME;
    const noCrews = crews.data?.every(c => c.archivedAt !== null) === true;
    const loading = assignments.isLoading || crews.isLoading;

    // Waits: a server without the task-lags endpoints yet (404) means no overrides, so the defaults show read-only.
    const lagsMissing = isApiError(lags.error) && lags.error.status === 404;
    const overrides = lags.data?.lags ?? NO_OVERRIDES;
    const waitsReady = lags.data !== undefined || lags.isError;
    const canEditWaits = abilities.assign && lags.data !== undefined;
    const error = assignments.error ?? crews.error ?? (lagsMissing ? null : lags.error);

    const ctx: BusyContext = useMemo(() => {
        const projectNames = new Map((projects.data ?? []).map(p => [p.id, p.name]));
        return { projectId: cloud.projectId, projectName: id => projectNames.get(id) };
    }, [projects.data, cloud.projectId]);
    const clashes = useMemo(() => {
        const all = workspaceAssignments.data;
        const out = new Map<string, CrewBusySpan<CrewAssignmentDto>[]>();
        if (all === undefined) return out;
        for (const a of groups.flatMap(g => g.tasks).flatMap(t => t.assignments)) {
            const busy = chipConflicts(a, all);
            if (busy.length > 0) out.set(a.id, busy);
        }
        return out;
    }, [groups, workspaceAssignments.data]);
    const clashLines = useMemo(
        () => new Map([...clashes].map(([id, busy]) => [id, conflictLines(busy, ctx)])),
        [clashes, ctx],
    );
    const conflictText = conflictSummaryText(otherProjectConflictCount(clashes, cloud.projectId));

    return (
        <div className="flex flex-col gap-4 min-w-0">
            <Header>
                {loading ? null : (
                    <>
                        {teamSummaryText(summary)}
                        {conflictText !== '' && <span className="text-red-600"> · {conflictText}</span>}
                    </>
                )}
            </Header>
            <NoBoqYet constructionTotal={result.boq.constructionTotal} />
            <SupervisorsCard cloud={cloud} canEdit={abilities.assign} />

            {error !== null && <Alert type="error" showIcon title={thaiErrorMessage(error)} />}
            {abilities.assign && noCrews && (
                <Alert type="info" showIcon title="ยังไม่มีทีมช่างในบริษัท"
                    description={(
                        <span>
                            เพิ่มทีมก่อนจึงจะจัดเข้างานได้{' '}
                            <Link href={WORKSPACE_CREWS_HREF} className="text-blue-600 hover:underline">ไปที่ทีมช่างและบุคลากร</Link>
                        </span>
                    )} />
            )}

            <div className="bg-white border border-gray-200 rounded-card shadow-card min-w-0">
                <div className="flex items-center gap-2 min-h-[44px] px-4 sm:px-5 py-2 border-b border-gray-100">
                    <span className="font-semibold text-[14px] text-gray-800">ทีมที่จัดเข้างาน</span>
                    {!abilities.assign && <span className="ml-auto text-[12px] text-gray-500">ดูอย่างเดียว</span>}
                </div>
                <div className="p-4 sm:p-5">
                    <div className="text-[12px] text-gray-500 mb-2">ช่วงรอใช้บอกว่าทีมว่างไปช่วยโครงการอื่นได้ ไม่เปลี่ยนวันในแผนงาน</div>
                    {loading
                        ? <div className="flex justify-center py-10"><Spin /></div>
                        : (
                            <TeamTable groups={groups} crewName={crewName} canAssign={abilities.assign}
                                onAdd={task => setEditing({ task, assignment: undefined })}
                                onEdit={(task, assignment) => setEditing({ task, assignment })}
                                waitOf={waitsReady ? taskId => effectiveTaskLag(taskId, overrides) : undefined}
                                onEditWait={canEditWaits ? task => setWaitTask(task) : undefined}
                                conflictsOf={a => clashLines.get(a.id) ?? NO_CLASHES} />
                        )}
                    <div className="text-[12px] text-gray-500 mt-2">
                        ช่วงวันตามแผนมาจากหน้า S-Curve · คนที่ต้องใช้มาจากหน้า Man-Day · ทีมเดียวจัดได้หลายงาน
                        ถ้าวันซ้อนกันระบบจะเตือนก่อนบันทึก
                    </div>
                </div>
            </div>

            {editing !== null && crews.data !== undefined && (
                <AssignCrewModal key={`${editing.task.id}:${editing.assignment?.id ?? 'new'}`} cloud={cloud}
                    task={editing.task} editing={editing.assignment} crews={crews.data} crewName={crewName}
                    onClose={() => setEditing(null)} />
            )}
            {waitTask !== null && (
                <WaitEditModal key={waitTask.id} cloud={cloud} task={waitTask} overrides={overrides}
                    onClose={() => setWaitTask(null)} />
            )}
        </div>
    );
}
