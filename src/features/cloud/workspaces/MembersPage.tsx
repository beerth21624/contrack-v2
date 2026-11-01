'use client';

// ─── /workspace/members: members and roles, invitations (copyable link), workspace settings ───
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Alert, App, Avatar, Button, Form, Input, Modal, Popconfirm, Select, Table, Tag, Tooltip, Typography } from 'antd';
import {
    CheckOutlined, CopyOutlined, DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined, TeamOutlined, UserAddOutlined,
} from '@ant-design/icons';
import type { AssignableRole, InvitationDto, MemberDto, Role, WorkspaceDto } from '@/shared/contract';
import { useErrorMessage } from '../api/error-message';
import { useRules } from '../auth/use-rules';
import { initials, useSession } from '../auth/session';
import { useModuleEnabled } from '@/features/modules/modules';
import { can, canManage, grantableRoles } from '../permissions';
import {
    useChangeRole, useCreateInvitation, useCreateWorkspace, useCurrentWorkspace, useDeleteWorkspace, useInvitations, useMembers,
    useRemoveMember, useRenameWorkspace, useRevokeInvitation,
} from '../query/hooks';
import { RequireSignIn, spinner, useDateTime } from '../ui/common';

const { Title, Text } = Typography;

export function inviteLink(token: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/invite/${encodeURIComponent(token)}`;
}

interface RoleText {
    label: (r: Role) => string;
    hint: (r: Role) => string;
}

/** Role names and what each may do, from the `roles` messages (Thai text = the labels release 1 always showed). */
function useRoleText(): RoleText {
    const t = useTranslations('roles');
    return useMemo(() => ({ label: (r: Role) => t(`${r}.label`), hint: (r: Role) => t(`${r}.hint`) }), [t]);
}

/** A role option in a dropdown: the role, and under it what that role may do. */
const roleOption = (text: RoleText, r: Role) => ({
    value: r,
    label: text.label(r),
    hint: text.hint(r),
});

/** The roles to offer; a member who already has a role outside them (an ERP role while the ERP is off) keeps it listed. */
const withCurrent = (roles: Role[], current: Role): Role[] => (roles.includes(current) ? roles : [...roles, current]);
const renderRoleOption = (o: { data: { label?: unknown; hint?: unknown } }) => (
    <div className="py-0.5">
        <div>{typeof o.data.label === 'string' ? o.data.label : ''}</div>
        <div className="text-[11px] text-gray-500 whitespace-normal">{typeof o.data.hint === 'string' ? o.data.hint : ''}</div>
    </div>
);

export function MembersPage() {
    const t = useTranslations('cloud.members');
    return (
        <RequireSignIn next="/workspace/members" title={t('title')}>
            <MembersContent />
        </RequireSignIn>
    );
}

function MembersContent() {
    const t = useTranslations('cloud.members');
    const tc = useTranslations('cloud.shared');
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    const [createOpen, setCreateOpen] = useState(false);

    if (isLoading) return spinner;

    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">
            <div className="bg-white border border-gray-200 rounded-card p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Title level={3} style={{ margin: 0 }}>{t('heading')}</Title>
                    <Text type="secondary" className="text-[13px]">{t('subtitle')}</Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {workspace && (
                        <Select value={workspace.id} onChange={select} style={{ minWidth: 220 }} aria-label={tc('workspaceAria')}
                            options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? tc('personal') : w.name }))} />
                    )}
                    <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{t('createWorkspace')}</Button>
                </div>
            </div>
            {workspace ? <WorkspaceSection key={workspace.id} workspace={workspace} onCreate={() => setCreateOpen(true)} /> : null}
            <CreateWorkspaceModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
    );
}

function WorkspaceSection({ workspace, onCreate }: { workspace: WorkspaceDto; onCreate: () => void }) {
    const { message, modal } = App.useApp();
    const me = useSession(s => s.user);
    const members = useMembers(workspace.id);
    const isCompany = workspace.kind === 'company';
    const myRole = workspace.role;
    const changeRole = useChangeRole(workspace.id);
    const removeMember = useRemoveMember(workspace.id);
    const deleteWorkspace = useDeleteWorkspace();
    const [renameOpen, setRenameOpen] = useState(false);
    const roleText = useRoleText();
    const t = useTranslations('cloud.members');
    const tc = useTranslations('cloud.shared');
    const toText = useErrorMessage();
    const dateTime = useDateTime();
    // The ERP working roles (pm, purchasing, accounting, foreman) are offered only while the ERP is active here.
    const erpRoles = useModuleEnabled('project-hub', workspace.id).enabled;

    const onRole = (m: MemberDto, role: Role) => {
        changeRole.mutate({ userId: m.userId, role }, {
            onSuccess: () => { void message.success(t('roleChanged', { name: m.displayName, role: roleText.label(role) })); },
            onError: (e) => { void message.error(toText(e)); },
        });
    };
    const onRemove = (m: MemberDto) => {
        removeMember.mutate(m.userId, {
            onSuccess: () => { void message.success(m.userId === me?.id ? t('left') : t('removed', { name: m.displayName })); },
            onError: (e) => { void message.error(toText(e)); },
        });
    };
    const onDelete = () => {
        modal.confirm({
            title: t('deleteTitle', { name: workspace.name }),
            content: t('deleteContent'),
            okText: tc('deletePermanent'), okButtonProps: { danger: true }, cancelText: tc('cancel'),
            onOk: async () => {
                try {
                    await deleteWorkspace.mutateAsync(workspace.id);
                    void message.success(t('workspaceDeleted'));
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    const columns = [
        {
            title: t('colMember'), key: 'who',
            render: (_: unknown, m: MemberDto) => (
                <div className="flex items-center gap-3">
                    <Avatar style={{ background: '#F97316' }}>{initials(m.displayName)}</Avatar>
                    <div className="min-w-0">
                        <div className="font-semibold">{m.displayName}{m.userId === me?.id && <Tag className="!ml-2">{t('you')}</Tag>}</div>
                        <div className="text-[12px] text-gray-500 truncate">{m.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: t('colRole'), key: 'role', width: 240,
            render: (_: unknown, m: MemberDto) => (isCompany && m.userId !== me?.id && canManage(myRole, m.role)
                ? (
                    <Select value={m.role} style={{ width: 210 }} onChange={(r: Role) => onRole(m, r)} loading={changeRole.isPending}
                        popupMatchSelectWidth={260} optionRender={renderRoleOption}
                        options={withCurrent(grantableRoles(myRole, true, erpRoles), m.role).map(r => roleOption(roleText, r))} />
                )
                : (
                    <Tooltip title={roleText.hint(m.role)}>
                        <Tag color={m.role === 'owner' ? 'orange' : m.role === 'viewer' ? 'default' : 'blue'}>{roleText.label(m.role)}</Tag>
                    </Tooltip>
                )),
        },
        { title: t('colJoined'), key: 'joined', width: 170, responsive: ['md' as const], render: (_: unknown, m: MemberDto) => dateTime(m.joinedAt) },
        {
            title: '', key: 'actions', width: 140, align: 'right' as const,
            render: (_: unknown, m: MemberDto) => {
                if (!isCompany) return null;
                if (m.userId === me?.id) {
                    return (
                        <Popconfirm title={t('leaveConfirm')} okText={t('leave')} cancelText={tc('cancel')} onConfirm={() => onRemove(m)}>
                            <Button size="small" icon={<LogoutOutlined />}>{t('leave')}</Button>
                        </Popconfirm>
                    );
                }
                if (!can(myRole, 'members.remove') || !canManage(myRole, m.role)) return null;
                return (
                    <Popconfirm title={t('removeConfirm', { name: m.displayName })} okText={t('remove')} cancelText={tc('cancel')}
                        okButtonProps={{ danger: true }} onConfirm={() => onRemove(m)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />}>{t('remove')}</Button>
                    </Popconfirm>
                );
            },
        },
    ];

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <TeamOutlined className="text-orange-500 text-[18px]" />
                    <span className="font-semibold text-[16px]">{isCompany ? workspace.name : t('personalSpace')}</span>
                    <Tag>{isCompany ? tc('company') : tc('personal')}</Tag>
                    <Text type="secondary" className="text-[12px]">{tc('yourRole', { role: roleText.label(myRole) })}</Text>
                    <span className="ml-auto flex gap-2">
                        {isCompany && can(myRole, 'workspace.rename') && (
                            <Button size="small" icon={<EditOutlined />} onClick={() => setRenameOpen(true)}>{tc('rename')}</Button>
                        )}
                        {isCompany && can(myRole, 'workspace.delete') && (
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onDelete}>{t('deleteWorkspace')}</Button>
                        )}
                    </span>
                </div>
                {!isCompany && (
                    <Alert type="info" showIcon className="!mb-3" title={t('personalAlertTitle')}
                        description={<>{t('personalAlertDesc')} <Button type="link" size="small" onClick={onCreate}>{t('createNow')}</Button></>} />
                )}
                <Table<MemberDto> rowKey="userId" columns={columns} dataSource={members.data ?? []} loading={members.isLoading}
                    pagination={false} size="middle" scroll={{ x: 560 }}
                    locale={{ emptyText: members.isError ? toText(members.error) : t('emptyMembers') }} />
            </div>

            {isCompany && can(myRole, 'members.invite') && <InvitationsSection workspace={workspace} />}
            <RenameWorkspaceModal workspace={renameOpen ? workspace : null} onClose={() => setRenameOpen(false)} />
        </>
    );
}

function InvitationsSection({ workspace }: { workspace: WorkspaceDto }) {
    const { message } = App.useApp();
    const invitations = useInvitations(workspace.id);
    const create = useCreateInvitation(workspace.id);
    const revoke = useRevokeInvitation(workspace.id);
    const [form] = Form.useForm<{ email: string; role: AssignableRole }>();
    const [link, setLink] = useState<{ email: string; url: string } | null>(null);
    // "Copied" after a successful copy, until the dialog closes.
    const [copied, setCopied] = useState(false);
    const roleText = useRoleText();
    const t = useTranslations('cloud.members');
    const rules = useRules();
    const toText = useErrorMessage();
    const dateTime = useDateTime();
    const erpRoles = useModuleEnabled('project-hub', workspace.id).enabled;
    const roles = grantableRoles(workspace.role, false, erpRoles) as AssignableRole[];
    const closeLink = () => { setLink(null); setCopied(false); };
    const copyLink = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
        } catch {
            void message.error(t('copyFailed'));
        }
    };

    const submit = async () => {
        const values = await form.validateFields();
        try {
            const res = await create.mutateAsync({ email: values.email.trim().toLowerCase(), role: values.role });
            setLink({ email: res.invitation.email, url: inviteLink(res.token) });
            form.resetFields();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const columns = [
        { title: t('colEmail'), dataIndex: 'email', key: 'email' },
        {
            title: t('colRole'), key: 'role',
            render: (_: unknown, i: InvitationDto) => <Tooltip title={roleText.hint(i.role)}><Tag>{roleText.label(i.role)}</Tag></Tooltip>,
        },
        { title: t('colExpires'), key: 'exp', responsive: ['sm' as const], render: (_: unknown, i: InvitationDto) => dateTime(i.expiresAt) },
        {
            title: '', key: 'actions', align: 'right' as const,
            render: (_: unknown, i: InvitationDto) => (
                <Popconfirm title={t('revokeConfirm')} okText={t('revokeOk')} cancelText={t('revokeNo')}
                    onConfirm={() => revoke.mutate(i.id, { onError: (e) => { void message.error(toText(e)); } })}>
                    <Button size="small">{t('revoke')}</Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-card p-4 shadow-card">
            <div className="flex items-center gap-2 mb-3">
                <UserAddOutlined className="text-orange-500 text-[18px]" />
                <span className="font-semibold text-[16px]">{t('inviteHeading')}</span>
            </div>
            <Form form={form} layout="inline" requiredMark={false} initialValues={{ role: 'estimator' }}
                className="flex flex-wrap gap-y-2" onFinish={() => { void submit(); }}>
                <Form.Item name="email" rules={rules.email} style={{ minWidth: 260, flex: 1 }}>
                    <Input placeholder={t('emailPlaceholder')} inputMode="email" />
                </Form.Item>
                <Form.Item name="role">
                    <Select style={{ width: 210 }} popupMatchSelectWidth={260} optionRender={renderRoleOption}
                        options={roles.map(r => roleOption(roleText, r))} />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} loading={create.isPending}>{t('createLink')}</Button>
            </Form>
            <Text type="secondary" className="block text-[12px] mt-2">
                {t('noEmailNote')}
            </Text>

            <div className="mt-4 font-semibold text-[14px]">{t('pendingHeading')}</div>
            <Table<InvitationDto> rowKey="id" columns={columns} dataSource={invitations.data ?? []} loading={invitations.isLoading}
                pagination={false} size="small" className="mt-2"
                locale={{ emptyText: invitations.isError ? toText(invitations.error) : t('emptyInvites') }} />

            <Modal open={link !== null} onCancel={closeLink} title={t('linkReadyTitle')}
                footer={<Button onClick={closeLink}>{t('done')}</Button>}>
                <p className="text-[13px] text-gray-600">{t.rich('linkSend', { email: link?.email ?? '', b: (chunks) => <b>{chunks}</b> })}</p>
                <div className="flex gap-2">
                    <Input readOnly value={link?.url ?? ''} aria-label={t('linkAria')} onFocus={e => e.currentTarget.select()} />
                    <Button type="primary" icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={() => { void copyLink(); }}>
                        {copied ? t('copied') : t('copyLink')}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}

function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const router = useRouter();
    const t = useTranslations('cloud.members');
    const tc = useTranslations('cloud.shared');
    const rules = useRules();
    const toText = useErrorMessage();
    const create = useCreateWorkspace();
    const [form] = Form.useForm<{ name: string }>();
    const submit = async () => {
        const { name } = await form.validateFields();
        try {
            await create.mutateAsync(name.trim());
            void message.success(t('created'));
            form.resetFields();
            onClose();
            router.push('/workspace/members');
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title={t('createTitle')} okText={t('createOk')} cancelText={tc('cancel')}
            confirmLoading={create.isPending} onOk={() => { void submit().catch(() => undefined); }}>
            <p className="text-[13px] text-gray-600">{t('createNote')}</p>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item name="name" label={t('nameLabel')} rules={rules.workspaceName}>
                    <Input placeholder={t('namePlaceholder')} autoFocus />
                </Form.Item>
            </Form>
        </Modal>
    );
}

function RenameWorkspaceModal({ workspace, onClose }: { workspace: WorkspaceDto | null; onClose: () => void }) {
    const { message } = App.useApp();
    const t = useTranslations('cloud.members');
    const tc = useTranslations('cloud.shared');
    const rules = useRules();
    const toText = useErrorMessage();
    const rename = useRenameWorkspace(workspace?.id ?? '');
    const [form] = Form.useForm<{ name: string }>();
    const submit = async () => {
        const { name } = await form.validateFields();
        try {
            await rename.mutateAsync(name.trim());
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open={workspace !== null} onCancel={onClose} destroyOnHidden title={t('renameTitle')} okText={tc('save')} cancelText={tc('cancel')}
            confirmLoading={rename.isPending} onOk={() => { void submit().catch(() => undefined); }}>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: workspace?.name ?? '' }}>
                <Form.Item name="name" label={t('nameLabel')} rules={rules.workspaceName}>
                    <Input autoFocus />
                </Form.Item>
            </Form>
        </Modal>
    );
}
