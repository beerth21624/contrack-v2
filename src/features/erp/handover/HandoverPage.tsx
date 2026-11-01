'use client';

// ─── /p/[projectId]/handover: the handover (schedule → inspect → customer accepts → paper) and the warranty (countdown, claims) ───
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, App, Button, Descriptions, Input, Modal, Select, Skeleton, Tabs } from 'antd';
import { DeleteOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DOC_LANGUAGES, can, type DocLanguage, type HandoverAttendee, type HandoverChecklistItem, type HandoverContractInfo, type HandoverDto, type WarrantyClaimDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { HandoverChecklist } from './HandoverChecklist';
import { HandoverDocuments } from './HandoverDocuments';
import {
    useAcceptHandover, useCreateHandover, useInspectHandover, usePatchHandover, useProjectHandover, useProjectWarranty, useRejectHandover,
    useScheduleHandover, useWarrantyClaims,
} from './hooks';
import { HANDOVER_STATUS_TONES, handoverPrintHref, todayBangkok } from './status';
import { WarrantyClaimDrawer } from './WarrantyClaimDrawer';
import { WarrantyClaimsTable } from './WarrantyClaimsTable';
import { WarrantyCountdown } from './WarrantyCountdown';

const label = 'flex flex-col gap-1 text-[13px] text-gray-600';

function useRun() {
    const { message } = App.useApp();
    const toText = useErrorMessage();
    return async (fn: () => Promise<unknown>, done?: string): Promise<boolean> => {
        try {
            await fn();
            if (done !== undefined) void message.success(done);
            return true;
        } catch (e) {
            void message.error(toText(e));
            return false;
        }
    };
}

// ── dialogs ──

function AttendeesEditor({ value, onChange }: { value: HandoverAttendee[]; onChange: (v: HandoverAttendee[]) => void }) {
    const t = useTranslations('handover');
    const set = (i: number, patch: Partial<HandoverAttendee>) => onChange(value.map((a, k) => (k === i ? { ...a, ...patch } : a)));
    return (
        <div className="flex flex-col gap-2">
            {value.map((a, i) => (
                <div key={i} className="flex gap-2">
                    <Input value={a.name} maxLength={200} placeholder={t('attendees.name')} onChange={e => set(i, { name: e.target.value })} />
                    <Input value={a.role} maxLength={200} placeholder={t('attendees.role')} onChange={e => set(i, { role: e.target.value })} />
                    <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('attendees.remove')} onClick={() => onChange(value.filter((_, k) => k !== i))} />
                </div>
            ))}
            <div><Button icon={<PlusOutlined />} onClick={() => onChange([...value, { name: '', role: '' }])}>{t('attendees.add')}</Button></div>
        </div>
    );
}

function ScheduleDialog({ projectId, dto, onClose }: { projectId: string; dto: HandoverDto; onClose: () => void }) {
    const t = useTranslations('handover');
    const run = useRun();
    const schedule = useScheduleHandover(projectId, dto.id);
    const [date, setDate] = useState(dto.scheduledDate ?? '');
    const [attendees, setAttendees] = useState<HandoverAttendee[]>(dto.attendees);
    return (
        <Modal open title={t('dialogs.schedule.title')} okText={t('actions.schedule')} okButtonProps={{ disabled: date === '' }} confirmLoading={schedule.isPending}
            onCancel={onClose} destroyOnHidden
            onOk={() => {
                void run(() => schedule.mutateAsync({ scheduledDate: date, attendees: attendees.filter(a => a.name.trim() !== '').map(a => ({ name: a.name.trim(), role: a.role.trim() })) }), t('dialogs.schedule.done'))
                    .then(ok => { if (ok) onClose(); });
            }}>
            <div className="flex flex-col gap-3">
                <label className={label}>{t('fields.scheduledDate')}
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </label>
                <div className={label}>{t('fields.attendees')}
                    <AttendeesEditor value={attendees} onChange={setAttendees} />
                </div>
            </div>
        </Modal>
    );
}

