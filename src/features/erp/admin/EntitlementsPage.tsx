'use client';

// ─── Platform admin: find a workspace and set the right to use each ERP module (layer 2 of the module flags) ───
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { App, Button, DatePicker, Form, Input, Modal, Result, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import {
    type AdminEntitlementDto, type AdminWorkspaceDto, ENTITLEMENT_GRANT_STATUSES, type EntitlementGrantStatus, type EntitlementStatus,
    type ModuleId,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { RequireSignIn } from '@/features/cloud/ui/common';
import { ErpPage } from '../shared/ErpPage';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { useAdminWorkspaces, usePlatformAdminStatus, useSetEntitlement } from './hooks';

const PAGE_SIZE = 25;
const STATUS_COLOR: Record<EntitlementStatus, string> = {
    none: 'default', not_required: 'default', purchased: 'green', trial: 'blue', beta: 'purple', expired: 'orange', revoked: 'red',
};

interface FormValues {
    status: EntitlementGrantStatus;
    expiresAt: Dayjs | null;
    note: string;
}

/** The page for everybody but admins is the plain "not found" page: nothing of the admin area shows. */
function NotFound() {
    const t = useTranslations('admin');
    return (
        <Result
            status="404"
            title={t('notFound.title')}
            subTitle={t('notFound.hint')}
            extra={<Link href="/"><Button type="primary">{t('notFound.back')}</Button></Link>}
        />
    );
}

export function EntitlementsPage() {
    const t = useTranslations('admin');
    return (
        <RequireSignIn next="/admin/entitlements" title={t('entitlements.title')}>
            <Guard />
        </RequireSignIn>
    );
}

function Guard() {
    const { admin, loading } = usePlatformAdminStatus();
    if (loading) return null;
    return admin ? <Entitlements /> : <NotFound />;
}

function Entitlements() {
    const t = useTranslations('admin');
    const errorMessage = useErrorMessage();
    const [input, setInput] = useState('');
    const [q, setQ] = useState('');
    const [openId, setOpenId] = useState<string | undefined>();
    const [editing, setEditing] = useState<AdminEntitlementDto | undefined>();
    const list = useAdminWorkspaces(q, PAGE_SIZE, true);
    // The open workspace always comes from the latest list, so a save shows at once.
    const open = useMemo(() => list.data?.find(w => w.id === openId), [list.data, openId]);

    const columns: ColumnsType<AdminWorkspaceDto> = [
        {
            title: t('entitlements.columns.name'), dataIndex: 'name', key: 'name',
            render: (name: string, ws) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900 break-words">{name}</div>
                    <div className="text-[12px] text-gray-500 break-all">{ws.id}</div>
                </div>
            ),
        },
        { title: t('entitlements.columns.kind'), dataIndex: 'kind', key: 'kind', responsive: ['md'], render: (k: AdminWorkspaceDto['kind']) => t(`entitlements.kind.${k}`) },
        { title: t('entitlements.columns.members'), dataIndex: 'memberCount', key: 'members', responsive: ['md'], align: 'right' },
        { title: t('entitlements.columns.created'), dataIndex: 'createdAt', key: 'created', responsive: ['lg'], render: (v: string) => <DateText value={v} /> },
        {
            title: t('entitlements.columns.granted'), key: 'granted', responsive: ['lg'],
            render: (_v, ws) => ws.entitlements.filter(e => e.status !== 'none').length,
        },
        {
            title: '', key: 'actions', align: 'right',
            render: (_v, ws) => <Button size="small" onClick={() => setOpenId(ws.id)}>{t('entitlements.manage')}</Button>,
        },
    ];

    return (
        <ErpPage title={t('entitlements.title')} subtitle={t('entitlements.subtitle')}>
            <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card flex flex-col gap-3">
                <Input.Search
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onSearch={v => setQ(v.trim())}
                    placeholder={t('entitlements.search')}
                    enterButton={t('entitlements.searchButton')}
                    maxLength={100}
                    allowClear
                    aria-label={t('entitlements.search')}
                />
                {list.isError ? (
                    <Result status="warning" title={t('entitlements.loadFailed')} subTitle={errorMessage(list.error)}
                        extra={<Button onClick={() => { void list.refetch(); }}>{t('entitlements.searchButton')}</Button>} />
                ) : (
                    <Table<AdminWorkspaceDto>
                        rowKey="id"
                        size="middle"
                        loading={list.isLoading}
                        columns={columns}
                        dataSource={list.data ?? []}
                        pagination={false}
                        scroll={{ x: 'max-content' }}
                        locale={{ emptyText: <EmptyState title={t('entitlements.empty')} /> }}
                        footer={list.data !== undefined && list.data.length >= PAGE_SIZE ? () => t('entitlements.limitHint', { count: PAGE_SIZE }) : undefined}
                    />
                )}
            </div>
            <Modal
                open={open !== undefined}
                onCancel={() => setOpenId(undefined)}
                footer={null}
                width={860}
                title={open === undefined ? null : t('entitlements.modulesTitle', { name: open.name })}
                destroyOnHidden
            >
                {open !== undefined && <ModuleRows workspace={open} onEdit={setEditing} />}
            </Modal>
            {open !== undefined && editing !== undefined && (
                <EditEntitlement workspace={open} row={editing} onClose={() => setEditing(undefined)} />
            )}
        </ErpPage>
    );
}

function ModuleRows({ workspace, onEdit }: { workspace: AdminWorkspaceDto; onEdit: (row: AdminEntitlementDto) => void }) {
    const t = useTranslations('admin');
    const tModules = useTranslations('modules');
    const columns: ColumnsType<AdminEntitlementDto> = [
        { title: t('entitlements.module.module'), dataIndex: 'module', key: 'module', render: (m: ModuleId) => tModules(`${m}.label`) },
        {
            title: t('entitlements.module.status'), dataIndex: 'status', key: 'status',
            render: (s: EntitlementStatus) => <Tag color={STATUS_COLOR[s]}>{t(`status.${s}`)}</Tag>,
        },
        {
            title: t('entitlements.module.expires'), dataIndex: 'expiresAt', key: 'expires',
            render: (v: string | null, row) => (row.status === 'none' || row.status === 'revoked'
                ? '–'
                : v === null ? t('entitlements.noExpiry') : <DateText value={v} style="dateTime" />),
        },
        { title: t('entitlements.module.note'), dataIndex: 'note', key: 'note', responsive: ['md'], render: (v: string) => <span className="break-words">{v}</span> },
        { title: '', key: 'actions', align: 'right', render: (_v, row) => <Button size="small" onClick={() => onEdit(row)}>{t('entitlements.module.edit')}</Button> },
    ];
    return <Table<AdminEntitlementDto> rowKey="module" size="small" columns={columns} dataSource={workspace.entitlements} pagination={false} scroll={{ x: 'max-content' }} />;
}

function EditEntitlement({ workspace, row, onClose }: { workspace: AdminWorkspaceDto; row: AdminEntitlementDto; onClose: () => void }) {
    const t = useTranslations('admin');
    const tModules = useTranslations('modules');
    const { message } = App.useApp();
    const errorMessage = useErrorMessage();
    const save = useSetEntitlement();
    const [form] = Form.useForm<FormValues>();
    const status = Form.useWatch('status', form);
    const live = row.status === 'purchased' || row.status === 'trial' || row.status === 'beta';
    const initial: FormValues = {
        status: live ? row.status as EntitlementGrantStatus : 'purchased',
        expiresAt: live && row.expiresAt !== null ? dayjs(row.expiresAt) : null,
        note: row.note,
    };
    const moduleName = tModules(`${row.module}.label`);

    const submit = async (v: FormValues): Promise<void> => {
        try {
            await save.mutateAsync({
                workspaceId: workspace.id,
                module: row.module,
                body: {
                    status: v.status,
                    expiresAt: v.status === 'revoked' || v.expiresAt === null ? null : v.expiresAt.endOf('day').toISOString(),
                    note: v.note.trim(),
                },
            });
            void message.success(t('form.saved', { module: moduleName }));
            onClose();
        } catch (e) {
            void message.error(errorMessage(e));
        }
    };

    return (
        <Modal
            open
            title={t('form.title', { module: moduleName })}
            onCancel={onClose}
            okText={t('form.save')}
            cancelText={t('form.cancel')}
            confirmLoading={save.isPending}
            onOk={() => { form.submit(); }}
            destroyOnHidden
        >
            <Form<FormValues> form={form} layout="vertical" initialValues={initial} onFinish={v => { void submit(v); }} requiredMark={false}>
                <Form.Item name="status" label={t('form.status')}>
                    <Select options={ENTITLEMENT_GRANT_STATUSES.map(s => ({ value: s, label: t(`status.${s}`) }))} />
                </Form.Item>
                {status !== 'revoked' && (
                    <Form.Item
                        name="expiresAt"
                        label={t('form.expiresAt')}
                        extra={t('form.expiresAtHint')}
                        rules={[{ required: status === 'trial', message: t('form.expiresRequired') }]}
                    >
                        <DatePicker className="w-full" allowClear format="YYYY-MM-DD" />
                    </Form.Item>
                )}
                <Form.Item name="note" label={t('form.note')}>
                    <Input.TextArea rows={2} maxLength={500} placeholder={t('form.notePlaceholder')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}
