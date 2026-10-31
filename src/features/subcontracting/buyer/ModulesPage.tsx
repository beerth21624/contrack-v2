'use client';

// ─── /workspace/modules: switch business modules on / off, or try them, for the current workspace (owner / admin) ───
// Off never deletes data: the module's pages and buttons disappear and the app is plain BOQ estimation again.
// Legacy modules and ERP modules are two groups; ERP modules the server does not offer are not shown at all, and
// without any the page is exactly the release-1 page (no group headings).
import { Alert, App, Button, Select, Switch, Table, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import {
    MODULE_REGISTRY, moduleOffBlockersSchema, type ModuleId, type WorkspaceModuleDto,
} from '@/shared/contract';
import { isApiError } from '@/features/cloud/api/errors';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { can } from '@/features/cloud/permissions';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { RequireSignIn, spinner } from '@/features/cloud/ui/common';
import { usePutWorkspaceModule, useStartTrial, useWorkspaceModules } from '@/features/modules/modules';
import { useFormat } from '@/i18n/useFormat';
import { Card, PageHead } from './ui';

export function ModulesPage() {
    const t = useTranslations('modules');
    return (
        <RequireSignIn next="/workspace/modules" title={t('page.title')}>
            <ModulesContent />
        </RequireSignIn>
    );
}

function ModulesContent() {
    const t = useTranslations('modules');
    const ta = useTranslations('account');
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    if (isLoading) return spinner;
    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">
            <PageHead title={t('page.title')} sub={t('page.subtitle')}
                extra={workspace && workspaces.length > 1 ? (
                    <Select value={workspace.id} onChange={select} style={{ minWidth: 220 }} aria-label={t('page.workspaceLabel')}
                        options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? ta('personalWorkspace') : w.name }))} />
                ) : undefined} />
            {workspace ? <ModulesTable key={workspace.id} workspaceId={workspace.id} mayManage={can(workspace.role, 'modules.manage')} /> : null}
        </div>
    );
}

