'use client';

// ─── "Issue revision" + the list of revisions of the open cloud project (nothing in guest mode) ───
// A revision is a frozen copy of the whole project (what was sent to the owner). Each one can be exported again.
import { useState } from 'react';
import Link from 'next/link';
import { App, Button, Drawer, Empty, Form, Input, Modal, Space, Spin, Tag } from 'antd';
import { DiffOutlined, HistoryOutlined, SnippetsOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Project } from '@/domain/project';
import { formatNumber } from '@/components/sheet/NumberCell';
import { BoqExportButtons } from '@/features/export/BoqExportButtons';
import { useActiveModules } from '@/features/modules/modules';
import { useProjectStore } from '@/store/project-store';
import type { RevisionDto } from '@/shared/contract';
import { useErrorMessage } from '../api/error-message';
import { useRules } from '../auth/use-rules';
import { can } from '../permissions';
import { useCreateRevision, useMembers, useRevision, useRevisions } from '../query/hooks';
import { useCloud } from '../state';
import { useDateTime } from '../ui/common';

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
    const tBoq = useTranslations('boqControl');
    const t = useTranslations('cloud.revisions');
    // ERP: the BOQ history page (versions + compare) while boq-control is active; nothing changes otherwise.
    const historyOn = useActiveModules(cloud?.workspaceId).has('boq-control');

    if (!cloud) return null;
    const count = revisions.data?.length ?? 0;

    return (
        <>
            <Space wrap size={8}>
                {can(cloud.role, 'revisions.create') && (
                    <Button size={size} icon={<SnippetsOutlined />} onClick={() => setCreateOpen(true)}>{t('create')}</Button>
                )}
                <Button size={size} type="text" icon={<HistoryOutlined />} onClick={() => setListOpen(true)}>
                    {t('all')}{count > 0 ? ` (${String(count)})` : ''}
                </Button>
                {historyOn && (
                    <Link href={`/p/${encodeURIComponent(cloud.projectId)}/versions`}>
                        <Button size={size} type="text" icon={<DiffOutlined />}>{tBoq('openHistory')}</Button>
                    </Link>
                )}
            </Space>
            <CreateRevisionModal open={createOpen} projectId={cloud.projectId} used={(revisions.data ?? []).map(r => r.label)}
                onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); setListOpen(true); }} />
            <Drawer open={listOpen} onClose={() => setListOpen(false)} title={t('drawerTitle')} size={420}>
                <RevisionList projectId={cloud.projectId} workspaceId={cloud.workspaceId} />
            </Drawer>
        </>
    );
}

function CreateRevisionModal({ open, projectId, used, onClose, onCreated }: {
    open: boolean; projectId: string; used: string[]; onClose: () => void; onCreated: () => void;
}) {
    const { message } = App.useApp();
    const t = useTranslations('cloud.revisions');
    const tc = useTranslations('cloud.shared');
    const rules = useRules();
    const toText = useErrorMessage();
    const headerRevision = useProjectStore(s => s.project.meta.revision);
    const pending = useCloud(s => s.syncStatus.count);
    const create = useCreateRevision(projectId);
    const [form] = Form.useForm<{ label: string; note?: string }>();

    const submit = async () => {
        const values = await form.validateFields();
        try {
            const note = values.note?.trim();
            await create.mutateAsync({ label: values.label.trim(), note: note === undefined || note === '' ? undefined : note });
            void message.success(t('issued', { label: values.label.trim() }));
            form.resetFields();
            onCreated();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open={open} onCancel={onClose} destroyOnHidden title={t('create')} okText={t('create')} cancelText={tc('cancel')}
            confirmLoading={create.isPending} okButtonProps={{ disabled: pending > 0 }}
            onOk={() => { void submit().catch(() => undefined); }}>
            <p className="text-[13px] text-gray-600">
                {t('note')}
            </p>
            {pending > 0 && (
                <p className="text-[13px] text-orange-600">{t('waiting', { pending })}</p>
            )}
            <Form form={form} layout="vertical" requiredMark={false}
                initialValues={{ label: nextRevisionLabel(used, headerRevision) }}>
                <Form.Item name="label" label={t('nameLabel')} rules={rules.revisionLabel}>
                    <Input placeholder={t('namePlaceholder')} autoFocus />
                </Form.Item>
                <Form.Item name="note" label={t('noteLabel')} rules={[{ max: 2000, message: t('noteMax') }]}>
                    <Input.TextArea rows={3} placeholder={t('notePlaceholder')} />
                </Form.Item>
            </Form>
        </Modal>
    );
}

function RevisionList({ projectId, workspaceId }: { projectId: string; workspaceId: string }) {
    const t = useTranslations('cloud.revisions');
    const tc = useTranslations('cloud.shared');
    const toText = useErrorMessage();
    const dateTime = useDateTime();
    const revisions = useRevisions(projectId);
    const members = useMembers(workspaceId);
    const [openId, setOpenId] = useState<string | null>(null);

    if (revisions.isLoading) return <div className="flex justify-center p-10"><Spin /></div>;
    if (revisions.isError) return <div className="text-gray-600">{toText(revisions.error)}</div>;
    const list = revisions.data ?? [];
    if (list.length === 0) return <Empty description={t('empty')} />;

    const nameOf = (userId: string) => members.data?.find(m => m.userId === userId)?.displayName ?? '';

    return (
        <div className="flex flex-col gap-3">
            {list.map((r: RevisionDto) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2">
                        <Tag color="orange" className="!text-[13px] !font-semibold">{r.label}</Tag>
                        <span className="text-[12px] text-gray-500">{dateTime(r.createdAt)}{nameOf(r.createdBy) !== '' ? ` · ${nameOf(r.createdBy)}` : ''}</span>
                    </div>
                    <div className="mt-1 text-[18px] font-bold tabular-nums">
                        {formatNumber(r.totals.constructionTotal, 0)} <span className="text-[12px] font-normal text-gray-500">{tc('baht')}</span>
                    </div>
                    {r.note !== null && r.note !== '' && <div className="text-[13px] text-gray-600 whitespace-pre-wrap">{r.note}</div>}
                    <div className="mt-2">
                        {openId === r.id
                            ? <RevisionExport projectId={projectId} revisionId={r.id} />
                            : <Button size="small" onClick={() => setOpenId(r.id)}>{t('exportThis')}</Button>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function RevisionExport({ projectId, revisionId }: { projectId: string; revisionId: string }) {
    const t = useTranslations('cloud.revisions');
    const toText = useErrorMessage();
    const detail = useRevision(projectId, revisionId);
    if (detail.isLoading) return <Spin size="small" />;
    if (detail.isError) return <span className="text-[12px] text-red-500">{toText(detail.error)}</span>;
    const snapshot = asProjectSnapshot(detail.data?.snapshot);
    if (!snapshot) return <span className="text-[12px] text-red-500">{t('unreadable')}</span>;
    return <BoqExportButtons project={snapshot} size="small" />;
}
