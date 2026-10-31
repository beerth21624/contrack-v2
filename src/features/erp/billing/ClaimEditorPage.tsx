'use client';

// ─── /p/[projectId]/billing/claims/[claimId]: edit a claim, then submit → certify → invoice ───
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, Modal, Result, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { can, type ArClaimDto, type PatchArClaimRequest } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useContract } from '../contracts/hooks';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { ClaimLinesTable, type LineEdits } from './ClaimLinesTable';
import { DeductionsPanel, deductionsOf, type Deductions } from './DeductionsPanel';
import { useCancelClaim, useCertifyClaim, useClaim, useInvoiceClaim, usePatchClaim, useSubmitClaim } from './hooks';
import { CLAIM_STATUS_TONES, billingHref } from './status';

export function ClaimEditorPage({ projectId, claimId }: { projectId: string; claimId: string }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const q = useClaim(claimId);
    const crumbs = [{ label: t('title'), href: billingHref(projectId) }];

    if (q.isError) {
        return (
            <ErpPage breadcrumb={crumbs}>
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)} extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            </ErpPage>
        );
    }
    if (q.data === undefined) return <ErpPage breadcrumb={crumbs}><Skeleton active /></ErpPage>;
    // Remount when the server copy changes so the local edits restart from it.
    return <ClaimEditor key={q.data.updatedAt} claim={q.data} projectId={projectId} />;
}

