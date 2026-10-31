'use client';

// ─── /projects: the projects of a workspace, create / upload / open / rename / archive ───
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Dropdown, Empty, Form, Input, Modal, Progress, Segmented, Select, Tag, Typography, type MenuProps } from 'antd';
import {
    CloudUploadOutlined, DeleteOutlined, EditOutlined, FileAddOutlined, FolderOpenOutlined, HomeOutlined, InboxOutlined,
    LaptopOutlined, MoreOutlined, PlusOutlined, RollbackOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { computeProject, createProject, type Project, type ProjectStart } from '@/domain/project';
import { diffDocs } from '@/domain/sync';
import { JOURNEY_LEVELS } from '@/domain/journey';
import { formatNumber } from '@/components/sheet/NumberCell';
import { selectGuestProject, useProjectStore } from '@/store/project-store';
import type { ProjectDto } from '@/shared/contract';
import { thaiErrorMessage } from '../api/errors';
import { RULES } from '../auth/form-rules';
import { can, ROLE_LABEL } from '../permissions';
import { useCreateProject, useCurrentWorkspace, useDeleteProject, useProjects, useUpdateProject } from '../query/hooks';
import { useCloud } from '../state';
import { savedPendingCount } from '../sync/adapters';
import { RequireSignIn, formatDateTime, spinner } from '../ui/common';
import { closeCloudProject, forgetDeletedProject, openCloudProject } from './controller';

const { Title, Text } = Typography;

/** The guest project has something the user typed (not just a fresh default project). */
export function hasGuestData(p: Project): boolean {
    return diffDocs(createProject(p.start ?? 'sample'), p).length > 0;
}

type ProjectSort = 'recent' | 'name' | 'value';
const SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
    { value: 'recent', label: 'แก้ล่าสุด' },
    { value: 'name', label: 'ชื่อ ก–ฮ' },
    { value: 'value', label: 'มูลค่าสูงสุด' },
];
/** Search and sort show from this many projects on. */
const LIST_TOOLS_FROM = 6;

export function filterProjects(list: readonly ProjectDto[], search: string): ProjectDto[] {
    const q = search.trim().toLowerCase();
    return q === '' ? [...list] : list.filter(p => p.name.toLowerCase().includes(q));
}

export function sortProjects(list: readonly ProjectDto[], sort: ProjectSort): ProjectDto[] {
    const out = [...list];
    if (sort === 'name') out.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    else if (sort === 'value') out.sort((a, b) => b.summary.constructionTotal - a.summary.constructionTotal);
    else out.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return out;
}

const START_CHOICES: { start: ProjectStart; icon: React.ReactNode; title: string; text: string }[] = [
    { start: 'blank', icon: <FileAddOutlined />, title: 'เริ่มจากแบบแปลนของฉัน', text: 'ทุกขั้นตอนเริ่มจากค่าว่าง กรอกขนาดและจำนวนตามแบบ' },
    { start: 'sample', icon: <HomeOutlined />, title: 'ลองกับบ้านตัวอย่าง', text: 'เทมเพลตบ้านเดี่ยว 1 ชั้น กรอกข้อมูลไว้ครบ' },
];

export function ProjectsPage() {
    return (
        <RequireSignIn next="/projects" title="โครงการบนคลาวด์">
            <ProjectsContent />
        </RequireSignIn>
    );
}

