'use client';

// ─── Draft contract wizard: quotation → terms → milestones → preview → sign ───
// No contract yet: step 1 creates the draft (from an accepted quotation, or empty). A draft: step 1 edits the basics.
import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Input, Radio, Select, Skeleton, Steps } from 'antd';
import { useTranslations } from 'next-intl';
import { BILLING_MODES, DOC_LANGUAGES, type CreateMainContractRequest, type DocLanguage, type MainContractDto, type PatchMainContractRequest } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useModuleEnabled } from '@/features/modules/modules';
import { CustomerPicker } from '../shared/CustomerPicker';
import { ConfirmAction } from '../shared/ConfirmAction';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useQuotations } from '../quotations/hooks';
import { ContractPrintDocument } from './ContractPrintDocument';
import { MilestonesEditor } from './MilestonesEditor';
import { SignDialog } from './SignDialog';
import { TermsForm } from './TermsForm';
import { useCancelContract, useCreateContract, usePatchContract } from './hooks';
import { useContractPrintModel } from './useContractPrintModel';

type Source = 'quotation' | 'blank';

export function contractPrintHref(contractId: string): string {
    return `/print/contract/${encodeURIComponent(contractId)}`;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
    return <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">{text}{children}</label>;
}

export function ContractWizard({ projectId, workspaceId, contract }: {
    projectId: string;
    workspaceId: string | undefined;
    contract: MainContractDto | null;
}) {
    const t = useTranslations('contracts');
    const [step, setStep] = useState(contract === null ? 0 : 1);
    const [signing, setSigning] = useState(false);
    const items = [
        { title: contract === null ? t('wizard.steps.source') : t('wizard.steps.basics') },
        { title: t('wizard.steps.terms') },
        { title: t('wizard.steps.milestones') },
        { title: t('wizard.steps.preview') },
        { title: t('wizard.steps.sign') },
    ];
    const go = (n: number) => setStep(Math.max(0, Math.min(items.length - 1, n)));

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard>
                <Steps size="small" current={step} items={items} responsive
                    onChange={n => { if (contract !== null || n === 0) setStep(n); }} />
            </SectionCard>

            {contract === null ? (
                <CreateStep projectId={projectId} workspaceId={workspaceId} onCreated={() => setStep(1)} />
            ) : (
                <>
                    {step === 0 && (
                        <SectionCard title={t('wizard.steps.basics')}>
                            <BasicsForm contract={contract} workspaceId={workspaceId} onSaved={() => go(1)} />
                        </SectionCard>
                    )}
                    {step === 1 && (
                        <SectionCard title={t('wizard.steps.terms')}>
                            <TermsForm key={contract.updatedAt} contract={contract} disabled={false} onSaved={() => go(2)} />
                        </SectionCard>
                    )}
                    {step === 2 && (
                        <SectionCard title={t('wizard.steps.milestones')}>
                            <MilestonesEditor key={contract.updatedAt} contract={contract} disabled={false} onSaved={() => go(3)} />
                        </SectionCard>
                    )}
                    {step === 3 && <PreviewStep contract={contract} />}
                    {step === 4 && (
                        <SectionCard title={t('wizard.steps.sign')}>
                            <div className="flex flex-col gap-3">
                                <Alert type="info" showIcon title={t('wizard.signHint')} />
                                <div className="flex flex-wrap items-center gap-3">
                                    <span>{t('fields.originalValue')}</span>
                                    <MoneyText value={contract.originalValue} currency className="font-semibold" />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button type="primary" onClick={() => setSigning(true)}>{t('actions.sign')}</Button>
                                    <CancelDraftButton contractId={contract.id} />
                                </div>
                            </div>
                        </SectionCard>
                    )}
                    <div className="flex justify-between">
                        <Button disabled={step === 0} onClick={() => go(step - 1)}>{t('wizard.back')}</Button>
                        {step === 0 || step === 3 ? <Button type="primary" onClick={() => go(step + 1)}>{t('wizard.next')}</Button> : <span />}
                    </div>
                    <SignDialog contract={contract} open={signing} onClose={() => setSigning(false)} />
                </>
            )}
        </div>
    );
}

function CancelDraftButton({ contractId }: { contractId: string }) {
    const t = useTranslations('contracts');
    const cancel = useCancelContract(contractId);
    return (
        <ConfirmAction danger title={t('actions.cancelConfirm')} onConfirm={() => cancel.mutateAsync()}>
            {t('actions.cancelDraft')}
        </ConfirmAction>
    );
}

