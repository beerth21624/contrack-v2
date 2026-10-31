'use client';

// ─── Create / edit form of one customer (also inside the CustomerPicker's "new customer" dialog) ───
import { useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Segmented, Select } from 'antd';
import { useTranslations } from 'next-intl';
import {
    CUSTOMER_KINDS, type CreateCustomerInput, type CustomerDto, type CustomerKind, DOC_LANGUAGES, type DocLanguage,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { SectionCard } from '../shared/SectionCard';

interface FormValues {
    kind: CustomerKind;
    nameTh: string;
    nameEn: string;
    taxId: string;
    branchCode: string;
    addressTh: string;
    addressEn: string;
    contactName: string;
    phone: string;
    email: string;
    lineId: string;
    /** Percent (3), not a fraction; null = by kind. */
    whtRatePct: number | null;
    defaultDocLanguage: DocLanguage;
    paymentTermDays: number;
    note: string;
}

const initialOf = (c: CustomerDto | undefined, defaultName: string | undefined): FormValues => ({
    kind: c?.kind ?? 'individual',
    nameTh: c?.nameTh ?? defaultName ?? '',
    nameEn: c?.nameEn ?? '',
    taxId: c?.taxId ?? '',
    branchCode: c?.branchCode ?? '',
    addressTh: c?.addressTh ?? '',
    addressEn: c?.addressEn ?? '',
    contactName: c?.contactName ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    lineId: c?.lineId ?? '',
    whtRatePct: c?.defaultWhtRate === null || c === undefined ? null : Math.round(c.defaultWhtRate * 1e6) / 1e4,
    defaultDocLanguage: c?.defaultDocLanguage ?? 'th',
    paymentTermDays: c?.paymentTermDays ?? 30,
    note: c?.note ?? '',
});

/** Antd leaves a field undefined when it was never touched; trim strings. */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const toRequest = (v: FormValues): CreateCustomerInput => ({
    kind: v.kind,
    nameTh: str(v.nameTh),
    nameEn: str(v.nameEn),
    taxId: str(v.taxId),
    branchCode: str(v.branchCode),
    addressTh: str(v.addressTh),
    addressEn: str(v.addressEn),
    contactName: str(v.contactName),
    phone: str(v.phone),
    email: str(v.email),
    lineId: str(v.lineId),
    defaultWhtRate: typeof v.whtRatePct === 'number' ? Math.round(v.whtRatePct * 1e4) / 1e6 : null,
    defaultDocLanguage: v.defaultDocLanguage,
    paymentTermDays: typeof v.paymentTermDays === 'number' ? v.paymentTermDays : 30,
    note: str(v.note),
});

export function CustomerForm({ customer, defaultName, readOnly = false, submitting = false, submitLabel, onSubmit, onDirtyChange, onCancel, cancelLabel }: {
    customer?: CustomerDto;
    /** Prefills the Thai name of a new customer. */
    defaultName?: string;
    readOnly?: boolean;
    submitting?: boolean;
    submitLabel: string;
    /** Resolves when saved; a thrown error is shown and the form stays. */
    onSubmit: (body: CreateCustomerInput) => Promise<unknown>;
    onDirtyChange?: (dirty: boolean) => void;
    onCancel?: () => void;
    cancelLabel?: string;
}) {
    const t = useTranslations('customers');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const [form] = Form.useForm<FormValues>();
    const [problem, setProblem] = useState<string | null>(null);

    const submit = async (v: FormValues) => {
        setProblem(null);
        try {
            await onSubmit(toRequest(v));
            onDirtyChange?.(false);
        } catch (e) {
            const text = toText(e);
            setProblem(text);
            void message.error(text);
        }
    };

    return (
        <Form<FormValues> form={form} layout="vertical" disabled={readOnly || submitting} initialValues={initialOf(customer, defaultName)}
            requiredMark={false} onValuesChange={() => onDirtyChange?.(true)} onFinish={v => { void submit(v); }} scrollToFirstError>
            <div className="flex flex-col gap-4">
                {readOnly && <Alert type="info" showIcon title={t('readOnly')} />}
                {problem !== null && <Alert type="error" showIcon title={problem} />}
                <SectionCard title={t('sections.identity')}>
                    <Form.Item name="kind" label={t('fields.kind')}>
                        <Segmented options={CUSTOMER_KINDS.map(k => ({ value: k, label: tEnums(`customerKind.${k}`) }))} />
                    </Form.Item>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="nameTh" label={t('fields.nameTh')} extra={t('fields.nameHint')}
                            dependencies={['nameEn']}
                            rules={[({ getFieldValue }) => ({
                                validator: (_, v: string | undefined) => ((v ?? '').trim() !== '' || ((getFieldValue('nameEn') as string | undefined) ?? '').trim() !== ''
                                    ? Promise.resolve() : Promise.reject(new Error(t('fields.nameRequired')))),
                            })]}>
                            <Input maxLength={200} />
                        </Form.Item>
                        <Form.Item name="nameEn" label={t('fields.nameEn')}><Input maxLength={200} /></Form.Item>
                        <Form.Item name="taxId" label={t('fields.taxId')} extra={t('fields.taxIdHint')}><Input maxLength={20} inputMode="numeric" /></Form.Item>
                        <Form.Item name="branchCode" label={t('fields.branchCode')} extra={t('fields.branchCodeHint')}><Input maxLength={10} inputMode="numeric" /></Form.Item>
                        <Form.Item name="addressTh" label={t('fields.addressTh')}><Input.TextArea rows={3} maxLength={500} /></Form.Item>
                        <Form.Item name="addressEn" label={t('fields.addressEn')}><Input.TextArea rows={3} maxLength={500} /></Form.Item>
                    </div>
                </SectionCard>
                <SectionCard title={t('sections.contact')}>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="contactName" label={t('fields.contactName')}><Input maxLength={120} /></Form.Item>
                        <Form.Item name="phone" label={t('fields.phone')}><Input maxLength={40} inputMode="tel" /></Form.Item>
                        <Form.Item name="email" label={t('fields.email')} rules={[{ type: 'email', message: t('fields.emailInvalid') }]}>
                            <Input maxLength={200} inputMode="email" />
                        </Form.Item>
                        <Form.Item name="lineId" label={t('fields.lineId')}><Input maxLength={80} /></Form.Item>
                    </div>
                </SectionCard>
                <SectionCard title={t('sections.commercial')}>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
                        <Form.Item name="whtRatePct" label={t('fields.whtRate')} extra={t('fields.whtRateHint')}>
                            <InputNumber className="!w-full" min={0} max={100} step={0.5} precision={2} inputMode="decimal" />
                        </Form.Item>
                        <Form.Item name="paymentTermDays" label={t('fields.paymentTermDays')}>
                            <InputNumber className="!w-full" min={0} max={365} precision={0} inputMode="numeric" />
                        </Form.Item>
                        <Form.Item name="defaultDocLanguage" label={t('fields.docLanguage')}>
                            <Select options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                        </Form.Item>
                    </div>
                </SectionCard>
                <SectionCard title={t('sections.note')}>
                    <Form.Item name="note" noStyle><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
                </SectionCard>
                {!readOnly && (
                    <div className="flex flex-wrap justify-end gap-2">
                        {onCancel !== undefined && <Button onClick={onCancel} disabled={submitting}>{cancelLabel}</Button>}
                        <Button type="primary" htmlType="submit" loading={submitting}>{submitLabel}</Button>
                    </div>
                )}
            </div>
        </Form>
    );
}