function ClaimEditor({ claim, projectId }: { claim: ArClaimDto; projectId: string }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    const contract = useContract(claim.contractId);
    const canManage = can(ws.role, 'billing.manage');
    const patch = usePatchClaim(claim.id);
    const submit = useSubmitClaim(claim.id);
    const cancel = useCancelClaim(claim.id);
    const [edits, setEdits] = useState<LineEdits>({});
    const [ded, setDed] = useState<Deductions>(() => deductionsOf(claim));
    const [certify, setCertify] = useState(false);
    const [invoice, setInvoice] = useState(false);

    const dedDirty = JSON.stringify(ded) !== JSON.stringify(deductionsOf(claim));
    const dirty = Object.keys(edits).length > 0 || dedDirty;
    const editable = claim.canEdit && canManage;
    const progressMode = claim.mode === 'progress';
    const missingNote = claim.lines.some(l => {
        const e = edits[l.costCodeId];
        return e?.cum !== undefined && e.cum < l.prevProgress - 1e-9 && (e.note ?? l.note).trim() === '';
    });

    const buildPatch = (): PatchArClaimRequest => {
        const body: PatchArClaimRequest = {};
        const lines = claim.lines.flatMap(l => {
            const e = edits[l.costCodeId];
            if (e === undefined) return [];
            const note = e.note ?? l.note;
            return [{ costCodeId: l.costCodeId, cumProgress: e.cum ?? l.cumProgress, ...(note !== '' ? { note } : {}) }];
        });
        if (lines.length > 0) body.lines = lines;
        if (dedDirty) {
            body.periodFrom = ded.periodFrom === '' ? null : ded.periodFrom;
            body.periodTo = ded.periodTo === '' ? null : ded.periodTo;
            body.penaltyDays = ded.penaltyDays;
            body.penaltyOverride = ded.penaltyOverride;
            body.otherDeduction = ded.otherDeduction;
            body.otherDeductionNote = ded.otherDeductionNote;
            if (contract.data?.terms.escalation?.enabled === true) body.escalationIndices = ded.escalationIndices;
        }
        return body;
    };

    const save = async (): Promise<boolean> => {
        if (!dirty) return true;
        try {
            await patch.mutateAsync(buildPatch());
            return true;
        } catch (e) {
            void message.error(toText(e));
            return false;
        }
    };

    const doSubmit = async () => {
        if (!(await save())) return;
        try {
            const res = await submit.mutateAsync();
            void message.success(res.status === 'pending_approval' ? t('editor.pendingApproval') : t('editor.submitted'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <ErpPage
            title={<span className="flex flex-wrap items-center gap-2">{t('claims.claimNo', { no: claim.claimNo })}<StatusTag enumName="claimStatus" value={claim.status} tones={CLAIM_STATUS_TONES} /></span>}
            subtitle={claim.certifiedAt !== null ? <span>{t('editor.certifiedBy', { name: claim.certifiedByName })} · <DateText value={claim.certifiedAt} /></span> : undefined}
            breadcrumb={[{ label: t('title'), href: billingHref(projectId) }, { label: t('claims.claimNo', { no: claim.claimNo }) }]}
            extra={canManage ? (
                <>
                    {editable && (
                        <Button disabled={!dirty || missingNote} loading={patch.isPending}
                            onClick={() => { void save().then(ok => { if (ok) void message.success(t('editor.saved')); }); }}>{t('editor.save')}</Button>
                    )}
                    {claim.status === 'draft' && editable && (
                        <Button type="primary" disabled={missingNote} loading={submit.isPending} onClick={() => { void doSubmit(); }}>{t('editor.submit')}</Button>
                    )}
                    {claim.status === 'submitted' && <Button type="primary" disabled={dirty} onClick={() => setCertify(true)}>{t('editor.certify')}</Button>}
                    {claim.status === 'certified' && <Button type="primary" onClick={() => setInvoice(true)}>{t('editor.invoice')}</Button>}
                    {(claim.status === 'draft' || claim.status === 'pending_approval' || claim.status === 'submitted' || claim.status === 'certified') && (
                        <ConfirmAction danger title={t('editor.cancelConfirm')}
                            onConfirm={async () => { await cancel.mutateAsync(); void message.success(t('editor.cancelled')); router.push(billingHref(projectId)); }}>
                            {t('editor.cancel')}
                        </ConfirmAction>
                    )}
                </>
            ) : undefined}
        >
            {claim.status === 'pending_approval' && (
                <Alert type="info" showIcon title={t('editor.pendingApproval')} action={<Button size="small" onClick={() => router.push('/approvals')}>{t('editor.openApprovals')}</Button>} />
            )}
            {claim.status === 'invoiced' && claim.invoiceId !== null && (
                <Alert type="success" showIcon title={t('editor.invoiced')} action={<Button size="small" onClick={() => router.push(billingHref(projectId))}>{t('editor.openInvoices')}</Button>} />
            )}
            {missingNote && <Alert type="warning" showIcon title={t('editor.noteNeeded')} />}
            {claim.certifiedNote !== '' && <Alert type="info" title={claim.certifiedNote} />}

            <SectionCard title={t('lines.title')}>
                {claim.mode === 'milestone' && <div className="mb-3 text-[13px] text-gray-500">{t('lines.milestoneHint')}</div>}
                <ClaimLinesTable lines={claim.lines} editable={editable && progressMode} edits={edits}
                    onEdit={(id, p) => setEdits(s => ({ ...s, [id]: { ...s[id], ...p } }))} />
            </SectionCard>
            <SectionCard title={t('deductions.title')}>
                <DeductionsPanel claim={claim} escalation={contract.data?.terms.escalation ?? null} value={ded} onChange={setDed} disabled={!editable} />
                {dirty && <div className="mt-3 text-[13px] text-amber-600">{t('editor.unsaved')}</div>}
            </SectionCard>

            {certify && <CertifyDialog claimId={claim.id} onClose={() => setCertify(false)} />}
            {invoice && <InvoiceDialog claimId={claim.id} projectId={projectId} onClose={() => setInvoice(false)} />}
        </ErpPage>
    );
}

function CertifyDialog({ claimId, onClose }: { claimId: string; onClose: () => void }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const certify = useCertifyClaim(claimId);
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [note, setNote] = useState('');

    const submit = async () => {
        try {
            await certify.mutateAsync({ certifiedByName: name.trim(), ...(date !== '' ? { certifiedAt: date } : {}), ...(note.trim() !== '' ? { note: note.trim() } : {}) });
            void message.success(t('certify.done'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('certify.title')} okText={t('certify.submit')} confirmLoading={certify.isPending} okButtonProps={{ disabled: name.trim() === '' }}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-2 text-[13px] text-gray-500">{t('certify.hint')}</div>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('certify.by')}
                    <Input maxLength={200} value={name} onChange={e => setName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('certify.date')}
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('certify.note')}
                    <Input.TextArea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function InvoiceDialog({ claimId, projectId, onClose }: { claimId: string; projectId: string; onClose: () => void }) {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const invoice = useInvoiceClaim(claimId);
    const [issueDate, setIssueDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [note, setNote] = useState('');
    const datesBad = issueDate !== '' && dueDate !== '' && dueDate < issueDate;

    const submit = async () => {
        try {
            const inv = await invoice.mutateAsync({
                ...(issueDate !== '' ? { issueDate } : {}), ...(dueDate !== '' ? { dueDate } : {}), ...(note.trim() !== '' ? { note: note.trim() } : {}),
            });
            void message.success(t('invoiceDialog.done', { number: inv.number ?? '' }));
            router.push(billingHref(projectId));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t('invoiceDialog.title')} okText={t('invoiceDialog.submit')} confirmLoading={invoice.isPending} okButtonProps={{ disabled: datesBad }}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-2 text-[13px] text-gray-500">{t('invoiceDialog.hint')}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('fields.issueDate')}
                    <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('fields.dueDate')}
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </label>
            </div>
            {datesBad && <div className="mt-2 text-[13px] text-red-600">{t('claims.datesOrder')}</div>}
            <label className="mt-3 flex flex-col gap-1 text-[13px] text-gray-600">{t('invoiceDialog.note')}
                <Input.TextArea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} />
            </label>
        </Modal>
    );
}
