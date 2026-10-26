'use client';

// ─── ทีมงาน (W1, docs/workforce/00-crew-management-design.md §3.2): crews on the project's 32 planned tasks ───
// The fourth planning step of a company (cloud) project while the workforce module is on: the site supervisors on
// top, then every planned task by งวด with its planned days, the crew Man-Day asks for, its trade and the crews
// assigned. Owners, admins and estimators assign; viewers read. Guest projects and module-off projects get a short
// explanation instead. Nothing here changes a planning number.
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Button, Spin, Typography } from 'antd';
import type { CrewAssignmentDto } from '@/shared/contract';
import { MODULE_LABEL } from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { useCrewAssignments, useCrews, workforceAbilities } from '@/features/cloud/api/workforce';
import { NoBoqYet, PlanningSteps, usePlanning } from '@/features/planning/shared/planning-ui';
import { AssignCrewModal } from './AssignCrewModal';
import {
    UNKNOWN_CREW_NAME, WORKSPACE_CREWS_HREF, useOpenCloudProject, useProjectWorkforceState, type OpenCloudProject,
} from './project-workforce';
import { SupervisorsCard } from './SupervisorsCard';
import { TeamTable } from './TeamTable';
import { buildTeamRows, teamSummary, teamSummaryText, type TeamTaskRow } from './team-model';

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
    const [editing, setEditing] = useState<Editing | null>(null);

    const groups = useMemo(
        () => buildTeamRows(planning.schedule, planning.manday, assignments.data ?? []),
        [planning.schedule, planning.manday, assignments.data],
    );
    const summary = teamSummary(groups);
    const names = useMemo(() => new Map((crews.data ?? []).map(c => [c.id, c.name])), [crews.data]);
    const crewName = (id: string) => names.get(id) ?? UNKNOWN_CREW_NAME;
    const noCrews = crews.data?.every(c => c.archivedAt !== null) === true;
    const loading = assignments.isLoading || crews.isLoading;
    const error = assignments.error ?? crews.error;

    return (
        <div className="flex flex-col gap-4 min-w-0">
            <Header>{loading ? null : teamSummaryText(summary)}</Header>
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
                    {loading
                        ? <div className="flex justify-center py-10"><Spin /></div>
                        : (
                            <TeamTable groups={groups} crewName={crewName} canAssign={abilities.assign}
                                onAdd={task => setEditing({ task, assignment: undefined })}
                                onEdit={(task, assignment) => setEditing({ task, assignment })} />
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
        </div>
    );
}