function ModulesTable({ workspaceId, mayManage }: { workspaceId: string; mayManage: boolean }) {
    const t = useTranslations('modules');
    const f = useFormat();
    const toText = useErrorMessage();
    const { modal, message } = App.useApp();
    const modules = useWorkspaceModules(workspaceId);
    const put = usePutWorkspaceModule(workspaceId);
    const trial = useStartTrial(workspaceId);
    // ERP modules the server does not offer are not shown at all (release 1 looks exactly as before; D-50).
    const rows = (modules.data ?? []).filter(m => m.available || MODULE_REGISTRY[m.module].kind !== 'erp');
    const legacyRows = rows.filter(m => MODULE_REGISTRY[m.module].kind === 'legacy');
    const erpRows = rows.filter(m => MODULE_REGISTRY[m.module].kind === 'erp');
    const label = (id: ModuleId) => t(`${id}.label`);

    /** Counter names of running work (`ModuleWorkRegistry`) as text; an unknown counter shows its name. */
    const workText = (name: string, count: number): string => {
        const key = `work.${name}` as Parameters<typeof t>[0];
        return t.has(key) ? t(key, { count }) : `${name}: ${String(count)}`;
    };

    const send = async (module: ModuleId, enabled: boolean, confirm?: boolean) => {
        try {
            await put.mutateAsync({ module, body: confirm === true ? { enabled, confirm } : { enabled } });
            void message.success(t(enabled ? 'messages.switchedOn' : 'messages.switchedOff', { module: label(module) }));
        } catch (e) {
            const blockers = isApiError(e) && e.code === 'conflict' ? moduleOffBlockersSchema.safeParse(e.details) : null;
            if (blockers?.success === true && blockers.data.activeSubcontracts !== undefined) {
                modal.confirm({
                    title: t('activeSubcontracts.title', { count: blockers.data.activeSubcontracts }),
                    content: t('activeSubcontracts.content'),
                    okText: t('activeSubcontracts.ok'), okButtonProps: { danger: true }, cancelText: t('confirmOff.cancel'),
                    onOk: () => send(module, false, true),
                });
            } else if (blockers?.success === true) {
                // Modules that depend on this one are switched off with it; running work stays but is out of reach.
                const { dependents, work } = blockers.data;
                const workLines = Object.entries(work).filter(([, n]) => n > 0).map(([name, n]) => workText(name, n));
                modal.confirm({
                    title: t('cascade.title', { module: label(module) }),
                    content: (
                        <div className="flex flex-col gap-2">
                            {dependents.length > 0 && (
                                <div>
                                    <div>{t('cascade.dependents', { module: label(module) })}</div>
                                    <ul className="m-0 pl-5">{dependents.map(d => <li key={d}>{label(d)}</li>)}</ul>
                                </div>
                            )}
                            {workLines.length > 0 && (
                                <div>
                                    <div>{t('cascade.work')}</div>
                                    <ul className="m-0 pl-5">{workLines.map(l => <li key={l}>{l}</li>)}</ul>
                                </div>
                            )}
                        </div>
                    ),
                    okText: t('cascade.ok'), okButtonProps: { danger: true }, cancelText: t('confirmOff.cancel'),
                    onOk: () => send(module, false, true),
                });
            } else void message.error(toText(e));
        }
    };

    const startTrial = async (module: ModuleId) => {
        try {
            const res = await trial.mutateAsync(module);
            const others = res.started.filter(id => id !== module);
            void message.success(others.length > 0
                ? t('messages.trialStartedMore', { module: label(module), others: others.map(label).join(', ') })
                : t('messages.trialStarted', { module: label(module) }));
        } catch (e) { void message.error(toText(e)); }
    };

    const onToggle = (m: WorkspaceModuleDto, enabled: boolean) => {
        if (enabled) { void send(m.module, true); return; }
        modal.confirm({
            title: t('confirmOff.title', { module: label(m.module) }),
            content: t('confirmOff.content'),
            okText: t('confirmOff.ok'), cancelText: t('confirmOff.cancel'),
            onOk: () => send(m.module, false),
        });
    };

    const entitlementTag = (m: WorkspaceModuleDto) => {
        const { status, expiresAt } = m.entitlement;
        const until = expiresAt === null ? '' : f.date(expiresAt);
        switch (status) {
            case 'trial': return <Tag color="blue" className="!m-0">{t('entitlement.trial', { date: until })}</Tag>;
            case 'beta': return <Tag color="purple" className="!m-0">{expiresAt === null ? t('entitlement.beta') : t('entitlement.betaUntil', { date: until })}</Tag>;
            case 'purchased': return <Tag color="green" className="!m-0">{expiresAt === null ? t('entitlement.purchased') : t('entitlement.purchasedUntil', { date: until })}</Tag>;
            case 'none': case 'expired': case 'revoked': return <Tag className="!m-0">{t(`entitlement.${status}`)}</Tag>;
            case 'not_required': return null;
        }
    };

    const columns = [
        {
            title: t('page.columnModule'), key: 'module',
            render: (_: unknown, m: WorkspaceModuleDto) => (
                <div className="min-w-0">
                    <div className={`font-medium ${m.available ? 'text-gray-900' : 'text-gray-400'}`}>{label(m.module)}</div>
                    <div className="text-caption text-gray-500">{t(`${m.module}.hint`)}</div>
                </div>
            ),
        },
        {
            title: t('page.columnState'), key: 'state', width: 240,
            render: (_: unknown, m: WorkspaceModuleDto) => {
                if (!m.available) return <Tag className="!m-0">{t('status.unavailable')}</Tag>;
                const tag = entitlementTag(m);
                return (
                    <div className="flex flex-col gap-1 items-start">
                        {m.enabled
                            ? (
                                <div>
                                    <span className="text-green-600">{t('status.on')}</span>
                                    {m.enabledAt !== null && <div className="text-caption text-gray-500">{t('status.since', { date: f.dateTime(m.enabledAt) })}</div>}
                                </div>
                            )
                            : <span className="text-gray-500">{t('status.off')}</span>}
                        {tag}
                        {m.missingDependencies.length > 0 && (
                            <div className="text-caption text-gray-500">{t('status.missing', { modules: m.missingDependencies.map(label).join(', ') })}</div>
                        )}
                    </div>
                );
            },
        },
        {
            title: '', key: 'switch', width: 190, align: 'right' as const,
            render: (_: unknown, m: WorkspaceModuleDto) => {
                const entitled = m.entitlement.status !== 'none' && m.entitlement.status !== 'expired' && m.entitlement.status !== 'revoked';
                return (
                    <div className="flex items-center justify-end gap-2 flex-wrap">
                        {mayManage && m.available && m.trialAvailable && (
                            <Button size="small" loading={trial.isPending && trial.variables === m.module} onClick={() => void startTrial(m.module)}>
                                {t('actions.startTrial', { days: MODULE_REGISTRY[m.module].trialDays })}
                            </Button>
                        )}
                        <Switch checked={m.enabled} disabled={!mayManage || !m.available || (!m.enabled && !entitled)}
                            loading={put.isPending && put.variables.module === m.module}
                            onChange={(v) => onToggle(m, v)} aria-label={label(m.module)} />
                    </div>
                );
            },
        },
    ];

    const table = (data: WorkspaceModuleDto[], showHeader: boolean) => (
        <Table<WorkspaceModuleDto> rowKey="module" columns={columns} dataSource={data} loading={modules.isLoading}
            pagination={false} size="middle" scroll={{ x: 480 }} showHeader={showHeader}
            locale={{ emptyText: modules.isError ? toText(modules.error) : t('page.empty') }} />
    );

    return (
        <Card>
            {!mayManage && <Alert type="info" showIcon className="!mb-3" title={t('page.mayNotManage')} />}
            {erpRows.length === 0 ? table(rows, true) : (
                <div className="flex flex-col gap-4">
                    <div>
                        <div className="text-section font-semibold text-gray-900 mb-2">{t('groups.legacy')}</div>
                        {table(legacyRows, true)}
                    </div>
                    <div>
                        <div className="text-section font-semibold text-gray-900 mb-2">{t('groups.erp')}</div>
                        {table(erpRows, false)}
                    </div>
                </div>
            )}
        </Card>
    );
}
