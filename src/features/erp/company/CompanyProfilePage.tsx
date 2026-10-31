'use client';

// ─── Company profile: seller details for documents, tax, bank accounts, images, business types, project defaults ───
import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, ColorPicker, Form, Input, InputNumber, Result, Segmented, Select, Skeleton, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    type BankAccount, type BusinessProfile, type CompanyDefaults, type CompanyProfileDto, type DocLanguage, type FileDto,
    type PutCompanyProfileRequest, type ProjectType, can,
} from '@/shared/contract';
import { isThaiTaxId } from '@/domain/erp/tax-id';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { AuditTimeline } from '../shared/AuditTimeline';
import { ErpPage } from '../shared/ErpPage';
import { FileAttachments } from '../shared/FileAttachments';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { BusinessProfileStep } from './BusinessProfileStep';
import { ProjectDefaultsEditor } from './ProjectDefaultsEditor';
import { useCompanyProfile, usePutCompanyProfile } from './hooks';

/** Everything the form edits (images are held outside the form, as FileDto lists). */
interface FormValues {
    legalNameTh: string;
    legalNameEn: string;
    taxId: string;
    branchCode: string;
    branchNameTh: string;
    branchNameEn: string;
    addressTh: string;
    addressEn: string;
    phone: string;
    email: string;
    website: string;
    vatRegistered: boolean;
    /** Percent (7), not a fraction. */
    vatRatePct: number;
    bankAccounts: BankAccount[];
    promptpayId: string;
    brandColor: string;
    defaultDocLanguage: DocLanguage;
    documentYearStyle: 'ce' | 'be';
    documentFooterTh: string;
    documentFooterEn: string;
}

interface Extras {
    businessProfiles: BusinessProfile[];
    defaultProjectType: ProjectType | null;
    defaults: CompanyDefaults;
    logo: FileDto | null;
    stamp: FileDto | null;
    signature: FileDto | null;
}

const formOf = (c: CompanyProfileDto): FormValues => ({
    legalNameTh: c.isDefault ? '' : c.legalNameTh,
    legalNameEn: c.legalNameEn,
    taxId: c.taxId,
    branchCode: c.branchCode,
    branchNameTh: c.branchNameTh,
    branchNameEn: c.branchNameEn,
    addressTh: c.addressTh,
    addressEn: c.addressEn,
    phone: c.phone,
    email: c.email,
    website: c.website,
    vatRegistered: c.vatRegistered,
    vatRatePct: Math.round(c.vatRate * 1e6) / 1e4,
    bankAccounts: c.bankAccounts,
    promptpayId: c.promptpayId,
    brandColor: c.brandColor,
    defaultDocLanguage: c.defaultDocLanguage,
    documentYearStyle: c.documentYearStyle,
    documentFooterTh: c.documentFooterTh,
    documentFooterEn: c.documentFooterEn,
});

const extrasOf = (c: CompanyProfileDto): Extras => ({
    businessProfiles: c.businessProfiles,
    defaultProjectType: c.defaultProjectType,
    defaults: c.defaults,
    logo: c.logo,
    stamp: c.stamp,
    signature: c.signature,
});

export function CompanyProfilePage() {
    const t = useTranslations('company');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const ws = useErpWorkspace();
    const wsId = ws.workspaceId;
    const mayEdit = can(ws.role, 'company.manage');
    const q = useCompanyProfile(wsId);

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')}>
            {q.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)}
                    extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : q.data === undefined || wsId === undefined ? (
                <Skeleton active />
            ) : (
                <CompanyForm key={q.data.updatedAt ?? 'default'} workspaceId={wsId} company={q.data} mayEdit={mayEdit} onSaved={() => { void message.success(t('saved')); }} />
            )}
        </ErpPage>
    );
}

