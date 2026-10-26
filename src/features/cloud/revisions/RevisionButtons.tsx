'use client';

// ─── "ออกฉบับแก้ไข" + the list of revisions of the open cloud project (nothing in guest mode) ───
// A revision is a frozen copy of the whole project (what was sent to the owner). Each one can be exported again.
import { useState } from 'react';
import { App, Button, Drawer, Empty, Form, Input, Modal, Space, Spin, Tag } from 'antd';
import { HistoryOutlined, SnippetsOutlined } from '@ant-design/icons';
import type { Project } from '@/domain/project';
import { formatNumber } from '@/components/sheet/NumberCell';
import { BoqExportButtons } from '@/features/export/BoqExportButtons';
import { useProjectStore } from '@/store/project-store';
import type { RevisionDto } from '@/shared/contract';
import { thaiErrorMessage } from '../api/errors';
import { RULES } from '../auth/form-rules';
import { can } from '../permissions';
import { useCreateRevision, useMembers, useRevision, useRevisions } from '../query/hooks';
import { useCloud } from '../state';
import { formatDateTime } from '../ui/common';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A revision snapshot in the frontend Project shape (checked before it is exported). */
export function asProjectSnapshot(snapshot: unknown): Project | null {
    if (!isRecord(snapshot)) return null;
    return isRecord(snapshot.meta) && isRecord(snapshot.calculators) && isRecord(snapshot.boqOverrides)
        ? snapshot as unknown as Project
        : null;
}

/** A label not used yet: "Rev.<revision on the BOQ header>" first, then Rev.00, Rev.01, … */
export function nextRevisionLabel(used: readonly string[], headerRevision: string): string {
    const taken = new Set(used.map(l => l.trim().toLowerCase()));
    const header = headerRevision.trim();
    if (header !== '' && !taken.has(`rev.${header}`.toLowerCase())) return `Rev.${header}`;
    for (let n = used.length; ; n++) {
        const label = `Rev.${String(n).padStart(2, '0')}`;
        if (!taken.has(label.toLowerCase())) return label;
    }
}

export function RevisionButtons({ size = 'middle' }: { size?: 'small' | 'middle' | 'large' }) {
    const binding = useProjectStore(s => s.binding);
    const cloud = binding.kind === 'cloud' ? binding : null;
    const revisions = useRevisions(cloud?.projectId);
    const [createOpen, setCreateOpen] = useState(false);
    const [listOpen, setListOpen] = useState(false);

    if (!cloud) return null;
    const count = revisions.data?.length ?? 0;

    return (
        <>
            <Space wrap size={8}>
                {can(cloud.role, 'revisions.create') && (
                    <Button size={size} icon={<SnippetsOutlined />} onClick={() => setCreateOpen(true)}>ออกฉบับแก้ไข</Button>
                )}
                <Button size={size} type="text" icon={<HistoryOutlined />} onClick={() => setListOpen(true)}>
                    ฉบับแก้ไขทั้งหมด{count > 0 ? ` (${String(count)})` : ''}
                </Button>
            </Space>
            <CreateRevisionModal open={createOpen} projectId={cloud.projectId} used={(revisions.data ?? []).map(r => r.label)}
                onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); setListOpen(true); }} />
            <Drawer open={listOpen} onClose={() => setListOpen(false)} title="ฉบับแก้ไขที่ออกแล้ว" size={420}>
                <RevisionList projectId={cloud.projectId} workspaceId={cloud.workspaceId} />
            </Drawer>
        </>
    );
}

