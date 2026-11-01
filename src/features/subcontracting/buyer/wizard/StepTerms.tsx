'use client';

// ─── Wizard step 2: how the work is hired (supply / pricing), standard terms, text for the vendor, attachments ───
import { useLocale, useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useState } from 'react';
import { App, Button, Input, InputNumber, Segmented, Select, Switch, Upload } from 'antd';
import { DeleteOutlined, PaperClipOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
    ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, type FileDto, type MaterialBy, type Penalty, type PricingMode, type Provider, type SupplyMode,
} from '@/shared/contract';

import { uploadFile } from '../api';
import { pricingModeLabel, PROVISIONS, providerLabel, provisionLabel, supplyModeLabel } from '../format';
import { provinceOptions } from '../provinces';
import { Card } from '../ui';
import { questionsOf, titleOf, titleRevealsProject, type Draft, type WizardRow } from './state';

/** Label left, control right (stacked on phones). */
export function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex flex-col md:flex-row md:items-start gap-1 md:gap-4 py-2">
            <div className="md:w-48 shrink-0 md:pt-1.5 text-gray-700 font-medium">{label}</div>
            <div className="flex-1 min-w-0">
                {children}
                {hint !== undefined && <div className="text-caption text-gray-500 mt-1">{hint}</div>}
            </div>
        </div>
    );
}

const PROVISION_KEYS = PROVISIONS;

type RetentionChoice = '0.05' | '0.1' | 'custom';

