'use client';

// ─── /workspace/members: members and roles, invitations (copyable link), workspace settings ───
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Avatar, Button, Form, Input, Modal, Popconfirm, Select, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, LogoutOutlined, PlusOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import type { AssignableRole, InvitationDto, MemberDto, Role, WorkspaceDto } from '@/shared/contract';
import { thaiErrorMessage } from '../api/errors';
import { RULES } from '../auth/form-rules';
import { initials, useSession } from '../auth/session';
import { can, canManage, grantableRoles, ROLE_HINT, ROLE_LABEL } from '../permissions';
import {
    useChangeRole, useCreateInvitation, useCreateWorkspace, useCurrentWorkspace, useDeleteWorkspace, useInvitations, useMembers,
    useRemoveMember, useRenameWorkspace, useRevokeInvitation,
} from '../query/hooks';
import { RequireSignIn, formatDateTime, spinner } from '../ui/common';

const { Title, Text, Paragraph } = Typography;

export function inviteLink(token: string): string {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    return `${origin}/invite/${encodeURIComponent(token)}`;
}

export function MembersPage() {
    return (
        <RequireSignIn next="/workspace/members" title="สมาชิกและทีม">
            <MembersContent />
        </RequireSignIn>
    );
}

function MembersContent() {
    const { workspace, workspaces, isLoading, select } = useCurrentWorkspace();
    const [createOpen, setCreateOpen] = useState(false);

    if (isLoading) return spinner;

    return (
        <div className="flex flex-col gap-4 max-w-5xl mx-auto w-full">
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Title level={3} style={{ margin: 0 }}>สมาชิก</Title>
                    <Text type="secondary" className="text-[13px]">ใครอยู่ในพื้นที่ทำงานนี้ และทำอะไรได้บ้าง</Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {workspace && (
                        <Select value={workspace.id} onChange={select} style={{ minWidth: 220 }} aria-label="พื้นที่ทำงาน"
                            options={workspaces.map(w => ({ value: w.id, label: w.kind === 'personal' ? 'ส่วนตัว' : w.name }))} />
                    )}
                    <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>สร้างพื้นที่ของบริษัท/ทีม</Button>
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

    const onRole = (m: MemberDto, role: Role) => {
        changeRole.mutate({ userId: m.userId, role }, {
            onSuccess: () => { void message.success(`เปลี่ยน ${m.displayName} เป็น ${ROLE_LABEL[role]} แล้ว`); },
            onError: (e) => { void message.error(thaiErrorMessage(e)); },
        });
    };
    const onRemove = (m: MemberDto) => {
        removeMember.mutate(m.userId, {
            onSuccess: () => { void message.success(m.userId === me?.id ? 'ออกจากพื้นที่ทำงานแล้ว' : `นำ ${m.displayName} ออกแล้ว`); },
            onError: (e) => { void message.error(thaiErrorMessage(e)); },
        });
    };
    const onDelete = () => {
        modal.confirm({
            title: `ลบพื้นที่ทำงาน "${workspace.name}" ถาวร?`,
            content: 'โครงการทั้งหมดในพื้นที่นี้จะหายไปด้วย กู้คืนไม่ได้',
            okText: 'ลบถาวร', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
            onOk: async () => {
                try {
                    await deleteWorkspace.mutateAsync(workspace.id);
                    void message.success('ลบพื้นที่ทำงานแล้ว');
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    const columns = [
        {
            title: 'สมาชิก', key: 'who',
            render: (_: unknown, m: MemberDto) => (
                <div className="flex items-center gap-3">
                    <Avatar style={{ background: '#fa8c16' }}>{initials(m.displayName)}</Avatar>
                    <div className="min-w-0">
                        <div className="font-semibold">{m.displayName}{m.userId === me?.id && <Tag className="!ml-2">คุณ</Tag>}</div>
                        <div className="text-[12px] text-gray-500 truncate">{m.email}</div>
                    </div>
                </div>
            ),
        },
        {
            title: 'บทบาท', key: 'role', width: 240,
            render: (_: unknown, m: MemberDto) => (isCompany && m.userId !== me?.id && canManage(myRole, m.role)
                ? (
                    <Select value={m.role} style={{ width: 210 }} onChange={(r: Role) => onRole(m, r)} loading={changeRole.isPending}
                        options={grantableRoles(myRole, true).map(r => ({ value: r, label: ROLE_LABEL[r], title: ROLE_HINT[r] }))} />
                )
                : <Tag color={m.role === 'owner' ? 'orange' : m.role === 'viewer' ? 'default' : 'blue'}>{ROLE_LABEL[m.role]}</Tag>),
        },
        { title: 'เข้าร่วมเมื่อ', key: 'joined', width: 170, responsive: ['md' as const], render: (_: unknown, m: MemberDto) => formatDateTime(m.joinedAt) },
        {
            title: '', key: 'actions', width: 140, align: 'right' as const,
            render: (_: unknown, m: MemberDto) => {
                if (!isCompany) return null;
                if (m.userId === me?.id) {
                    return (
                        <Popconfirm title="ออกจากพื้นที่ทำงานนี้?" okText="ออก" cancelText="ยกเลิก" onConfirm={() => onRemove(m)}>
                            <Button size="small" icon={<LogoutOutlined />}>ออก</Button>
                        </Popconfirm>
                    );
                }
                if (!can(myRole, 'members.remove') || !canManage(myRole, m.role)) return null;
                return (
                    <Popconfirm title={`นำ ${m.displayName} ออกจากพื้นที่ทำงาน?`} okText="นำออก" cancelText="ยกเลิก"
                        okButtonProps={{ danger: true }} onConfirm={() => onRemove(m)}>
                        <Button size="small" danger icon={<DeleteOutlined />}>นำออก</Button>
                    </Popconfirm>
                );
            },
        },
    ];

    return (
        <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                    <TeamOutlined className="text-orange-500 text-[18px]" />
                    <span className="font-semibold text-[16px]">{isCompany ? workspace.name : 'พื้นที่ส่วนตัว'}</span>
                    <Tag>{isCompany ? 'บริษัท/ทีม' : 'ส่วนตัว'}</Tag>
                    <Text type="secondary" className="text-[12px]">บทบาทของคุณ: {ROLE_LABEL[myRole]}</Text>
                    <span className="ml-auto flex gap-2">
                        {isCompany && can(myRole, 'workspace.rename') && (
                            <Button size="small" icon={<EditOutlined />} onClick={() => setRenameOpen(true)}>เปลี่ยนชื่อ</Button>
                        )}
                        {isCompany && can(myRole, 'workspace.delete') && (
                            <Button size="small" danger icon={<DeleteOutlined />} onClick={onDelete}>ลบพื้นที่</Button>
                        )}
                    </span>
                </div>
                {!isCompany && (
                    <Alert type="info" showIcon className="!mb-3" title="พื้นที่ส่วนตัวมีคุณคนเดียว"
                        description={<>ถ้าจะทำ BOQ เป็นทีม ให้สร้างพื้นที่ของบริษัท/ทีมแล้วเชิญเพื่อนร่วมงาน <Button type="link" size="small" onClick={onCreate}>สร้างเลย</Button></>} />
                )}
                <Table<MemberDto> rowKey="userId" columns={columns} dataSource={members.data ?? []} loading={members.isLoading}
                    pagination={false} size="middle" scroll={{ x: 560 }}
                    locale={{ emptyText: members.isError ? thaiErrorMessage(members.error) : 'ยังไม่มีสมาชิก' }} />
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
    const roles = grantableRoles(workspace.role, false) as AssignableRole[];

    const submit = async () => {
        const values = await form.validateFields();
        try {
            const res = await create.mutateAsync({ email: values.email.trim().toLowerCase(), role: values.role });
            setLink({ email: res.invitation.email, url: inviteLink(res.token) });
            form.resetFields();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    const columns = [
        { title: 'อีเมล', dataIndex: 'email', key: 'email' },
        { title: 'บทบาท', key: 'role', render: (_: unknown, i: InvitationDto) => <Tag>{ROLE_LABEL[i.role]}</Tag> },
        { title: 'หมดอายุ', key: 'exp', responsive: ['sm' as const], render: (_: unknown, i: InvitationDto) => formatDateTime(i.expiresAt) },
        {
            title: '', key: 'actions', align: 'right' as const,
            render: (_: unknown, i: InvitationDto) => (
                <Popconfirm title="ยกเลิกคำเชิญนี้? ลิงก์ที่ส่งไปจะใช้ไม่ได้" okText="ยกเลิกคำเชิญ" cancelText="ไม่"
                    onConfirm={() => revoke.mutate(i.id, { onError: (e) => { void message.error(thaiErrorMessage(e)); } })}>
                    <Button size="small">ยกเลิก</Button>
                </Popconfirm>
            ),
        },
    ];

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
                <UserAddOutlined className="text-orange-500 text-[18px]" />
                <span className="font-semibold text-[16px]">เชิญสมาชิก</span>
            </div>
            <Form form={form} layout="inline" requiredMark={false} initialValues={{ role: 'estimator' }}
                className="flex flex-wrap gap-y-2" onFinish={() => { void submit(); }}>
                <Form.Item name="email" rules={RULES.email} style={{ minWidth: 260, flex: 1 }}>
                    <Input placeholder="อีเมลของคนที่จะเชิญ" inputMode="email" />
                </Form.Item>
                <Form.Item name="role">
                    <Select style={{ width: 210 }} options={roles.map(r => ({ value: r, label: ROLE_LABEL[r], title: ROLE_HINT[r] }))} />
                </Form.Item>
                <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} loading={create.isPending}>สร้างลิงก์เชิญ</Button>
            </Form>
            <Text type="secondary" className="block text-[12px] mt-2">
                ระบบยังไม่ส่งอีเมลให้ — คัดลอกลิงก์ไปส่งทาง LINE หรืออีเมลเอง คนที่ได้รับต้องเข้าสู่ระบบด้วยอีเมลที่เชิญ
            </Text>

            <div className="mt-4 font-semibold text-[14px]">คำเชิญที่ยังไม่ตอบรับ</div>
            <Table<InvitationDto> rowKey="id" columns={columns} dataSource={invitations.data ?? []} loading={invitations.isLoading}
                pagination={false} size="small" className="mt-2"
                locale={{ emptyText: invitations.isError ? thaiErrorMessage(invitations.error) : 'ไม่มีคำเชิญค้าง' }} />

            <Modal open={link !== null} onCancel={() => setLink(null)} title="ลิงก์เชิญพร้อมแล้ว"
                footer={<Button type="primary" onClick={() => setLink(null)}>เสร็จ</Button>}>
                <p className="text-[13px] text-gray-600">ส่งลิงก์นี้ให้ <b>{link?.email}</b> (แสดงครั้งเดียว ถ้าทำหายให้สร้างคำเชิญใหม่)</p>
                <Paragraph copyable={{ text: link?.url ?? '', tooltips: ['คัดลอก', 'คัดลอกแล้ว'] }}
                    className="!mb-0 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 break-all text-[13px]">
                    {link?.url}
                </Paragraph>
            </Modal>
        </div>
    );
}

function CreateWorkspaceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { message } = App.useApp();
    const router = useRouter();
    const create = useCreateWorkspace();
    const [form] = Form.useForm<{ name: string }>();
    const submit = async () => {
        const { name } = await form.validateFields();
        try {
            await create.mutateAsync(name.trim());
            void message.success('สร้างพื้นที่ทำงานแล้ว — เชิญทีมได้เลย');
            form.resetFields();
            onClose();
            router.push('/workspace/members');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };
    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title="สร้างพื้นที่ทำงานของบริษัท/ทีม" okText="สร้าง" cancelText="ยกเลิก"
            confirmLoading={create.isPending} onOk={() => { void submit().catch(() => undefined); }}>
            <p className="text-[13px] text-gray-600">คุณจะเป็นเจ้าของ แล้วเชิญเพื่อนร่วมงานเข้ามาทำ BOQ ด้วยกัน</p>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item name="name" label="ชื่อบริษัท/ทีม" rules={RULES.workspaceName}>
                    <Input placeholder="เช่น หจก. สมชายก่อสร้าง" autoFocus />
                </Form.Item>
            </Form>
        </Modal>
    );
}

function RenameWorkspaceModal({ workspace, onClose }: { workspace: WorkspaceDto | null; onClose: () => void }) {
    const { message } = App.useApp();
    const rename = useRenameWorkspace(workspace?.id ?? '');
    const [form] = Form.useForm<{ name: string }>();
    const submit = async () => {
        const { name } = await form.validateFields();
        try {
            await rename.mutateAsync(name.trim());
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };
    return (
        <Modal open={workspace !== null} onCancel={onClose} destroyOnHidden title="เปลี่ยนชื่อพื้นที่ทำงาน" okText="บันทึก" cancelText="ยกเลิก"
            confirmLoading={rename.isPending} onOk={() => { void submit().catch(() => undefined); }}>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: workspace?.name ?? '' }}>
                <Form.Item name="name" label="ชื่อบริษัท/ทีม" rules={RULES.workspaceName}>
                    <Input autoFocus />
                </Form.Item>
            </Form>
        </Modal>
    );
}