function InspectDialog({ projectId, dto, checklist, onClose }: { projectId: string; dto: HandoverDto; checklist: HandoverChecklistItem[]; onClose: () => void }) {
    const t = useTranslations('handover');
    const run = useRun();
    const inspect = useInspectHandover(projectId, dto.id);
    const [date, setDate] = useState(dto.inspectionDate ?? todayBangkok());
    const [defects, setDefects] = useState(dto.defectsNote);
    const fixes = checklist.filter(c => c.status === 'fix').length;
    return (
        <Modal open title={t('dialogs.inspect.title')} okText={t('actions.inspect')} confirmLoading={inspect.isPending} onCancel={onClose} destroyOnHidden
            onOk={() => {
                void run(() => inspect.mutateAsync({ inspectionDate: date, checklist, defectsNote: defects.trim() }), t('dialogs.inspect.done'))
                    .then(ok => { if (ok) onClose(); });
            }}>
            <div className="flex flex-col gap-3">
                {fixes > 0 && <Alert type="warning" showIcon title={t('dialogs.inspect.fixes', { count: fixes })} />}
                <label className={label}>{t('fields.inspectionDate')}
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </label>
                <label className={label}>{t('fields.defectsNote')}
                    <Input.TextArea rows={3} maxLength={5000} value={defects} onChange={e => setDefects(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function AcceptDialog({ projectId, dto, onClose }: { projectId: string; dto: HandoverDto; onClose: () => void }) {
    const t = useTranslations('handover');
    const run = useRun();
    const accept = useAcceptHandover(projectId, dto.id);
    const [name, setName] = useState(dto.acceptedByName);
    const [date, setDate] = useState(dto.inspectionDate ?? todayBangkok());
    return (
        <Modal open title={t('dialogs.accept.title')} okText={t('actions.accept')} okButtonProps={{ disabled: name.trim() === '' }} confirmLoading={accept.isPending}
            onCancel={onClose} destroyOnHidden
            onOk={() => {
                void run(() => accept.mutateAsync({ acceptedByName: name.trim(), ...(date !== '' ? { handoverDate: date } : {}) }), t('dialogs.accept.done'))
                    .then(ok => { if (ok) onClose(); });
            }}>
            <div className="flex flex-col gap-3">
                <Alert type="info" showIcon title={t('dialogs.accept.hint')} />
                <label className={label}>{t('fields.acceptedByName')}
                    <Input maxLength={200} value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label className={label}>{t('fields.handoverDate')}
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function RejectDialog({ projectId, dto, onClose }: { projectId: string; dto: HandoverDto; onClose: () => void }) {
    const t = useTranslations('handover');
    const run = useRun();
    const reject = useRejectHandover(projectId, dto.id);
    const [note, setNote] = useState(dto.defectsNote);
    return (
        <Modal open title={t('dialogs.reject.title')} okText={t('actions.reject')} okButtonProps={{ danger: true }} confirmLoading={reject.isPending}
            onCancel={onClose} destroyOnHidden
            onOk={() => { void run(() => reject.mutateAsync({ defectsNote: note.trim() }), t('dialogs.reject.done')).then(ok => { if (ok) onClose(); }); }}>
            <label className={label}>{t('fields.defectsNote')}
                <Input.TextArea rows={4} maxLength={5000} value={note} onChange={e => setNote(e.target.value)} />
            </label>
        </Modal>
    );
}

// ── the handover ──

type Dialog = 'schedule' | 'inspect' | 'accept' | 'reject' | null;

/** Keyed by `dto.updatedAt` so the checklist draft starts again from the saved one after every change. */
function HandoverDetail({ projectId, dto, contract, workspaceId }: {
    projectId: string; dto: HandoverDto; contract: HandoverContractInfo | null; workspaceId: string | undefined;
}) {
    const t = useTranslations('handover');
    const run = useRun();
    const patch = usePatchHandover(projectId, dto.id);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [checklist, setChecklist] = useState<HandoverChecklistItem[]>(dto.checklist);
    const dirty = JSON.stringify(checklist) !== JSON.stringify(dto.checklist);
    const encoded = encodeURIComponent(projectId);

    const actions = (
        <>
            <Link href={handoverPrintHref(projectId, dto.id)} target="_blank">
                <Button icon={<PrinterOutlined />}>{t('actions.print')}</Button>
            </Link>
            {dto.canSchedule && (
                <Button type={dto.status === 'draft' || dto.status === 'rejected' ? 'primary' : 'default'} onClick={() => setDialog('schedule')}>
                    {dto.status === 'draft' || dto.status === 'rejected' ? t('actions.schedule') : t('actions.reschedule')}
                </Button>
            )}
            {dto.canInspect && <Button type="primary" onClick={() => setDialog('inspect')}>{t('actions.inspect')}</Button>}
            {dto.canAccept && <Button type="primary" onClick={() => setDialog('accept')}>{t('actions.accept')}</Button>}
            {dto.canReject && <Button danger onClick={() => setDialog('reject')}>{t('actions.reject')}</Button>}
        </>
    );

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {dto.status === 'rejected' && <Alert type="error" showIcon title={t('banners.rejected')} description={dto.defectsNote !== '' ? dto.defectsNote : undefined} />}
            {dto.status === 'accepted' && <Alert type="success" showIcon title={t('banners.accepted', { name: dto.acceptedByName })} />}
            <SectionCard title={<span className="flex flex-wrap items-center gap-2">{t('summary.title')} <StatusTag enumName="handoverStatus" value={dto.status} tones={HANDOVER_STATUS_TONES} /></span>} extra={actions}>
                <Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
                    { key: 'no', label: t('fields.number'), children: <DocumentNumberTag number={dto.number} /> },
                    { key: 'contract', label: t('fields.contract'), children: contract?.number ?? '–' },
                    { key: 'sch', label: t('fields.scheduledDate'), children: <DateText value={dto.scheduledDate} /> },
                    { key: 'insp', label: t('fields.inspectionDate'), children: <DateText value={dto.inspectionDate} /> },
                    { key: 'ho', label: t('fields.handoverDate'), children: <DateText value={dto.handoverDate} /> },
                    { key: 'by', label: t('fields.acceptedByName'), children: dto.acceptedByName !== '' ? dto.acceptedByName : '–' },
                    { key: 'warranty', label: t('fields.warrantyMonths'), children: contract !== null ? t('fields.warrantyMonthsValue', { months: contract.warrantyMonths }) : '–' },
                    {
                        key: 'lang', label: t('fields.language'),
                        children: dto.canEdit ? (
                            <Select<DocLanguage> size="small" className="min-w-28" value={dto.language} loading={patch.isPending}
                                options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))}
                                onChange={l => { void run(() => patch.mutateAsync({ language: l })); }} />
                        ) : t(`languages.${dto.language}`),
                    },
                    {
                        key: 'att', label: t('fields.attendees'), span: 'filled',
                        children: dto.attendees.length === 0 ? '–' : dto.attendees.map(a => (a.role !== '' ? `${a.name} (${a.role})` : a.name)).join(', '),
                    },
                ]} />
            </SectionCard>
            <SectionCard
                title={t('checklist.title')}
                extra={dirty && dto.canEdit && (
                    <>
                        <Button onClick={() => setChecklist(dto.checklist)}>{t('checklist.discard')}</Button>
                        <Button type="primary" loading={patch.isPending} onClick={() => { void run(() => patch.mutateAsync({ checklist }), t('checklist.saved')); }}>{t('checklist.save')}</Button>
                    </>
                )}
            >
                <HandoverChecklist items={checklist} onChange={setChecklist} editable={dto.canEdit} />
            </SectionCard>
            <SectionCard title={t('documents.title')}>
                <HandoverDocuments projectId={projectId} dto={dto} workspaceId={workspaceId} />
            </SectionCard>
            {dto.status === 'accepted' && (
                <SectionCard title={t('afterHandover.title')}>
                    <div className="mb-3 text-[13px] text-gray-600">{t('afterHandover.hint')}</div>
                    <div className="flex flex-wrap gap-2">
                        <Link href={`/p/${encoded}/billing`}><Button>{t('afterHandover.releaseRetention')}</Button></Link>
                        <Link href={`/p/${encoded}/contract`}><Button>{t('afterHandover.releaseGuarantee')}</Button></Link>
                    </div>
                </SectionCard>
            )}
            {dialog === 'schedule' && <ScheduleDialog projectId={projectId} dto={dto} onClose={() => setDialog(null)} />}
            {dialog === 'inspect' && <InspectDialog projectId={projectId} dto={dto} checklist={checklist} onClose={() => setDialog(null)} />}
            {dialog === 'accept' && <AcceptDialog projectId={projectId} dto={dto} onClose={() => setDialog(null)} />}
            {dialog === 'reject' && <RejectDialog projectId={projectId} dto={dto} onClose={() => setDialog(null)} />}
        </div>
    );
}