function CreateStep({ projectId, workspaceId, onCreated }: { projectId: string; workspaceId: string | undefined; onCreated: () => void }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const quotationsOn = useModuleEnabled('quotations', workspaceId).enabled;
    const quotations = useQuotations(quotationsOn ? projectId : undefined);
    const create = useCreateContract(projectId);
    const accepted = (quotations.data ?? []).filter(q => q.acceptedVersionId !== null);
    const [source, setSource] = useState<Source>('quotation');
    const [quotationId, setQuotationId] = useState<string | null>(null);
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [value, setValue] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [language, setLanguage] = useState<DocLanguage | null>(null);
    const [billingMode, setBillingMode] = useState<(typeof BILLING_MODES)[number] | null>(null);

    const effectiveSource: Source = source === 'quotation' && accepted.length === 0 && !quotations.isLoading ? 'blank' : source;
    const chosen = quotationId ?? accepted[0]?.id ?? null;
    const ready = effectiveSource === 'quotation' ? chosen !== null : customerId !== null && value !== null && value > 0;

    const submit = async () => {
        const common: Pick<CreateMainContractRequest, 'title' | 'language' | 'billingMode'> = {
            ...(title.trim() !== '' ? { title: title.trim() } : {}),
            ...(language !== null ? { language } : {}),
            ...(billingMode !== null ? { billingMode } : {}),
        };
        const body: CreateMainContractRequest = effectiveSource === 'quotation' && chosen !== null
            ? { quotationId: chosen, ...common }
            : { customerId: customerId ?? undefined, originalValue: value ?? undefined, ...common };
        try {
            await create.mutateAsync(body);
            void message.success(t('wizard.created'));
            onCreated();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    if (quotationsOn && quotations.isLoading) return <Skeleton active />;

    return (
        <SectionCard title={t('wizard.sourceTitle')}>
            <div className="flex flex-col gap-4">
                <Radio.Group value={effectiveSource} onChange={e => setSource(e.target.value as Source)}
                    options={[
                        { value: 'quotation', label: t('wizard.fromQuotation'), disabled: accepted.length === 0 },
                        { value: 'blank', label: t('wizard.blank') },
                    ]} />
                {effectiveSource === 'quotation' ? (
                    <div className="flex flex-col gap-2">
                        <Radio.Group value={chosen} onChange={e => setQuotationId(e.target.value as string)} className="flex flex-col gap-2"
                            options={accepted.map(q => {
                                const v = q.versions.find(x => x.id === q.acceptedVersionId);
                                return {
                                    value: q.id,
                                    label: (
                                        <span className="inline-flex flex-wrap items-center gap-2">
                                            <span className="font-medium">{q.title === '' ? t('wizard.untitled') : q.title}</span>
                                            {v?.number !== undefined && v.number !== null && <span className="text-gray-500">{v.number}</span>}
                                            {v !== undefined && <MoneyText value={v.grandTotal} />}
                                        </span>
                                    ),
                                };
                            })} />
                        <div className="text-[13px] text-gray-500">{t('wizard.quotationHint')}</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {quotationsOn && accepted.length === 0 && (
                            <div className="md:col-span-2">
                                <Alert type="info" showIcon title={t('wizard.noAccepted')}
                                    description={<Link href={`/p/${encodeURIComponent(projectId)}/quotations`}>{t('wizard.goQuotations')}</Link>} />
                            </div>
                        )}
                        <Label text={t('fields.customer')}>
                            <CustomerPicker value={customerId} workspaceId={workspaceId} onChange={id => setCustomerId(id)} />
                        </Label>
                        <Label text={t('fields.originalValue')}>
                            <MoneyInput value={value ?? undefined} onChange={v => setValue(v)} />
                        </Label>
                    </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <Label text={t('fields.title')}>
                        <Input value={title} maxLength={200} placeholder={t('fields.titleHint')} onChange={e => setTitle(e.target.value)} />
                    </Label>
                    <LanguageSelect value={language} onChange={setLanguage} allowDefault />
                    {effectiveSource === 'blank' && <BillingModeSelect value={billingMode} onChange={setBillingMode} allowDefault />}
                </div>
                <div className="flex justify-end">
                    <Button type="primary" loading={create.isPending} disabled={!ready} onClick={() => { void submit(); }}>
                        {t('wizard.create')}
                    </Button>
                </div>
            </div>
        </SectionCard>
    );
}

function LanguageSelect({ value, onChange, allowDefault = false }: {
    value: DocLanguage | null;
    onChange: (v: DocLanguage | null) => void;
    allowDefault?: boolean;
}) {
    const t = useTranslations('contracts');
    return (
        <Label text={t('fields.language')}>
            <Select<DocLanguage | null> value={value} onChange={onChange} allowClear={false}
                options={[
                    ...(allowDefault ? [{ value: null, label: t('wizard.defaultOption') }] : []),
                    ...DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) })),
                ]} />
        </Label>
    );
}

