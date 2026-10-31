'use client';

// ─── /p/[projectId]/quotations/[quotationId]: edit a draft (live pricing, autosave), read an issued version, compare, issue ───
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Dropdown, Select, Skeleton, Space, Tag } from 'antd';
import { DownOutlined, PrinterOutlined, SendOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { type QuotationDto, type QuotationVersionDto, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCompanyProfile } from '../company/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { SectionCard } from '../shared/SectionCard';
import { ShareLinkButton } from '../shared/ShareLinkButton';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { CompareDrawer } from './CompareDrawer';
import { IssueDialog } from './IssueDialog';
import {
    useCancelQuotationVersion, useNewQuotationVersion, usePatchQuotationVersion, useQuotation, useQuotationVersion,
} from './hooks';
import {
    type EditorForm, type FormKey, type FormLine, type PricedView, addCustomSection, addLine, applyDefaultRates, buildPatch, formFromDto,
    formProblems, patchLine, patchSection, pricedFromDto, priceForm, removeLine, removeSection,
} from './logic';
import { PricingPanel } from './PricingPanel';
import { RecordResponseDialog } from './RecordResponseDialog';
import { SectionPricingTable } from './SectionPricingTable';
import { TotalsPanel } from './TotalsPanel';
import { QUOTATION_STATUS_TONES } from './status';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function VersionEditor({ dto, quotation, onPick }: { dto: QuotationVersionDto; quotation: QuotationDto; onPick: (versionId: string) => void }) {
    const t = useTranslations('quotations');
    const tErr = useTranslations('errors');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const ws = useErpWorkspace(quotation.workspaceId);
    const company = useCompanyProfile(quotation.workspaceId);
    const vatRegistered = company.data?.vatRegistered ?? true;
    const editable = dto.status === 'draft' && dto.canEdit && dto.seesMargins;
    const mayManage = can(ws.role, 'quotations.manage');
    const mayIssue = can(ws.role, 'quotations.issue');

    const [form, setForm] = useState<EditorForm>(() => formFromDto(dto));
    const formRef = useRef(form);
    const dirty = useRef(new Set<FormKey>());
    const inFlight = useRef<Promise<boolean> | null>(null);
    const [tick, setTick] = useState(0);
    const [saveState, setSaveState] = useState<SaveState>('saved');
    const [issueOpen, setIssueOpen] = useState(false);
    const [compareOpen, setCompareOpen] = useState(false);
    const [responseOpen, setResponseOpen] = useState(false);
    const patch = usePatchQuotationVersion(dto.id);
    const cancel = useCancelQuotationVersion(dto.id);
    const newVersion = useNewQuotationVersion(quotation.id);

    const original = useMemo(() => new Map(formFromDto(dto).lines.map(l => [l.ck, l] as const)), [dto]);
    const priceResult = useMemo(() => (editable ? priceForm(form, vatRegistered) : null), [editable, form, vatRegistered]);
    const issues = priceResult !== null && !priceResult.ok ? priceResult.issues : [];
    const problems = useMemo(() => (editable ? formProblems(form) : []), [editable, form]);
    // While the pricing is refused (the alert says why) the figures of the last save stay on screen.
    const priced: PricedView = priceResult?.ok === true ? priceResult.priced : pricedFromDto(dto);

    // ── autosave (debounce 800 ms) ──
    const save = useCallback(async (): Promise<boolean> => {
        if (inFlight.current !== null) await inFlight.current;
        if (dirty.current.size === 0) return true;
        const f = formRef.current;
        const check = priceForm(f, vatRegistered);
        if (!check.ok || formProblems(f).length > 0) return false;
        const keys = [...dirty.current];
        dirty.current.clear();
        setSaveState('saving');
        const run = (async (): Promise<boolean> => {
            try {
                const res = await patch.mutateAsync(buildPatch(f, keys));
                if (dirty.current.size === 0) {
                    // Nothing typed meanwhile: take the server's version (ids of new lines, repriced figures).
                    setForm(formFromDto(res));
                    formRef.current = formFromDto(res);
                    setSaveState('saved');
                } else {
                    setSaveState('dirty');
                }
                return true;
            } catch (e) {
                keys.forEach(k => dirty.current.add(k));
                setSaveState('error');
                void message.error(toText(e));
                return false;
            }
        })();
        inFlight.current = run;
        const ok = await run;
        inFlight.current = null;
        return ok;
    }, [patch, vatRegistered, message, toText]);
    const saveRef = useRef(save);
    useEffect(() => { saveRef.current = save; }, [save]);

    useEffect(() => {
        if (!editable || dirty.current.size === 0) return undefined;
        const h = setTimeout(() => { void saveRef.current(); }, 800);
        return () => clearTimeout(h);
    }, [tick, editable]);
    useEffect(() => () => { void saveRef.current(); }, []);

    const apply = (next: EditorForm, keys: readonly FormKey[]) => {
        formRef.current = next;
        setForm(next);
        keys.forEach(k => dirty.current.add(k));
        setSaveState('dirty');
        setTick(x => x + 1);
    };
    const edit = (p: Partial<EditorForm>) => apply({ ...formRef.current, ...p }, Object.keys(p) as FormKey[]);
    const applyResult = (r: { form: EditorForm; keys: FormKey[] }) => apply(r.form, r.keys);

    const changeFormat = async (format: EditorForm['format']) => {
        if (!(await save())) return;
        setSaveState('saving');
        try {
            const res = await patch.mutateAsync({ format });
            const next = formFromDto(res);
            formRef.current = next;
            setForm(next);
            setSaveState('saved');
        } catch (e) {
            setSaveState('error');
            void message.error(toText(e));
        }
    };

    const start = async (body: { fromBoq?: boolean }) => {
        try {
            const v = await newVersion.mutateAsync({ fromVersionId: dto.id, ...body });
            void message.success(t('newVersion.done'));
            onPick(v.id);
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const hasOpenDraft = quotation.versions.some(v => v.status === 'draft' || v.status === 'pending_approval');
    const canStartVersion = mayManage && dto.status !== 'draft' && dto.status !== 'pending_approval' && !hasOpenDraft;
    const responded = dto.status === 'accepted' || dto.status === 'change_requested' || dto.status === 'rejected' ? dto.status : null;
    const government = form.format === 'government';
    const view = editable ? form : formFromDto(dto);

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{dto.title === '' ? t('untitled') : dto.title}</span>
                        <DocumentNumberTag number={dto.number} />
                        <StatusTag enumName="quotationVersionStatus" value={dto.status} tones={QUOTATION_STATUS_TONES} />
                    </span>
                }
                extra={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select className="!w-[200px] max-w-full" value={dto.id} onChange={onPick} aria-label={t('version.pick')}
                            options={[...quotation.versions].sort((a, b) => b.versionNo - a.versionNo).map(v => ({
                                value: v.id, label: `${t('versionNo', { no: v.versionNo })}${v.number !== null ? ` · ${v.number}` : ''} · ${t(`statusShort.${v.status}`)}`,
                            }))} />
                        {quotation.versions.length > 1 && <Button icon={<SwapOutlined />} onClick={() => setCompareOpen(true)}>{t('compare.button')}</Button>}
                        {canStartVersion && (
                            <Space.Compact>
                                <Button loading={newVersion.isPending} onClick={() => { void start({}); }}>{t('newVersion.copy')}</Button>
                                <Dropdown trigger={['click']} menu={{ items: [{ key: 'boq', label: t('newVersion.fromBoq') }], onClick: () => { void start({ fromBoq: true }); } }}>
                                    <Button icon={<DownOutlined />} aria-label={t('newVersion.more')} />
                                </Dropdown>
                            </Space.Compact>
                        )}
                        {dto.status !== 'cancelled' && (
                            <Button icon={<PrinterOutlined />} href={`/print/quotation/${encodeURIComponent(dto.id)}`} target="_blank">{t('print.button')}</Button>
                        )}
                        {dto.status === 'issued' && mayIssue && (
                            <ShareLinkButton workspaceId={quotation.workspaceId} subjectType="quotation" subjectId={dto.id} />
                        )}
                        {dto.status === 'issued' && mayManage && <Button onClick={() => setResponseOpen(true)}>{t('response.button')}</Button>}
                        {(dto.status === 'draft' || dto.status === 'pending_approval') && mayManage && (
                            <ConfirmAction danger title={t('cancel.confirm')} onConfirm={async () => { await cancel.mutateAsync(); void message.success(t('cancel.done')); }}>
                                {dto.status === 'draft' ? t('cancel.button') : t('cancel.withdraw')}
                            </ConfirmAction>
                        )}
                        {editable && mayIssue && (
                            <Button type="primary" icon={<SendOutlined />} disabled={issues.length > 0 || problems.length > 0} onClick={() => setIssueOpen(true)}>
                                {t('issue.button')}
                            </Button>
                        )}
                    </div>
                }
            >
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                    <Link href={`/p/${encodeURIComponent(dto.projectId)}/quotations`}>{t('backToList')}</Link>
                    {editable && (
                        <Tag className="!m-0" color={saveState === 'error' ? 'error' : saveState === 'saved' ? 'success' : 'processing'}>
                            {t(`save.${saveState}`)}
                        </Tag>
                    )}
                    {dto.status === 'draft' && !dto.canEdit && <Tag className="!m-0">{t('readOnly')}</Tag>}
                </div>
                {dto.status === 'pending_approval' && (
                    <Alert className="!mt-3" type="warning" showIcon title={t('pendingApproval')}
                        action={<Link href="/approvals"><Button size="small">{t('openApprovals')}</Button></Link>} />
                )}
                {responded !== null && (
                    <Alert className="!mt-3" type={responded === 'accepted' ? 'success' : responded === 'rejected' ? 'error' : 'warning'} showIcon
                        title={t(`responseBanner.${responded}`, { name: dto.acceptedByName })}
                        description={dto.responseNote !== '' ? <span className="whitespace-pre-line break-words">{dto.responseNote}</span> : undefined} />
                )}
                {issues.length > 0 && (
                    <Alert className="!mt-3" type="error" showIcon title={t('problems.pricing')}
                        description={<ul className="m-0 pl-4">{[...new Set(issues.map(i => i.reason))].map(r => <li key={r}>{tErr(`reasons.${r}`)}</li>)}</ul>} />
                )}
            </SectionCard>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex min-w-0 flex-col gap-4">
                    <SectionCard title={t('sections.title')}>
                        <SectionPricingTable
                            form={view} priced={priced} editable={editable} seesMargins={dto.seesMargins}
                            onPatchSection={(no, p) => applyResult(patchSection(formRef.current, no, p))}
                            onAddSection={(th, en) => applyResult(addCustomSection(formRef.current, th, en))}
                            onRemoveSection={no => applyResult(removeSection(formRef.current, no))}
                            onPatchLine={(ck: string, p: Partial<FormLine>) => apply(patchLine(formRef.current, ck, p, original), ['lines'])}
                            onRemoveLine={ck => apply(removeLine(formRef.current, ck), ['lines'])}
                            onAddLine={(no, kind) => apply(addLine(formRef.current, no, kind), ['lines'])}
                        />
                    </SectionCard>
                    <SectionCard title={t('settings.title')}>
                        <PricingPanel
                            form={view} workspaceId={quotation.workspaceId} editable={editable} seesMargins={dto.seesMargins}
                            vatRegistered={vatRegistered} problems={problems}
                            onEdit={edit} onFormat={f => { void changeFormat(f); }}
                            onApplyRates={() => applyResult(applyDefaultRates(formRef.current))}
                        />
                    </SectionCard>
                </div>
                <div className="min-w-0">
                    <div className="xl:sticky xl:top-4">
                        <SectionCard title={t('totals.title')}>
                            <TotalsPanel totals={priced.totals} parts={priced.parts} seesMargins={dto.seesMargins} government={government} vatRegistered={vatRegistered} />
                        </SectionCard>
                    </div>
                </div>
            </div>

            <IssueDialog version={dto} open={issueOpen} flush={save} onClose={() => setIssueOpen(false)} />
            <CompareDrawer quotationId={quotation.id} versions={quotation.versions} open={compareOpen} currentId={dto.id} onClose={() => setCompareOpen(false)} />
            <RecordResponseDialog versionId={dto.id} open={responseOpen} onClose={() => setResponseOpen(false)} />
        </div>
    );
}

export function QuotationEditorPage({ quotationId }: { projectId: string; quotationId: string }) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const q = useQuotation(quotationId);
    const [picked, setPicked] = useState<string | undefined>();
    const versions = q.data?.versions ?? [];
    const latest = [...versions].sort((a, b) => b.versionNo - a.versionNo)[0]?.id;
    const wanted = picked !== undefined && versions.some(v => v.id === picked) ? picked : q.data?.currentVersionId ?? latest;
    const version = useQuotationVersion(wanted);

    if (q.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (q.data === undefined) return <Skeleton active />;
    if (version.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(version.error)}`}
                action={<Button size="small" onClick={() => { void version.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (version.data === undefined) return <Skeleton active />;
    // A new key per version: the editor starts from the version it is given.
    return <VersionEditor key={version.data.id} dto={version.data} quotation={q.data} onPick={setPicked} />;
}