export function StepTerms({ draft, update, addFile, keys, rows, projectName }: {
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    addFile: (file: FileDto) => void;
    keys: readonly string[];
    rows: readonly WizardRow[];
    projectName: string;
}) {
    const t = useTranslations('subcontracting');
    const locale = useLocale();
    const SUPPLY_OPTIONS = (['labour_only', 'with_materials', 'per_line'] as const).map(v => ({ value: v, label: supplyModeLabel(v, t) }));
    const PRICING_OPTIONS = (['unit', 'lump', 'vendor_choice'] as const).map(v => ({ value: v, label: pricingModeLabel(v, t) }));
    const PROVIDER_OPTIONS = (['buyer', 'vendor', 'none'] as const).map(v => ({ value: v, label: providerLabel(v, t) }));
    const questions = questionsOf(draft);
    const setQuestions = (list: string[]) => update({ questions: list });
    const retentionChoice: RetentionChoice = draft.retentionCustom ? 'custom' : draft.retentionPct > 0.075 ? '0.1' : '0.05';
    const chosen = new Set(keys);
    const perLineRows = rows.filter(r => chosen.has(r.row.key));

    return (
        <>
            <Card title={t('buyer.wizardTerms.contractType')}>
                <Field label={t('buyer.wizardTerms.whoSuppliesTheMaterials')}>
                    <Segmented<SupplyMode> options={SUPPLY_OPTIONS} value={draft.supplyMode} onChange={v => update({ supplyMode: v })} />
                </Field>
                {draft.supplyMode === 'per_line' && perLineRows.length > 0 && (
                    <div className="border border-gray-200 rounded-card divide-y divide-gray-100 mb-2">
                        {perLineRows.map(r => (
                            <div key={r.row.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                <span className="flex-1 min-w-[200px]">{r.row.desc}</span>
                                <Segmented<MaterialBy> size="small" value={draft.materialByLine[r.row.key] ?? 'buyer'}
                                    options={[{ value: 'buyer', label: t('buyer.wizardTerms.materialsByUs') }, { value: 'vendor', label: t('buyer.wizardTerms.materialsByTheRecipient') }]}
                                    onChange={v => update({ materialByLine: { ...draft.materialByLine, [r.row.key]: v } })} />
                            </div>
                        ))}
                    </div>
                )}
                <Field label={t('buyer.wizardTerms.theRecipientQuotes')} hint={draft.pricingMode === 'unit' ? t('buyer.wizardTerms.pricesCompareRowByRow') : undefined}>
                    <Segmented<PricingMode> options={PRICING_OPTIONS} value={draft.pricingMode} onChange={v => update({ pricingMode: v })} />
                </Field>
            </Card>

            <Card title={t('buyer.wizardTerms.terms')}>
                <Field label={t('buyer.wizardTerms.retention')}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented<RetentionChoice> value={retentionChoice}
                            options={[{ value: '0.05', label: '5%' }, { value: '0.1', label: '10%' }, { value: 'custom', label: t('buyer.wizardTerms.custom') }]}
                            onChange={v => update(v === 'custom'
                                ? { retentionCustom: true }
                                : { retentionCustom: false, retentionPct: Number(v) })} />
                        {draft.retentionCustom && (
                            <InputNumber<number> className="!w-28" min={0} max={30} step={0.5} suffix="%" aria-label={t('buyer.wizardTerms.retention2')}
                                value={Math.round(draft.retentionPct * 1000) / 10}
                                onChange={v => update({ retentionPct: (v ?? 0) / 100 })} />
                        )}
                    </div>
                </Field>
                <Field label={t('buyer.wizardTerms.warrantyPeriod')}>
                    <InputNumber<number> className="!w-32" min={0} max={120} precision={0} suffix={t('buyer.wizardTerms.months')} aria-label={t('buyer.wizardTerms.warrantyPeriod')}
                        value={draft.warrantyMonths} onChange={v => update({ warrantyMonths: v ?? 0 })} />
                </Field>
                <Field label={t('buyer.wizardTerms.latePenalty')}>
                    <PenaltyInput value={draft.penalty} onChange={penalty => update({ penalty })} />
                </Field>
                <Field label={t('buyer.wizardTerms.whoSupplies')}>
                    <div className="flex flex-col gap-2">
                        {PROVISION_KEYS.map(k => (
                            <div key={k} className="flex flex-wrap items-center gap-3">
                                <span className="w-24 text-gray-600">{provisionLabel(k)}</span>
                                <Segmented<Provider> size="small" options={PROVIDER_OPTIONS} value={draft.provisions[k]}
                                    onChange={v => update({ provisions: { ...draft.provisions, [k]: v } })} />
                            </div>
                        ))}
                    </div>
                </Field>
                <Field label={t('buyer.wizardTerms.safety')}>
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} value={draft.safetyNote}
                        placeholder={t('buyer.wizardTerms.eGWearHelmetsAnd')}
                        onChange={e => update({ safetyNote: e.target.value })} />
                </Field>
                <Field label={t('buyer.wizardTerms.questionsForRecipients')} hint={t('buyer.wizardTerms.recipientsAnswerEveryQuestionWhen')}>
                    <div className="flex flex-col gap-2">
                        {questions.map((q, i) => (
                            <div key={i} className="flex gap-2">
                                <Input value={q} maxLength={300} aria-label={t('buyer.wizardTerms.question', { value: i + 1 })}
                                    onChange={e => setQuestions(questions.map((x, k) => (k === i ? e.target.value : x)))} />
                                <Button type="text" aria-label={t('buyer.wizardTerms.removeQuestion')} icon={<DeleteOutlined />}
                                    onClick={() => setQuestions(questions.filter((_x, k) => k !== i))} />
                            </div>
                        ))}
                        {questions.length < 20 && (
                            <Button size="small" className="self-start" icon={<PlusOutlined />} onClick={() => setQuestions([...questions, ''])}>
                                {t('buyer.wizardTerms.addQuestion')}
                            </Button>
                        )}
                    </div>
                </Field>
            </Card>

            <Card title={t('buyer.wizardTerms.whatRecipientsSee')}>
                <Field label={t('buyer.wizardTerms.packageName')}
                    hint={titleRevealsProject(titleOf(draft), projectName, draft.hideOwnerIdentity)
                        ? t('buyer.wizardTerms.crewsWillSeeThisName')
                        : undefined}>
                    <Input maxLength={160} value={titleOf(draft)}
                        status={draft.title !== null && draft.title.trim() === '' ? 'error' : undefined}
                        onChange={e => update({ title: e.target.value })} />
                </Field>
                <Field label={t('buyer.wizardTerms.description')}>
                    <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={4000} value={draft.description}
                        placeholder={t('buyer.wizardTerms.siteConditionsAccessWorkingHours')}
                        onChange={e => update({ description: e.target.value })} />
                </Field>
                <Field label={t('buyer.wizardTerms.location')}>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap gap-2">
                            <Select className="min-w-[200px] flex-1" placeholder={t('buyer.wizardTerms.province')} allowClear options={provinceOptions(locale)}
                                showSearch={{ optionFilterProp: 'label' }} aria-label={t('buyer.wizardTerms.province')}
                                value={draft.location.province === '' ? undefined : draft.location.province}
                                onChange={(v: string | undefined) => update({ location: { ...draft.location, province: v ?? '' } })} />
                            <Input className="min-w-[200px] !flex-1" placeholder={t('buyer.wizardTerms.district')} maxLength={80} value={draft.location.district}
                                onChange={e => update({ location: { ...draft.location, district: e.target.value } })} />
                        </div>
                        <Input placeholder={t('buyer.wizardTerms.siteAddress')} maxLength={400} value={draft.location.address}
                            onChange={e => update({ location: { ...draft.location, address: e.target.value } })} />
                    </div>
                </Field>
                <Field label={t('buyer.wizardTerms.hideProjectNameAndAddress')} hint={t('buyer.wizardTerms.recipientsOnlySeeTheDistrict')}>
                    <Switch checked={draft.hideOwnerIdentity} onChange={v => update({ hideOwnerIdentity: v })} aria-label={t('buyer.wizardTerms.hideProjectNameAndAddress')} />
                </Field>
            </Card>

            <FilesCard draft={draft} update={update} addFile={addFile} />
        </>
    );
}