function BillingModeSelect({ value, onChange, allowDefault = false }: {
    value: (typeof BILLING_MODES)[number] | null;
    onChange: (v: (typeof BILLING_MODES)[number] | null) => void;
    allowDefault?: boolean;
}) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    return (
        <Label text={t('fields.billingMode')}>
            <Select<(typeof BILLING_MODES)[number] | null> value={value} onChange={onChange}
                options={[
                    ...(allowDefault ? [{ value: null, label: t('wizard.defaultOption') }] : []),
                    ...BILLING_MODES.map(m => ({ value: m, label: te(`billingMode.${m}`) })),
                ]} />
        </Label>
    );
}

function BasicsForm({ contract, workspaceId, onSaved }: { contract: MainContractDto; workspaceId: string | undefined; onSaved: () => void }) {
    const t = useTranslations('contracts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchContract(contract.id);
    const [title, setTitle] = useState(contract.title);
    const [language, setLanguage] = useState<DocLanguage>(contract.language);
    const [customerId, setCustomerId] = useState<string | null>(contract.customerId);
    const [value, setValue] = useState<number | null>(contract.originalValue);
    const [billingMode, setBillingMode] = useState(contract.billingMode);
    const [startDate, setStartDate] = useState(contract.startDate ?? '');
    const [finishDate, setFinishDate] = useState(contract.finishDate ?? '');
    const datesBad = startDate !== '' && finishDate !== '' && finishDate < startDate;

    const save = async () => {
        const body: PatchMainContractRequest = {
            title: title.trim(),
            language,
            ...(customerId !== null ? { customerId } : {}),
            ...(value !== null ? { originalValue: value } : {}),
            billingMode,
            startDate: startDate === '' ? null : startDate,
            finishDate: finishDate === '' ? null : finishDate,
        };
        try {
            await patch.mutateAsync(body);
            void message.success(t('basics.saved'));
            onSaved();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {contract.quotationId !== null && <Alert type="info" showIcon title={t('basics.fromQuotation')} />}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Label text={t('fields.title')}><Input value={title} maxLength={200} onChange={e => setTitle(e.target.value)} /></Label>
                <Label text={t('fields.customer')}>
                    <CustomerPicker value={customerId} workspaceId={workspaceId} allowClear={false} onChange={id => setCustomerId(id)} />
                </Label>
                <Label text={t('fields.originalValue')}><MoneyInput value={value ?? undefined} min={0.01} onChange={v => setValue(v)} /></Label>
                <LanguageSelect value={language} onChange={v => { if (v !== null) setLanguage(v); }} />
                <BillingModeSelect value={billingMode} onChange={v => { if (v !== null) setBillingMode(v); }} />
                <span />
                <Label text={t('fields.startDate')}><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></Label>
                <Label text={t('fields.finishDate')}><Input type="date" value={finishDate} onChange={e => setFinishDate(e.target.value)} /></Label>
            </div>
            {datesBad && <div className="text-[13px] text-red-600">{t('basics.datesOrder')}</div>}
            <div className="flex justify-end">
                <Button type="primary" loading={patch.isPending} disabled={datesBad || value === null || value <= 0 || customerId === null || title.trim() === ''}
                    onClick={() => { void save(); }}>
                    {t('actions.saveContinue')}
                </Button>
            </div>
        </div>
    );
}

function PreviewStep({ contract }: { contract: MainContractDto }) {
    const t = useTranslations('contracts');
    const { model, error } = useContractPrintModel(contract);
    return (
        <SectionCard
            title={t('wizard.steps.preview')}
            extra={<a href={contractPrintHref(contract.id)} target="_blank" rel="noopener noreferrer"><Button>{t('actions.print')}</Button></a>}
        >
            {model === null
                ? (error !== null ? <Alert type="error" showIcon title={t('loadFailed')} /> : <Skeleton active />)
                : <div className="max-h-[70vh] overflow-auto rounded-card border border-gray-200 bg-white p-4"><ContractPrintDocument model={model} /></div>}
        </SectionCard>
    );
}
