'use client';

// ─── /workspace/modules: switch business modules on / off for the current workspace (owner / admin) ───
// Off never deletes data: the module's pages and buttons disappear and the app is plain BOQ estimation again.
import { Alert, App, Select, Switch, Table, Tag } from 'antd';
import {
    MODULE_LABEL, MODULE_REGISTRY, moduleOffBlockersSchema, type ModuleId, type WorkspaceModuleDto,
} from '@/shared/contract';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import { can } from '@/features/cloud/permissions';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { usePutWorkspaceModule, useWorkspaceModules } from '@/features/modules/modules';
import { fmtDateTime } from './format';
import { Card, PageHead } from './ui';

const MODULE_HINT: Partial<Record<ModuleId, string>> = {
    subcontracting: 'ส่งงานจาก BOQ ให้ทีมช่างเสนอราคา เทียบราคา ทำสัญญา และติดตามงวดจ่าย',
    materials: 'ขอราคาวัสดุจากร้านค้า',
    'owner-leads': 'เจ้าของบ้านหาผู้รับเหมา',
    'ai-assist': 'ให้โมเดลตัดสินใจช่วยตรวจ BOQ ก่อนส่งและจับคู่รายการที่พิมพ์เองกับแคตตาล็อก ไม่คำนวณตัวเลขแทน',
    workforce: 'ทีมช่างและบุคลากรของบริษัท จัดทีมเข้างานตามแผน และกระดานจัดคนข้ามโครงการพร้อมคำแนะนำการย้ายทีม',
};

export function ModulesPage() {
    return (
        <RequireSignIn next="/workspace/modules" title="โมดูลเสริม">
            <ModulesContent />
        </RequireSignIn>
    );
}

function ModulesContent() {
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    if (isLoading) return spinner;
    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">
            <PageHead title="โมดูลเสริม" sub="เปิดเฉพาะที่ใช้ ปิดแล้วข้อมูลไม่หาย แค่ซ่อนหน้าจอของโมดูล"
                extra={workspace && workspaces.length > 1 ? (
                    <Select value={workspace.id} onChange={select} style={{ minWidth: 220 }} aria-label="พื้นที่ทำงาน"
                        options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? 'ส่วนตัว' : w.name }))} />
                ) : undefined} />
            {workspace ? <ModulesTable key={workspace.id} workspaceId={workspace.id} mayManage={can(workspace.role, 'modules.manage')} /> : null}
        </div>
    );
}

function ModulesTable({ workspaceId, mayManage }: { workspaceId: string; mayManage: boolean }) {
    const { modal, message } = App.useApp();
    const modules = useWorkspaceModules(workspaceId);
    const put = usePutWorkspaceModule(workspaceId);
    // ERP modules the server does not offer are not shown at all (release 1 looks exactly as before; D-50).
    const rows = (modules.data ?? []).filter(m => m.available || MODULE_REGISTRY[m.module].kind !== 'erp');

    const send = async (module: ModuleId, enabled: boolean, confirm?: boolean) => {
        try {
            await put.mutateAsync({ module, body: confirm === true ? { enabled, confirm } : { enabled } });
            void message.success(`${enabled ? 'เปิด' : 'ปิด'} ${MODULE_LABEL[module]} แล้ว`);
        } catch (e) {
            const blockers = isApiError(e) && e.code === 'conflict' ? moduleOffBlockersSchema.safeParse(e.details) : null;
            if (blockers?.success === true && blockers.data.activeSubcontracts !== undefined) {
                modal.confirm({
                    title: `ยังมีสัญญาที่ดำเนินอยู่ ${String(blockers.data.activeSubcontracts)} สัญญา`,
                    content: 'ถ้าปิดตอนนี้ ทีมเราจะไม่เห็นเมนูจ้างช่วง และทีมช่างจะดูสัญญาได้อย่างเดียว (ขอเบิกหรือแก้ไขไม่ได้) จนกว่าจะเปิดอีกครั้ง ข้อมูลไม่หาย',
                    okText: 'ปิดต่อ', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
                    onOk: () => send(module, false, true),
                });
            } else if (blockers?.success === true) {
                // ERP modules that depend on this one are switched off with it (the full dialog comes with WP-04).
                modal.confirm({
                    title: `ปิด ${MODULE_LABEL[module]}?`,
                    content: blockers.data.dependents.map(d => MODULE_LABEL[d]).join(', '),
                    okText: 'ปิดโมดูล', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
                    onOk: () => send(module, false, true),
                });
            } else void message.error(thaiErrorMessage(e));
        }
    };

    const onToggle = (m: WorkspaceModuleDto, enabled: boolean) => {
        if (enabled) { void send(m.module, true); return; }
        modal.confirm({
            title: `ปิด ${MODULE_LABEL[m.module]}?`,
            content: 'เมนูและปุ่มของโมดูลจะหายไปสำหรับทุกคนในพื้นที่ทำงานนี้ ข้อมูลยังอยู่ เปิดใหม่เมื่อไรก็กลับมาครบ',
            okText: 'ปิดโมดูล', cancelText: 'ยกเลิก',
            onOk: () => send(m.module, false),
        });
    };

    const columns = [
        {
            title: 'โมดูล', key: 'module',
            render: (_: unknown, m: WorkspaceModuleDto) => (
                <div className="min-w-0">
                    <div className={`font-medium ${m.available ? 'text-gray-900' : 'text-gray-400'}`}>{MODULE_LABEL[m.module]}</div>
                    <div className="text-caption text-gray-500">{MODULE_HINT[m.module]}</div>
                </div>
            ),
        },
        {
            title: 'สถานะ', key: 'state', width: 200,
            render: (_: unknown, m: WorkspaceModuleDto) => {
                if (!m.available) return <Tag className="!m-0">ยังไม่เปิดให้บริการ</Tag>;
                if (!m.enabled) return <span className="text-gray-500">ปิดอยู่</span>;
                return (
                    <div>
                        <span className="text-green-600">เปิดใช้งาน</span>
                        {m.enabledAt !== null && <div className="text-caption text-gray-500">ตั้งแต่ {fmtDateTime(m.enabledAt)}</div>}
                    </div>
                );
            },
        },
        {
            title: '', key: 'switch', width: 90, align: 'right' as const,
            render: (_: unknown, m: WorkspaceModuleDto) => (
                <Switch checked={m.enabled} disabled={!mayManage || !m.available}
                    loading={put.isPending && put.variables.module === m.module}
                    onChange={(v) => onToggle(m, v)} aria-label={MODULE_LABEL[m.module]} />
            ),
        },
    ];

    return (
        <Card>
            {!mayManage && <Alert type="info" showIcon className="!mb-3" title="เฉพาะเจ้าของหรือผู้ดูแลพื้นที่ทำงานเปิด-ปิดโมดูลได้" />}
            <Table<WorkspaceModuleDto> rowKey="module" columns={columns} dataSource={rows} loading={modules.isLoading}
                pagination={false} size="middle" scroll={{ x: 480 }}
                locale={{ emptyText: modules.isError ? thaiErrorMessage(modules.error) : 'ไม่มีโมดูล' }} />
        </Card>
    );
}