function ProjectsContent() {
    const router = useRouter();
    const qc = useQueryClient();
    const { message, modal } = App.useApp();
    const { workspace, workspaces, isLoading: wsLoading, select } = useCurrentWorkspace();
    const [archived, setArchived] = useState(false);
    const projects = useProjects(workspace?.id, archived);
    const openId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.projectId : null));
    const guest = useProjectStore(selectGuestProject);
    const opening = useCloud(s => s.opening);
    const [createOpen, setCreateOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [renaming, setRenaming] = useState<ProjectDto | null>(null);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<ProjectSort>('recent');
    const update = useUpdateProject();
    const remove = useDeleteProject(workspace?.id ?? '');

    const role = workspace?.role;
    const guestHasData = useMemo(() => hasGuestData(guest), [guest]);
    const guestTotal = useMemo(() => computeProject(guest).boq.constructionTotal, [guest]);
    const guestDone = JOURNEY_LEVELS.filter(l => guest.journey?.[l.id] !== undefined).length;

    if (wsLoading) return spinner;
    if (!workspace) return <Empty description="ยังไม่มีพื้นที่ทำงาน" />;

    const open = async (projectId: string) => {
        try {
            await openCloudProject(qc, projectId);
            router.push('/journey');
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    const openLocal = async () => {
        await closeCloudProject();
        router.push('/journey');
    };

    const setArchivedFlag = (p: ProjectDto, value: boolean) => {
        update.mutate({ projectId: p.id, archived: value }, {
            onSuccess: () => {
                void message.success(value ? 'เก็บถาวรแล้ว (กู้คืนได้ที่แท็บ "เก็บถาวร")' : 'กู้คืนแล้ว');
                if (value && p.id === openId) void closeCloudProject();
            },
            onError: (e) => { void message.error(thaiErrorMessage(e)); },
        });
    };

    const confirmDelete = (p: ProjectDto) => {
        modal.confirm({
            title: `ลบโครงการ "${p.name}" ถาวร?`,
            content: 'ข้อมูลทุกขั้นตอนและทุกฉบับแก้ไข ของโครงการนี้จะหายไป กู้คืนไม่ได้ (ถ้าแค่ไม่ใช้แล้ว ให้ "เก็บถาวร" แทน)',
            okText: 'ลบถาวร', okButtonProps: { danger: true }, cancelText: 'ยกเลิก',
            onOk: async () => {
                if (p.id === openId) await closeCloudProject();
                try {
                    await remove.mutateAsync(p.id);
                    await forgetDeletedProject(p.id);
                    void message.success('ลบโครงการแล้ว');
                } catch (e) {
                    void message.error(thaiErrorMessage(e));
                }
            },
        });
    };

    const menuFor = (p: ProjectDto): MenuProps => ({
        items: [
            ...(can(role, 'projects.edit') ? [{ key: 'rename', icon: <EditOutlined />, label: 'เปลี่ยนชื่อ' }] : []),
            ...(can(role, 'projects.archive')
                ? [p.archivedAt === null
                    ? { key: 'archive', icon: <InboxOutlined />, label: 'เก็บถาวร' }
                    : { key: 'restore', icon: <RollbackOutlined />, label: 'กู้คืน' }]
                : []),
            ...(can(role, 'projects.delete') ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'ลบถาวร', danger: true }] : []),
        ],
        onClick: ({ key }) => {
            if (key === 'rename') setRenaming(p);
            if (key === 'archive') setArchivedFlag(p, true);
            if (key === 'restore') setArchivedFlag(p, false);
            if (key === 'delete') confirmDelete(p);
        },
    });

    const all = projects.data ?? [];
    // Search and sort only pay off on a longer list; a few projects are scanned at a glance.
    const showTools = all.length >= LIST_TOOLS_FROM;
    const list = showTools ? sortProjects(filterProjects(all, search), sort) : all;

    return (
        <div className="flex flex-col gap-4 max-w-[1200px] mx-auto w-full">
            <div className="bg-white border border-gray-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex-1 min-w-0">
                    <Title level={3} style={{ margin: 0 }}>โครงการทั้งหมด</Title>
                    <Text type="secondary" className="text-[13px]">บันทึกบนคลาวด์ อัตโนมัติ เปิดจากเครื่องไหนก็ทำต่อได้</Text>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={workspace.id} onChange={select} style={{ minWidth: 220 }} aria-label="พื้นที่ทำงาน"
                        options={workspaces.map(w => ({
                            value: w.id,
                            label: `${w.kind === 'personal' ? 'ส่วนตัว' : w.name} · ${ROLE_LABEL[w.role]}`,
                        }))} />
                    {can(role, 'projects.create') && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>สร้างโครงการใหม่</Button>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-card p-4 sm:p-5 shadow-card flex flex-col sm:flex-row sm:items-center gap-3">
                {/* The icon stays beside the text on a phone too (it is not a line of its own). */}
                <div className="flex flex-1 min-w-0 items-center gap-3">
                <LaptopOutlined className="shrink-0 text-[22px] text-gray-500" />
                <div className="flex-1 min-w-0">
                    <div className="font-semibold">โครงการในเครื่องนี้: {guest.meta.projectName === '' ? 'โครงการของฉัน' : guest.meta.projectName}</div>
                    <div className="text-[12px] text-gray-500 tabular-nums">
                        {guestDone}/{JOURNEY_LEVELS.length} ขั้นตอน · {formatNumber(guestTotal, 0)} บาท · เก็บในเบราว์เซอร์นี้เท่านั้น
                    </div>
                </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {openId !== null && <Button icon={<FolderOpenOutlined />} onClick={() => { void openLocal(); }}>เปิด</Button>}
                    {guestHasData && can(role, 'projects.create') && (
                        <Button icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>
                            อัปโหลดโครงการในเครื่องขึ้นคลาวด์
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Segmented value={archived ? 'archived' : 'active'} onChange={v => setArchived(v === 'archived')}
                    options={[{ value: 'active', label: 'ใช้งานอยู่' }, { value: 'archived', label: 'เก็บถาวร' }]} />
                {projects.isFetching && <Text type="secondary" className="text-[12px]">กำลังโหลด…</Text>}
                {showTools && (
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                        <Input allowClear prefix={<SearchOutlined className="text-gray-400" />} placeholder="ค้นหาชื่อโครงการ"
                            aria-label="ค้นหาชื่อโครงการ" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                        <Select<ProjectSort> value={sort} onChange={setSort} aria-label="เรียงตาม" style={{ width: 150 }}
                            options={SORT_OPTIONS} />
                    </span>
                )}
            </div>

            {projects.isLoading ? spinner : projects.isError ? (
                <div className="bg-white border border-gray-200 rounded-card p-6 text-center text-gray-600">
                    {thaiErrorMessage(projects.error)}
                    <div className="mt-3"><Button onClick={() => { void projects.refetch(); }}>ลองใหม่</Button></div>
                </div>
            ) : all.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-card p-10">
                    {archived || !can(role, 'projects.create')
                        ? <Empty description={archived ? 'ไม่มีโครงการที่เก็บถาวร' : 'ยังไม่มีโครงการในพื้นที่นี้'} />
                        : (
                            <Empty description={(
                                <span className="block max-w-md mx-auto">
                                    ยังไม่มีโครงการในพื้นที่นี้ — สร้างโครงการแล้วกรอกตามแบบแปลนทีละขั้นตอน
                                    {guestHasData && ' หรืออัปโหลดโครงการที่ทำไว้ในเครื่องนี้'}
                                </span>
                            )}>
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>สร้างโครงการแรก</Button>
                                    {guestHasData && (
                                        <Button icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>อัปโหลดโครงการในเครื่อง</Button>
                                    )}
                                </div>
                            </Empty>
                        )}
                </div>
            ) : list.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-card p-8 text-center text-gray-600">
                    ไม่พบโครงการที่ชื่อมี &quot;{search.trim()}&quot;
                    <div className="mt-2"><Button size="small" onClick={() => setSearch('')}>ล้างคำค้น</Button></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {list.map(p => {
                        const pendingCount = savedPendingCount(p.id);
                        const items = menuFor(p).items ?? [];
                        const canOpen = p.archivedAt === null || p.id === openId;
                        const activate = () => {
                            if (!canOpen || opening) return;
                            if (p.id === openId) router.push('/journey');
                            else void open(p.id);
                        };
                        // The whole card opens the project; its own buttons stop the click from reaching the card
                        // (React events bubble through the menu's portal too).
                        const own = (fn?: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn?.(); };
                        return (
                            <div key={p.id} onClick={activate}
                                className={`bg-white border rounded-card p-4 shadow-card flex flex-col gap-2 transition
                                    ${canOpen ? 'cursor-pointer hover:shadow-md hover:border-orange-300' : ''}
                                    ${p.id === openId ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200'}`}>
                                <div className="flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <button type="button" onClick={own(activate)} disabled={!canOpen} title={p.name}
                                            className="w-full text-left font-semibold text-[15px] text-gray-900 line-clamp-2 [overflow-wrap:anywhere] bg-transparent border-0 p-0 cursor-pointer hover:text-orange-600 disabled:cursor-default disabled:hover:text-gray-900">
                                            {p.name}
                                        </button>
                                        <div className="text-[12px] text-gray-500">แก้ล่าสุด {formatDateTime(p.updatedAt)}</div>
                                    </div>
                                    {items.length > 0 && (
                                        <span onClick={own()}>
                                            <Dropdown menu={menuFor(p)} trigger={['click']}>
                                                <Button type="text" size="small" icon={<MoreOutlined />} aria-label="ตัวเลือก" />
                                            </Dropdown>
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {p.id === openId && <Tag color="orange">เปิดอยู่</Tag>}
                                    {p.start === 'sample' && <Tag>บ้านตัวอย่าง</Tag>}
                                    {p.archivedAt !== null && <Tag>เก็บถาวร</Tag>}
                                    {pendingCount > 0 && <Tag color="gold">รอส่ง {pendingCount} รายการ</Tag>}
                                </div>
                                <div className="text-[22px] font-bold tabular-nums leading-tight">
                                    {formatNumber(p.summary.constructionTotal, 0)} <span className="text-[13px] font-normal text-gray-500">บาท</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Progress percent={p.summary.levelsTotal === 0 ? 0 : Math.round((p.summary.levelsDone / p.summary.levelsTotal) * 100)}
                                        showInfo={false} strokeColor="#F97316" className="flex-1 !mb-0" size="small" />
                                    <span className="text-[12px] text-gray-600 whitespace-nowrap tabular-nums">{p.summary.levelsDone}/{p.summary.levelsTotal} ขั้นตอน</span>
                                </div>
                                {/* The whole card opens it: a quiet button, so "สร้างโครงการใหม่" stays the page's one primary action. */}
                                <Button block icon={<FolderOpenOutlined />} className="!mt-auto"
                                    loading={opening} disabled={!canOpen} onClick={own(activate)}>
                                    {p.id === openId ? 'ไปที่โครงการ' : p.archivedAt !== null ? 'กู้คืนก่อนเปิด' : 'เปิด'}
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}

            <CreateProjectModal open={createOpen} workspaceId={workspace.id} onClose={() => setCreateOpen(false)}
                onCreated={(id) => { setCreateOpen(false); void open(id); }} />
            <CreateProjectModal open={uploadOpen} workspaceId={workspace.id} upload={guest} onClose={() => setUploadOpen(false)}
                onCreated={(id) => {
                    setUploadOpen(false);
                    modal.confirm({
                        title: 'อัปโหลดขึ้นคลาวด์ แล้ว',
                        content: 'โครงการในเครื่องนี้ยังอยู่เหมือนเดิม ต้องการเปิดโครงการบนคลาวด์ เพื่อทำต่อเลยไหม',
                        okText: 'เปิดโครงการบนคลาวด์', cancelText: 'ไว้ทีหลัง',
                        onOk: () => open(id),
                    });
                }} />
            <RenameModal project={renaming} onClose={() => setRenaming(null)} />
        </div>
    );
}

/** The "new project" modal (also used by the Project Hub, WP-16). */
export function CreateProjectModal({ open, workspaceId, upload, onClose, onCreated }: {
    open: boolean;
    workspaceId: string;
    /** Upload this (guest) project instead of starting a new one. */
    upload?: Project;
    onClose: () => void;
    onCreated: (projectId: string) => void;
}) {
    const { message } = App.useApp();
    const create = useCreateProject(workspaceId);
    const [form] = Form.useForm<{ name: string; start: ProjectStart }>();
    const [start, setStart] = useState<ProjectStart>('blank');

    const submit = async () => {
        const values = await form.validateFields();
        try {
            const detail = await create.mutateAsync({
                name: values.name.trim(),
                start: upload ? (upload.start ?? 'sample') : start,
                upload,
            });
            form.resetFields();
            onCreated(detail.project.id);
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    const defaultName = upload && upload.meta.projectName !== '' ? upload.meta.projectName : '';

    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden
            title={upload ? 'อัปโหลดโครงการในเครื่องขึ้นคลาวด์' : 'สร้างโครงการใหม่'}
            okText={upload ? 'อัปโหลด' : 'สร้างโครงการ'} cancelText="ยกเลิก"
            confirmLoading={create.isPending} onOk={() => { void submit().catch(() => undefined); }}>
            {upload && (
                <p className="text-[13px] text-gray-600 mb-3">
                    ข้อมูลทุกขั้นตอนที่กรอกไว้ในเครื่องนี้จะถูกคัดลอกขึ้นคลาวด์ — โครงการในเครื่องยังอยู่ ไม่ถูกลบ
                </p>
            )}
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: defaultName }}>
                <Form.Item name="name" label="ชื่อโครงการ" rules={RULES.projectName}>
                    <Input placeholder="เช่น บ้านคุณสมชาย ลำลูกกา" autoFocus />
                </Form.Item>
            </Form>
            {!upload && (
                <div className="flex flex-col gap-2">
                    {START_CHOICES.map(c => (
                        <button key={c.start} type="button" onClick={() => setStart(c.start)}
                            className={`text-left flex gap-3 rounded-card border-2 p-3 transition cursor-pointer bg-white
                                ${start === c.start ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
                            <span className="text-[22px] text-orange-500">{c.icon}</span>
                            <span>
                                <span className="block font-semibold text-[14px] text-gray-900">{c.title}</span>
                                <span className="block text-[12px] text-gray-600">{c.text}</span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </Modal>
    );
}

function RenameModal({ project, onClose }: { project: ProjectDto | null; onClose: () => void }) {
    const { message } = App.useApp();
    const update = useUpdateProject();
    const [form] = Form.useForm<{ name: string }>();

    const submit = async () => {
        if (!project) return;
        const { name } = await form.validateFields();
        try {
            await update.mutateAsync({ projectId: project.id, name: name.trim() });
            void message.success('เปลี่ยนชื่อแล้ว');
            onClose();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open={project !== null} onCancel={onClose} destroyOnHidden title="เปลี่ยนชื่อโครงการ"
            okText="บันทึก" cancelText="ยกเลิก" confirmLoading={update.isPending}
            onOk={() => { void submit().catch(() => undefined); }}>
            <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: project?.name ?? '' }} key={project?.id ?? 'none'}>
                <Form.Item name="name" label="ชื่อโครงการ" rules={RULES.projectName}>
                    <Input autoFocus />
                </Form.Item>
            </Form>
        </Modal>
    );
}