function HandoverTab({ projectId, workspaceId }: { projectId: string; workspaceId: string | undefined }) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const run = useRun();
    const q = useProjectHandover(projectId);
    const create = useCreateHandover(projectId);

    if (q.isLoading) return <Skeleton active />;
    if (q.isError || q.data === undefined) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const { handover, contract, canCreate } = q.data;
    if (handover !== null) {
        return <HandoverDetail key={handover.updatedAt} projectId={projectId} dto={handover} contract={contract} workspaceId={workspaceId} />;
    }
    const createButton = canCreate ? (
        <Button type="primary" icon={<PlusOutlined />} loading={create.isPending}
            onClick={() => { void run(() => create.mutateAsync(contract !== null ? { language: contract.language } : {}), t('create.done')); }}>
            {t('create.submit')}
        </Button>
    ) : undefined;
    return (
        <div className="flex min-w-0 flex-col gap-4">
            {contract?.status !== 'signed' && <Alert type="info" showIcon title={t('create.needsContract')} />}
            <SectionCard title={t('summary.title')}>
                <EmptyState title={t('empty.title')} hint={t('empty.hint')} action={createButton} />
            </SectionCard>
        </div>
    );
}

// ── the warranty ──

function WarrantyTab({ projectId, workspaceId, canManage }: { projectId: string; workspaceId: string | undefined; canManage: boolean }) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const warranty = useProjectWarranty(projectId);
    const claims = useWarrantyClaims(projectId);
    const [openId, setOpenId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);

    if (warranty.isLoading || claims.isLoading) return <Skeleton active />;
    const err: unknown = warranty.error ?? claims.error;
    if (err !== null && err !== undefined) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(err)}`}
                action={<Button size="small" onClick={() => { void warranty.refetch(); void claims.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const w = warranty.data?.warranty ?? null;
    const rows = claims.data?.items ?? [];
    const current: WarrantyClaimDto | null = rows.find(c => c.id === openId) ?? null;
    const newButton = canManage && w !== null && w.status !== 'closed'
        ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>{t('claims.create.open')}</Button>
        : undefined;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title={t('warranty.title')}>
                {w === null ? <EmptyState title={t('warranty.none.title')} hint={t('warranty.none.hint')} /> : <WarrantyCountdown warranty={w} />}
            </SectionCard>
            <SectionCard title={t('claims.title')} extra={newButton}>
                {rows.length === 0 ? (
                    <EmptyState title={t('claims.empty.title')} hint={w === null ? t('claims.empty.noWarranty') : t('claims.empty.hint')} action={newButton} />
                ) : (
                    <WarrantyClaimsTable claims={rows} onOpen={c => setOpenId(c.id)} />
                )}
            </SectionCard>
            <WarrantyClaimDrawer projectId={projectId} workspaceId={workspaceId} claim={current} creating={creating}
                onClose={() => { setCreating(false); setOpenId(null); }} />
        </div>
    );
}

// ── page ──

const TAB_KEYS = ['handover', 'warranty'] as const;
type TabKey = typeof TAB_KEYS[number];

function HandoverTabs({ projectId }: { projectId: string }) {
    const t = useTranslations('handover');
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    // `?tab=warranty` (portal task / hub alert links)
    const wanted = useSearchParams().get('tab');
    const [tab, setTab] = useState<TabKey>(() => TAB_KEYS.find(k => k === wanted) ?? 'handover');
    return (
        <Tabs
            activeKey={tab}
            onChange={k => setTab(k as TabKey)}
            items={[
                { key: 'handover', label: t('tabs.handover'), children: <HandoverTab projectId={projectId} workspaceId={ws.workspaceId} /> },
                { key: 'warranty', label: t('tabs.warranty'), children: <WarrantyTab projectId={projectId} workspaceId={ws.workspaceId} canManage={can(ws.role, 'handover.manage')} /> },
            ]}
        />
    );
}

export function HandoverPage({ projectId }: { projectId: string }) {
    return (
        <Suspense fallback={<Skeleton active />}>
            <HandoverTabs projectId={projectId} />
        </Suspense>
    );
}
