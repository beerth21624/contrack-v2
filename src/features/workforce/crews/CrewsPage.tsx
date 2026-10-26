'use client';

// ─── /workspace/crews: ทีมช่างและบุคลากร of the current workspace (W1 of the workforce module) ───
// docs/workforce/00-crew-management-design.md §1, §3.1, §6. Signed-in only; when the platform does not offer the
// module the page says so and the account menu hides its entry. Owners / admins manage; everyone else reads (wages
// arrive hidden from the server for roles that may not see them).
import { useMemo, useState } from 'react';
import { Result, Select, Tabs, Typography } from 'antd';
import type { WorkspaceDto } from '@/shared/contract';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { isApiError } from '@/features/cloud/api/errors';
import { useRateCards } from '@/features/cloud/api/rate-cards';
import {
    useCrewAssignments, useCrews, usePeople, usePlatformModules, workforceAbilities,
} from '@/features/cloud/api/workforce';
import { useCurrentWorkspace, useProjects } from '@/features/cloud/query/hooks';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { CrewsTab } from './CrewsTab';
import { PeopleTab } from './PeopleTab';
import { isoDay, type PlaceNames } from './logic';

const { Title, Text } = Typography;

export const PAGE_TITLE = 'ทีมช่างและบุคลากร';

const TASK_NAME = new Map(PLAN_TASKS.map(t => [t.id, t.name]));

export function CrewsPage() {
    return (
        <RequireSignIn next="/workspace/crews" title={PAGE_TITLE}>
            <ModuleGate />
        </RequireSignIn>
    );
}

export function ModuleOff() {
    return (
        <Result status="info" title="ยังไม่เปิดใช้งาน"
            subTitle="ระบบทีมช่างและการจัดคนยังไม่เปิดให้ใช้ในระบบนี้ ข้อมูลที่เคยบันทึกไว้ยังอยู่ครบ" />
    );
}

function ModuleGate() {
    const modules = usePlatformModules();
    if (modules.isLoading) return spinner;
    if (modules.data?.includes('workforce') !== true) return <ModuleOff />;
    return <CrewsContent />;
}

function CrewsContent() {
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    if (isLoading) return spinner;
    if (workspace === undefined) return <Result status="info" title="ยังไม่มีพื้นที่ทำงาน" />;
    return <WorkspaceCrews key={workspace.id} workspace={workspace} workspaces={workspaces} onSelect={select} />;
}

function WorkspaceCrews({ workspace, workspaces, onSelect }: {
    workspace: WorkspaceDto; workspaces: WorkspaceDto[]; onSelect: (id: string) => void;
}) {
    const abilities = workforceAbilities(workspace.role);
    const [today] = useState(() => isoDay(new Date()));
    const [tab, setTab] = useState<'crews' | 'people'>('crews');
    const crews = useCrews(workspace.id);
    const people = usePeople(workspace.id);
    const rateCards = useRateCards(abilities.manage ? workspace.id : undefined);
    const assignments = useCrewAssignments(workspace.id, { from: today, to: today });
    const projects = useProjects(workspace.id);

    const names = useMemo((): PlaceNames => {
        const projectName = new Map((projects.data ?? []).map(p => [p.id, p.name]));
        return {
            project: id => projectName.get(id) ?? 'โครงการ',
            task: id => TASK_NAME.get(id) ?? `งาน ${id}`,
        };
    }, [projects.data]);

    // The server switched the module off after the page loaded: same message as when it was never on.
    const disabled = [crews.error, people.error].some(e => isApiError(e) && e.code === 'module_disabled');
    if (disabled) return <ModuleOff />;

    const wsName = workspace.kind === 'personal' ? 'พื้นที่ส่วนตัว' : workspace.name;

    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full min-w-0">
            <div className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Title level={3} style={{ margin: 0 }}>{PAGE_TITLE}</Title>
                    <Text type="secondary" className="text-[13px] block truncate" title={wsName}>
                        {wsName}
                        {!abilities.manage && ' · ดูได้อย่างเดียว เจ้าของหรือผู้ดูแลเป็นผู้จัดการทีม'}
                    </Text>
                </div>
                {workspaces.length > 1 && (
                    <Select value={workspace.id} onChange={onSelect} aria-label="พื้นที่ทำงาน" className="w-full md:!w-[240px]"
                        options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? 'ส่วนตัว' : w.name }))} />
                )}
            </div>

            <Tabs activeKey={tab} onChange={k => setTab(k === 'people' ? 'people' : 'crews')} className="min-w-0"
                items={[
                    {
                        key: 'crews', label: 'ทีมช่าง',
                        children: (
                            <CrewsTab workspaceId={workspace.id} canManage={abilities.manage} seeCost={abilities.seeCrewCost}
                                crews={crews} people={people.data ?? []} rateCards={rateCards.data ?? []}
                                assignments={assignments.isError ? undefined : assignments.data} today={today} names={names} />
                        ),
                    },
                    {
                        key: 'people', label: 'บุคลากร',
                        children: (
                            <PeopleTab workspaceId={workspace.id} canManage={abilities.manage} seeWages={abilities.seeWages}
                                people={people} crews={crews.data ?? []} />
                        ),
                    },
                ]} />
        </div>
    );
}