function CompanyForm({ workspaceId, company, mayEdit, onSaved }: {
    workspaceId: string;
    company: CompanyProfileDto;
    mayEdit: boolean;
    onSaved: () => void;
}) {
    const t = useTranslations('company');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<FormValues>();
    const put = usePutCompanyProfile(workspaceId);
    const [extras, setExtras] = useState<Extras>(() => extrasOf(company));
    const [dirty, setDirty] = useState(false);
    const watchedVat = Form.useWatch('vatRegistered', form) as boolean | undefined;
    const vatRegistered = watchedVat ?? company.vatRegistered;
    const readOnly = !mayEdit;

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const initial = useMemo(() => formOf(company), [company]);
    const patchExtras = (p: Partial<Extras>) => { setExtras(e => ({ ...e, ...p })); setDirty(true); };

    const requiredMsg = (key: 'taxIdInvalid' | 'branchCodeInvalid' | 'emailInvalid' | 'promptpayInvalid') => t(`fields.${key}`);

    const submit = async (v: FormValues) => {
        const body: PutCompanyProfileRequest = {
            legalNameTh: v.legalNameTh,
            legalNameEn: v.legalNameEn,
            taxId: v.taxId,
            branchCode: v.branchCode,
            branchNameTh: v.branchNameTh,
            branchNameEn: v.branchNameEn,
            addressTh: v.addressTh,
            addressEn: v.addressEn,
            phone: v.phone,
            email: v.email,
            website: v.website,
            logoFileId: extras.logo?.id ?? null,
            stampFileId: extras.stamp?.id ?? null,
            signatureFileId: extras.signature?.id ?? null,
            vatRegistered: v.vatRegistered,
            vatRate: Math.round(v.vatRatePct * 1e4) / 1e6,
            businessProfiles: extras.businessProfiles,
            defaultProjectType: extras.defaultProjectType,
            defaultDocLanguage: v.defaultDocLanguage,
            documentYearStyle: v.documentYearStyle,
            bankAccounts: v.bankAccounts.map(b => ({
                bankCode: b.bankCode, bankName: b.bankName, accountName: b.accountName, accountNo: b.accountNo, branch: b.branch,
            })),
            promptpayId: v.promptpayId,
            defaults: extras.defaults,
            brandColor: v.brandColor,
            documentFooterTh: v.documentFooterTh,
            documentFooterEn: v.documentFooterEn,
        };
        try {
            await put.mutateAsync(body);
            setDirty(false);
            onSaved();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Form<FormValues> form={form} layout="vertical" disabled={readOnly || put.isPending} initialValues={initial} requiredMark={false}
            onValuesChange={() => setDirty(true)} onFinish={v => { void submit(v); }} scrollToFirstError>
            <div className="flex flex-col gap-4">
                {readOnly && <Alert type="info" showIcon title={t('readOnly')} />}
                {company.isDefault && <Alert type="warning" showIcon title={t('isDefault')} />}

                <SectionCard title={t('sections.identity')}>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="legalNameTh" label={t('fields.legalNameTh')} extra={t('fields.workspaceNameHint', { name: company.workspaceName })}>
                            <Input maxLength={200} placeholder={company.workspaceName} />
                        </Form.Item>
                        <Form.Item name="legalNameEn" label={t('fields.legalNameEn')}><Input maxLength={200} /></Form.Item>
                        <Form.Item name="taxId" label={t('fields.taxId')} extra={t('fields.taxIdHint')}
                            rules={[{ validator: (_, v: string | undefined) => (v === undefined || v === '' || isThaiTaxId(v) ? Promise.resolve() : Promise.reject(new Error(requiredMsg('taxIdInvalid')))) }]}>
                            <Input maxLength={13} inputMode="numeric" />
                        </Form.Item>
                        <Form.Item name="branchCode" label={t('fields.branchCode')} extra={t('fields.branchCodeHint')}
                            rules={[{ pattern: /^\d{5}$/, message: requiredMsg('branchCodeInvalid') }]}>
                            <Input maxLength={5} inputMode="numeric" />
                        </Form.Item>
                        <Form.Item name="branchNameTh" label={t('fields.branchNameTh')}><Input maxLength={120} /></Form.Item>
                        <Form.Item name="branchNameEn" label={t('fields.branchNameEn')}><Input maxLength={120} /></Form.Item>
                        <Form.Item name="addressTh" label={t('fields.addressTh')}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                        <Form.Item name="addressEn" label={t('fields.addressEn')}><Input.TextArea rows={3} maxLength={1000} /></Form.Item>
                        <Form.Item name="phone" label={t('fields.phone')}><Input maxLength={40} /></Form.Item>
                        <Form.Item name="email" label={t('fields.email')} rules={[{ type: 'email', message: requiredMsg('emailInvalid') }]}><Input maxLength={200} /></Form.Item>
                        <Form.Item name="website" label={t('fields.website')}><Input maxLength={200} /></Form.Item>
                    </div>
                </SectionCard>

                <SectionCard title={t('sections.tax')}>
                    <div className="flex flex-wrap items-end gap-6">
                        <Form.Item name="vatRegistered" label={t('fields.vatRegistered')} valuePropName="checked"><Switch /></Form.Item>
                        <Form.Item name="vatRatePct" label={t('fields.vatRate')}>
                            <InputNumber min={0} max={100} step={0.5} precision={2} disabled={!vatRegistered || readOnly} />
                        </Form.Item>
                    </div>
                    {!vatRegistered && <Alert type="info" showIcon title={t('fields.notVatHint')} />}
                </SectionCard>

                <SectionCard title={t('sections.bank')}>
                    <Form.List name="bankAccounts">
                        {(fields, { add, remove }) => (
                            <div className="flex flex-col gap-3">
                                {fields.length === 0 && <span className="text-gray-500">{t('bank.empty')}</span>}
                                {fields.map(field => (
                                    <div key={field.key} className="grid grid-cols-1 gap-x-3 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
                                        <Form.Item className="md:col-span-2" name={[field.name, 'bankName']} label={t('bank.bankName')} rules={[{ required: true, whitespace: true, message: ' ' }]}><Input maxLength={80} /></Form.Item>
                                        <Form.Item name={[field.name, 'bankCode']} label={t('bank.bankCode')}><Input maxLength={10} /></Form.Item>
                                        <Form.Item className="md:col-span-2" name={[field.name, 'accountName']} label={t('bank.accountName')} rules={[{ required: true, whitespace: true, message: ' ' }]}><Input maxLength={120} /></Form.Item>
                                        <Form.Item name={[field.name, 'accountNo']} label={t('bank.accountNo')}
                                            rules={[{ required: true, message: ' ' }, { pattern: /^[0-9-]+$/, message: t('bank.accountNoInvalid') }]}><Input maxLength={30} /></Form.Item>
                                        <Form.Item className="md:col-span-5" name={[field.name, 'branch']} label={t('bank.branch')}><Input maxLength={80} /></Form.Item>
                                        <div className="flex items-end justify-end pb-6">
                                            <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('bank.remove')} onClick={() => { remove(field.name); }} />
                                        </div>
                                    </div>
                                ))}
                                {!readOnly && fields.length < 10 && (
                                    <Button className="self-start" icon={<PlusOutlined />}
                                        onClick={() => { add({ bankCode: '', bankName: '', accountName: '', accountNo: '', branch: '' }); }}>{t('bank.add')}</Button>
                                )}
                            </div>
                        )}
                    </Form.List>
                    <Form.Item className="!mb-0 !mt-4 md:w-80" name="promptpayId" label={t('fields.promptpayId')} extra={t('fields.promptpayHint')}
                        rules={[{ pattern: /^(\d{10}|\d{13})?$/, message: requiredMsg('promptpayInvalid') }]}>
                        <Input maxLength={13} inputMode="numeric" />
                    </Form.Item>
                </SectionCard>

                <SectionCard title={t('sections.images')}>
                    <p className="mt-0 text-gray-500">{t('images.hint')}</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {([
                            ['logo', 'company_logo'], ['stamp', 'company_stamp'], ['signature', 'company_signature'],
                        ] as const).map(([key, purpose]) => (
                            <div key={key} className="flex flex-col gap-2">
                                <span className="font-medium">{t(`images.${key}`)}</span>
                                {extras[key] !== null && (
                                    // eslint-disable-next-line @next/next/no-img-element -- signed file link, size unknown
                                    <img src={extras[key].url} alt={t(`images.${key}`)} className="h-24 w-auto max-w-full self-start rounded border border-gray-200 bg-white object-contain p-1" />
                                )}
                                <FileAttachments purpose={purpose} workspaceId={workspaceId} maxCount={1} readOnly={readOnly}
                                    value={extras[key] === null ? [] : [extras[key]]}
                                    onChange={files => patchExtras({ [key]: files[files.length - 1] ?? null })} />
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title={t('sections.profiles')}>
                    <BusinessProfileStep disabled={readOnly || put.isPending}
                        value={{ businessProfiles: extras.businessProfiles, defaultProjectType: extras.defaultProjectType }}
                        onChange={v => patchExtras(v)} />
                </SectionCard>

                <SectionCard title={t('sections.defaults')}>
                    <ProjectDefaultsEditor disabled={readOnly || put.isPending} value={extras.defaults} onChange={defaults => patchExtras({ defaults })} />
                </SectionCard>

                <SectionCard title={t('sections.documents')}>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="defaultDocLanguage" label={t('fields.defaultDocLanguage')}>
                            <Segmented options={[{ value: 'th', label: t('languages.th') }, { value: 'en', label: t('languages.en') }]} />
                        </Form.Item>
                        <Form.Item name="documentYearStyle" label={t('fields.documentYearStyle')}>
                            <Select options={[{ value: 'ce', label: t('fields.yearStyleCe') }, { value: 'be', label: t('fields.yearStyleBe') }]} />
                        </Form.Item>
                        <Form.Item name="brandColor" label={t('fields.brandColor')} getValueFromEvent={(c: { toHexString: () => string }) => c.toHexString().toUpperCase()}>
                            <ColorPicker showText />
                        </Form.Item>
                        <span />
                        <Form.Item name="documentFooterTh" label={t('fields.footerTh')}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
                        <Form.Item name="documentFooterEn" label={t('fields.footerEn')}><Input.TextArea rows={2} maxLength={500} /></Form.Item>
                    </div>
                </SectionCard>

                {mayEdit && (
                    <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-gray-200 bg-white/90 py-3 backdrop-blur">
                        {dirty && <span className="text-orange-600">{t('unsaved')}</span>}
                        <Button disabled={!dirty || put.isPending} onClick={() => { form.resetFields(); setExtras(extrasOf(company)); setDirty(false); }}>{t('reset')}</Button>
                        <Button type="primary" htmlType="submit" loading={put.isPending}>{t('save')}</Button>
                    </div>
                )}

                <AuditTimeline workspaceId={workspaceId} entityType="company_profile" entityId={workspaceId} />
            </div>
        </Form>
    );
}
