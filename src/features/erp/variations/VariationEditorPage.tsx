'use client';

// ─── /p/[projectId]/variations/[variationId]: a VO — details, lines (manual + from the calculators), evidence, workflow ───
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Input, InputNumber, Modal, Select, Skeleton } from 'antd';
import { PrinterOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    DOC_LANGUAGES, VARIATION_REASONS, VARIATION_RESPONSE_ACTIONS, can, type ContractVariationBilling, type DocLanguage,
    type PatchVariationOrderRequest, type VariationOrderDto, type VariationReason, type VariationResponseAction,
} from '@/shared/contract';
import { round2 } from '@/domain/money';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useContract } from '../contracts/hooks';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { ShareLinkButton } from '../shared/ShareLinkButton';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { EvidencePanel } from './EvidencePanel';
import {
    useCancelVariation, usePatchVariation, useRecordVariationResponse, useSubmitVariation, useVariation, useWithdrawVariation,
} from './hooks';
import { SandboxLauncher } from './SandboxLauncher';
import { VARIATION_STATUS_TONES } from './status';
import { billingOptions } from './VariationsPage';
import { VoLinesTable } from './VoLinesTable';

interface DetailsForm {
    title: string;
    requestedByName: string;
    reason: VariationReason;
    requestedDate: string;
    billing: ContractVariationBilling;
    scheduleImpactDays: number;
    language: DocLanguage;
}

const formOf = (v: VariationOrderDto): DetailsForm => ({
    title: v.title, requestedByName: v.requestedByName, reason: v.reason, requestedDate: v.requestedDate ?? '', billing: v.billing,
    scheduleImpactDays: v.scheduleImpactDays, language: v.language,
});

function patchOf(form: DetailsForm, v: VariationOrderDto): PatchVariationOrderRequest {
    const base = formOf(v);
    const p: PatchVariationOrderRequest = {};
    if (form.title.trim() !== base.title) p.title = form.title.trim();
    if (form.requestedByName.trim() !== base.requestedByName) p.requestedByName = form.requestedByName.trim();
    if (form.reason !== base.reason) p.reason = form.reason;
    if (form.requestedDate !== base.requestedDate) p.requestedDate = form.requestedDate === '' ? null : form.requestedDate;
    if (form.billing !== base.billing) p.billing = form.billing;
    if (form.scheduleImpactDays !== base.scheduleImpactDays) p.scheduleImpactDays = form.scheduleImpactDays;
    if (form.language !== base.language) p.language = form.language;
    return p;
}