function CreateRevisionModal({ open, projectId, used, onClose, onCreated }: {
    open: boolean; projectId: string; used: string[]; onClose: () => void; onCreated: () => void;
}) {
    const { message } = App.useApp();
    const headerRevision = useProjectStore(s => s.project.meta.revision);
    const pending = useCloud(s => s.syncStatus.count);
    const create = useCreateRevision(projectId);
    const [form] = Form.useForm<{ label: string; note?: string }>();

    const submit = async () => {
        const values = await form.validateFields();
        try {
            const note = values.note?.trim();
            await create.mutateAsync({ label: values.label.trim(), note: note === undefined || note === '' ? undefined : note });
            void message.success(`ออก ${values.label.trim()} แล้ว`);
            form.resetFields();
            onCreated();
        } catch (e) {
            void message.error(thaiErrorMessage(e));
        }
    };

    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title="ออกฉบับแก้ไข" okText="ออกฉบับแก้ไข" cancelText="ยกเลิก"
            confirmLoading={create.isPending} okButtonProps={{ disabled: pending > 0 }}
            onOk={() => { void submit().catch(() => undefined); }}>
            <p className="text-[13px] text-gray-600">
                เก็บ BOQ ตอนนี้ไว้เป็นฉบับที่ส่งให้เจ้าของบ้าน แก้ไม่ได้ภายหลัง (โครงการยังแก้ต่อได้ตามปกติ)
            </p>
            {pending > 0 && (
                <p className="text-[13px] text-orange-600">รอบันทึกข้อมูลล่าสุดขึ้นคลาวด์ ให้ครบก่อน ({pending} รายการ)</p>
            )}
            <Form form={form} layout="vertical" requiredMark={false}
                initialValues={{ label: nextRevisionLabel(used, headerRevision) }}>
                <Form.Item name="label" label="ชื่อฉบับแก้ไข" rules={RULES.revisionLabel}>
                    <Input placeholder="เช่น Rev.01" autoFocus />
                </Form.Item>
                <Form.Item name="note" label="หมายเหตุ (ไม่บังคับ)" rules={[{ max: 2000, message: 'ยาวได้ไม่เกิน 2000 ตัวอักษร' }]}>
                    <Input.TextArea rows={3} placeholder="เช่น ปรับราคาตามที่คุยกับเจ้าของบ้าน 20 ต.ค." />
                </Form.Item>
            </Form>
        </Modal>
    );
}

function RevisionList({ projectId, workspaceId }: { projectId: string; workspaceId: string }) {
    const revisions = useRevisions(projectId);
    const members = useMembers(workspaceId);
    const [openId, setOpenId] = useState<string | null>(null);

    if (revisions.isLoading) return <div className="flex justify-center p-10"><Spin /></div>;
    if (revisions.isError) return <div className="text-gray-600">{thaiErrorMessage(revisions.error)}</div>;
    const list = revisions.data ?? [];
    if (list.length === 0) return <Empty description="ยังไม่เคยออกฉบับแก้ไข" />;

    const nameOf = (userId: string) => members.data?.find(m => m.userId === userId)?.displayName ?? '';

    return (
        <div className="flex flex-col gap-3">
            {list.map((r: RevisionDto) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <Tag color="orange" className="!text-[13px] !font-semibold">{r.label}</Tag>
                        <span className="text-[12px] text-gray-500">{formatDateTime(r.createdAt)}{nameOf(r.createdBy) !== '' ? ` · ${nameOf(r.createdBy)}` : ''}</span>
                    </div>
                    <div className="mt-1 text-[18px] font-bold tabular-nums">
                        {formatNumber(r.totals.constructionTotal, 0)} <span className="text-[12px] font-normal text-gray-500">บาท</span>
                    </div>
                    {r.note !== null && r.note !== '' && <div className="text-[13px] text-gray-600 whitespace-pre-wrap">{r.note}</div>}
                    <div className="mt-2">
                        {openId === r.id
                            ? <RevisionExport projectId={projectId} revisionId={r.id} />
                            : <Button size="small" onClick={() => setOpenId(r.id)}>ส่งออกฉบับนี้</Button>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function RevisionExport({ projectId, revisionId }: { projectId: string; revisionId: string }) {
    const detail = useRevision(projectId, revisionId);
    if (detail.isLoading) return <Spin size="small" />;
    if (detail.isError) return <span className="text-[12px] text-red-500">{thaiErrorMessage(detail.error)}</span>;
    const snapshot = asProjectSnapshot(detail.data?.snapshot);
    if (!snapshot) return <span className="text-[12px] text-red-500">ข้อมูลฉบับแก้ไขนี้เปิดไม่ได้</span>;
    return <BoqExportButtons project={snapshot} size="small" />;
}