function PenaltyInput({ value, onChange }: { value: Penalty; onChange: (p: Penalty) => void }) {
    const t = useTranslations('subcontracting');
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Select<Penalty['kind']> className="!w-44" value={value.kind} aria-label={t('buyer.wizardTerms.penaltyType')}
                options={[{ value: 'none', label: t('buyer.wizardTerms.noPenalty') }, { value: 'per_day', label: t('buyer.wizardTerms.bahtPerDay') }, { value: 'pct_per_day', label: t('buyer.wizardTerms.ofValuePerDay') }]}
                onChange={k => onChange(k === 'none' ? { kind: 'none' } : k === 'per_day' ? { kind: 'per_day', amount: 500 } : { kind: 'pct_per_day', rate: 0.001 })} />
            {value.kind === 'per_day' && (
                <InputNumber<number> className="!w-36" min={0} suffix={t('buyer.wizardTerms.thbDay')} value={value.amount} aria-label={t('buyer.wizardTerms.penaltyInBahtPerDay')}
                    onChange={v => onChange({ kind: 'per_day', amount: v ?? 0 })} />
            )}
            {value.kind === 'pct_per_day' && (
                <InputNumber<number> className="!w-36" min={0} max={100} step={0.05} suffix={t('buyer.wizardTerms.day')} aria-label={t('buyer.wizardTerms.penaltyInPercentPerDay')}
                    value={Math.round(value.rate * 100000) / 1000} onChange={v => onChange({ kind: 'pct_per_day', rate: (v ?? 0) / 100 })} />
            )}
        </div>
    );
}

function FilesCard({ draft, update, addFile }: {
    draft: Draft;
    update: (patch: Partial<Draft>) => void;
    /** Appends to the latest list (several uploads may finish in any order). */
    addFile: (file: FileDto) => void;
}) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [uploading, setUploading] = useState(0);
    const allowed: readonly string[] = ALLOWED_CONTENT_TYPES;

    const upload = async (file: File) => {
        if (!allowed.includes(file.type)) {
            void message.warning(t('buyer.wizardTerms.onlyPdfAndImagesCan', { name: file.name }));
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            void message.warning(t('buyer.wizardTerms.fileIsLargerThanMb', { name: file.name, value: Math.round(MAX_FILE_BYTES / 1024 / 1024) }));
            return;
        }
        setUploading(n => n + 1);
        try {
            addFile(await uploadFile(file, 'package_attachment'));
        } catch (e) {
            void message.error(`${file.name}: ${toText(e)}`);
        } finally {
            setUploading(n => n - 1);
        }
    };
    return (
        <Card title={t('buyer.wizardTerms.attachments')} extra={(
            <Upload multiple showUploadList={false} accept={allowed.join(',')}
                beforeUpload={file => { void upload(file); return false; }}>
                <Button size="small" icon={<UploadOutlined />} loading={uploading > 0}>{t('buyer.wizardTerms.attachFiles')}</Button>
            </Upload>
        )}>
            {draft.files.length === 0 ? (
                <p className="text-secondary text-gray-500 m-0">{t('buyer.wizardTerms.drawingsOrSpecsPdfImages')}</p>
            ) : (
                <div className="flex flex-col gap-1">
                    {draft.files.map(f => (
                        <div key={f.id} className="flex items-center gap-2">
                            <PaperClipOutlined className="text-gray-400" />
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate">{f.name}</a>
                            <span className="text-caption text-gray-500 tabular-nums">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                            <Button type="text" size="small" aria-label={t('buyer.wizardTerms.remove', { name: f.name })} icon={<DeleteOutlined />}
                                onClick={() => update({ files: draft.files.filter(x => x.id !== f.id) })} />
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