function DetailsCard({ dto, editable, billingMode }: { dto: VariationOrderDto; editable: boolean; billingMode: string | undefined }) {
    const t = useTranslations('variations');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchVariation(dto.id);
    const [form, setForm] = useState<DetailsForm>(() => formOf(dto));
    const serverKey = JSON.stringify(formOf(dto));
    const [base, setBase] = useState(serverKey);
    // The details changed on the server (saved here, or by someone else): start again from them.
    if (base !== serverKey) {
        setBase(serverKey);
        setForm(formOf(dto));
    }
    const body = patchOf(form, dto);
    const dirty = Object.keys(body).length > 0;
    const invalid = form.title.trim() === '' || form.requestedByName.trim() === '';
    const set = (p: Partial<DetailsForm>) => setForm(f => ({ ...f, ...p }));

    const save = async () => {
        try {
            await patch.mutateAsync(body);
            void message.success(t('details.saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    if (!editable) {
        const row = (label: string, value: ReactNode) => (
            <div className="flex min-w-0 flex-col"><span className="text-[12px] text-gray-500">{label}</span><span className="break-words">{value}</span></div>
        );
        return (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {row(t('fields.requestedByName'), dto.requestedByName)}
                {row(t('fields.requestedDate'), <DateText value={dto.requestedDate} />)}
                {row(t('fields.reason'), te(`variationReason.${dto.reason}`))}
                {row(t('fields.billing'), te(`variationBilling.${dto.billing}`))}
                {row(t('fields.scheduleImpactDays'), t('details.days', { days: dto.scheduleImpactDays }))}
                {row(t('fields.language'), t(`languages.${dto.language}`))}
            </div>
        );
    }

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2 lg:col-span-3">
                    {t('fields.title')}
                    <Input value={form.title} maxLength={200} status={form.title.trim() === '' ? 'error' : undefined} onChange={e => set({ title: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.requestedByName')}
                    <Input value={form.requestedByName} maxLength={200} status={form.requestedByName.trim() === '' ? 'error' : undefined}
                        onChange={e => set({ requestedByName: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.requestedDate')}
                    <Input type="date" value={form.requestedDate} onChange={e => set({ requestedDate: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.reason')}
                    <Select value={form.reason} onChange={(reason: VariationReason) => set({ reason })}
                        options={VARIATION_REASONS.map(r => ({ value: r, label: te(`variationReason.${r}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.billing')}
                    <Select value={form.billing} onChange={(billing: ContractVariationBilling) => set({ billing })}
                        options={billingOptions(billingMode).map(b => ({ value: b, label: te(`variationBilling.${b}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.scheduleImpactDays')}
                    <InputNumber<number> className="!w-full" value={form.scheduleImpactDays} min={-3650} max={3650} precision={0}
                        onChange={v => set({ scheduleImpactDays: v ?? 0 })} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.language')}
                    <Select value={form.language} onChange={(language: DocLanguage) => set({ language })}
                        options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                </label>
            </div>
            <div>
                <Button type="primary" icon={<SaveOutlined />} disabled={!dirty || invalid} loading={patch.isPending} onClick={() => { void save(); }}>
                    {t('details.save')}
                </Button>
            </div>
        </div>
    );
}

function ResponseDialog({ variationId, open, onClose }: { variationId: string; open: boolean; onClose: () => void }) {
    const t = useTranslations('variations');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const record = useRecordVariationResponse(variationId);
    const [action, setAction] = useState<VariationResponseAction>('accept');
    const [name, setName] = useState('');
    const [note, setNote] = useState('');

    const submit = async () => {
        try {
            await record.mutateAsync({ action, name: name.trim(), ...(note.trim() !== '' ? { note } : {}) });
            void message.success(t('response.done'));
            setName('');
            setNote('');
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open={open} title={t('response.title')} onCancel={onClose} okText={t('response.submit')} confirmLoading={record.isPending}
            okButtonProps={{ disabled: name.trim() === '' }} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="mb-3 text-[13px] text-gray-500">{t('response.hint')}</div>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.action')}
                    <Select value={action} onChange={setAction} options={VARIATION_RESPONSE_ACTIONS.map(a => ({ value: a, label: t(`response.actions.${a}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.name')}
                    <Input value={name} maxLength={200} onChange={e => setName(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('response.note')}
                    <Input.TextArea rows={3} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function Totals({ dto }: { dto: VariationOrderDto }) {
    const t = useTranslations('variations');
    const row = (label: string, value: number | undefined, strong = false) => (
        <div className={`flex items-baseline justify-between gap-3 ${strong ? 'border-t border-gray-200 pt-2 font-semibold' : ''}`}>
            <span className="text-gray-600">{label}</span>
            <MoneyText value={value} className={strong ? 'text-[16px]' : ''} />
        </div>
    );
    return (
        <div className="flex flex-col gap-2 text-[14px]">
            {dto.costTotal !== undefined && row(t('totals.cost'), dto.costTotal)}
            {row(t('totals.sell'), dto.sellTotal)}
            {row(t('totals.vat'), dto.vat)}
            {row(t('totals.grand'), round2(dto.sellTotal + dto.vat), true)}
            <div className="flex items-baseline justify-between gap-3">
                <span className="text-gray-600">{t('totals.days')}</span>
                <span className="tabular-nums">{t('details.days', { days: dto.scheduleImpactDays })}</span>
            </div>
        </div>
    );
}

function Editor({ dto }: { dto: VariationOrderDto }) {
    const t = useTranslations('variations');
    const { message } = App.useApp();
    const hub = useHubProject(dto.projectId);
    const workspaceId = hub.data?.project.workspaceId;
    const ws = useErpWorkspace(workspaceId);
    const contract = useContract(dto.contractId);
    const mayManage = can(ws.role, 'variations.manage');
    const editable = dto.canEdit;
    const evidenceEditable = mayManage && (dto.status === 'draft' || dto.status === 'pending_approval' || dto.status === 'submitted');
    const submit = useSubmitVariation(dto.id);
    const withdraw = useWithdrawVariation(dto.id);
    const cancel = useCancelVariation(dto.id);
    const [responseOpen, setResponseOpen] = useState(false);
    const answered = dto.status === 'accepted' || dto.status === 'rejected' ? dto.status : null;

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={(
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{t('seq', { no: dto.seqNo })} · {dto.title}</span>
                        <DocumentNumberTag number={dto.number} />
                        <StatusTag enumName="variationStatus" value={dto.status} tones={VARIATION_STATUS_TONES} />
                    </span>
                )}
                extra={(
                    <div className="flex flex-wrap items-center gap-2">
                        {dto.status !== 'cancelled' && (
                            <Button icon={<PrinterOutlined />} href={`/print/variation/${encodeURIComponent(dto.id)}`} target="_blank">{t('print')}</Button>
                        )}
                        {dto.status === 'submitted' && mayManage && workspaceId !== undefined && (
                            <ShareLinkButton workspaceId={workspaceId} subjectType="variation" subjectId={dto.id} />
                        )}
                        {dto.status === 'submitted' && mayManage && <Button onClick={() => setResponseOpen(true)}>{t('response.button')}</Button>}
                        {(dto.status === 'submitted' || dto.status === 'pending_approval') && mayManage && (
                            <ConfirmAction title={t('withdraw.confirm')} onConfirm={async () => { await withdraw.mutateAsync(); void message.success(t('withdraw.done')); }}>
                                {t('withdraw.button')}
                            </ConfirmAction>
                        )}
                        {(dto.status === 'draft' || dto.status === 'pending_approval') && mayManage && (
                            <ConfirmAction danger title={t('cancel.confirm')} onConfirm={async () => { await cancel.mutateAsync(); void message.success(t('cancel.done')); }}>
                                {t('cancel.button')}
                            </ConfirmAction>
                        )}
                        {editable && (
                            <ConfirmAction type="primary" icon={<SendOutlined />} title={t('submit.confirm')} content={t('submit.hint')}
                                disabled={dto.lines.length === 0}
                                onConfirm={async () => {
                                    const v = await submit.mutateAsync();
                                    void message.success(v.status === 'pending_approval' ? t('submit.pending') : t('submit.done'));
                                }}>
                                {t('submit.button')}
                            </ConfirmAction>
                        )}
                    </div>
                )}
            >
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                    <Link href={`/p/${encodeURIComponent(dto.projectId)}/variations`}>{t('backToList')}</Link>
                    {contract.data?.number != null && <span>{t('contract', { number: contract.data.number })}</span>}
                </div>
                {dto.status === 'pending_approval' && (
                    <Alert className="!mt-3" type="warning" showIcon title={t('pendingApproval')}
                        action={<Link href="/approvals"><Button size="small">{t('openApprovals')}</Button></Link>} />
                )}
                {dto.status === 'submitted' && <Alert className="!mt-3" type="info" showIcon title={t('waitingCustomer')} />}
                {answered !== null && (
                    <Alert className="!mt-3" type={answered === 'accepted' ? 'success' : 'error'} showIcon
                        title={t(`responseBanner.${answered}`, { name: dto.acceptedByName })}
                        description={dto.responseNote !== '' ? <span className="whitespace-pre-line break-words">{dto.responseNote}</span> : undefined} />
                )}
            </SectionCard>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard title={t('details.title')}>
                        <DetailsCard dto={dto} editable={editable} billingMode={contract.data?.billingMode} />
                    </SectionCard>
                    {(editable || dto.lines.some(l => l.source === 'calculator')) && (
                        <SectionCard title={t('sandbox.title')}>
                            <SandboxLauncher dto={dto} workspaceId={workspaceId} editable={editable} />
                        </SectionCard>
                    )}
                    <SectionCard title={t('lines.title')}>
                        <VoLinesTable dto={dto} editable={editable} />
                    </SectionCard>
                    <SectionCard title={t('evidence.title')}>
                        <EvidencePanel dto={dto} workspaceId={workspaceId} editable={evidenceEditable} />
                    </SectionCard>
                </div>
                <div className="min-w-0">
                    <div className="xl:sticky xl:top-4">
                        <SectionCard title={t('totals.title')}>
                            <Totals dto={dto} />
                        </SectionCard>
                    </div>
                </div>
            </div>

            <ResponseDialog variationId={dto.id} open={responseOpen} onClose={() => setResponseOpen(false)} />
        </div>
    );
}

export function VariationEditorPage({ variationId }: { projectId: string; variationId: string }) {
    const t = useTranslations('variations');
    const toText = useErrorMessage();
    const v = useVariation(variationId);
    if (v.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(v.error)}`}
                action={<Button size="small" onClick={() => { void v.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (v.data === undefined) return <Skeleton active />;
    return <Editor key={v.data.id} dto={v.data} />;
}
