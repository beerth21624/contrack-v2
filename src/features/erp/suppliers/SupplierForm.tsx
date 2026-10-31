'use client';

// ─── Create / edit form of one supplier (also inside the SupplierPicker's "new supplier" dialog) ───
import { useState } from 'react';
import { Alert, App, Button, Form, Input, InputNumber, Select, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    type BankAccount, type CreateSupplierInput, SUPPLIER_BANK_ACCOUNTS_MAX, SUPPLIER_KINDS, SUPPLIER_WHT_PRESETS,
    SUPPLIER_WHT_PRESET_RATE, type SupplierDto, type SupplierKind, type SupplierWhtPreset, TRADE_IDS, type TradeId,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { SectionCard } from '../shared/SectionCard';

interface FormValues {
    kind: SupplierKind;
    nameTh: string;
    nameEn: string;
    taxId: string;
    branchCode: string;
    isJuristic: boolean;
    vatRegistered: boolean;
    addressTh: string;
    addressEn: string;
    contactName: string;
    phone: string;
    email: string;
    lineId: string;
    trades: TradeId[];
    creditTermDays: number;
    defaultWhtPreset: SupplierWhtPreset;
    bankAccounts: BankAccount[];
    note: string;
}

const initialOf = (s: SupplierDto | undefined, defaultName: string | undefined, defaultKind: SupplierKind | undefined, defaultTrades: TradeId[]): FormValues => ({
    kind: s?.kind ?? defaultKind ?? 'material',
    nameTh: s?.nameTh ?? defaultName ?? '',
    nameEn: s?.nameEn ?? '',
    taxId: s?.taxId ?? '',
    branchCode: s?.branchCode ?? '',
    isJuristic: s?.isJuristic ?? true,
    vatRegistered: s?.vatRegistered ?? true,
    addressTh: s?.addressTh ?? '',
    addressEn: s?.addressEn ?? '',
    contactName: s?.contactName ?? '',
    phone: s?.phone ?? '',
    email: s?.email ?? '',
    lineId: s?.lineId ?? '',
    trades: s?.trades ?? defaultTrades,
    creditTermDays: s?.creditTermDays ?? 30,
    defaultWhtPreset: s?.defaultWhtPreset ?? 'none',
    bankAccounts: s?.bankAccounts ?? [],
    note: s?.note ?? '',
});

/** Antd leaves a field undefined when it was never touched; trim strings. */
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const toRequest = (v: FormValues): CreateSupplierInput => ({
    kind: v.kind,
    nameTh: str(v.nameTh),
    nameEn: str(v.nameEn),
    taxId: str(v.taxId),
    branchCode: str(v.branchCode),
    isJuristic: v.isJuristic,
    vatRegistered: v.vatRegistered,
    addressTh: str(v.addressTh),
    addressEn: str(v.addressEn),
    contactName: str(v.contactName),
    phone: str(v.phone),
    email: str(v.email),
    lineId: str(v.lineId),
    trades: v.trades,
    creditTermDays: typeof v.creditTermDays === 'number' ? v.creditTermDays : 30,
    defaultWhtPreset: v.defaultWhtPreset,
    bankAccounts: v.bankAccounts.map(b => ({
        bankCode: str(b.bankCode), bankName: str(b.bankName), accountName: str(b.accountName), accountNo: str(b.accountNo), branch: str(b.branch),
    })),
    note: str(v.note),
});

const NO_TRADES: TradeId[] = [];

const pct = (rate: number): string => `${Math.round(rate * 10_000) / 100}%`;

export function SupplierForm({ supplier, defaultName, defaultKind, defaultTrades = NO_TRADES, readOnly = false, submitting = false, submitLabel, onSubmit, onDirtyChange, onCancel, cancelLabel }: {
    supplier?: SupplierDto;
    /** Prefills the Thai name / kind / trades of a new supplier. */
    defaultName?: string;
    defaultKind?: SupplierKind;
    defaultTrades?: TradeId[];
    readOnly?: boolean;
    submitting?: boolean;
    submitLabel: string;
    /** Resolves when saved; a thrown error is shown and the form stays. */
    onSubmit: (body: CreateSupplierInput) => Promise<unknown>;
    onDirtyChange?: (dirty: boolean) => void;
    onCancel?: () => void;
    cancelLabel?: string;
}) {
    const t = useTranslations('suppliers');
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
        <Form<FormValues> form={form} layout="vertical" disabled={readOnly || submitting} initialValues={initialOf(supplier, defaultName, defaultKind, defaultTrades)}
            requiredMark={false} onValuesChange={() => onDirtyChange?.(true)} onFinish={v => { void submit(v); }} scrollToFirstError>
            <div className="flex flex-col gap-4">
                {readOnly && <Alert type="info" showIcon title={t('readOnly')} />}
                {problem !== null && <Alert type="error" showIcon title={problem} />}
                <SectionCard title={t('sections.identity')}>
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="kind" label={t('fields.kind')}>
                            <Select options={SUPPLIER_KINDS.map(k => ({ value: k, label: tEnums(`supplierKind.${k}`) }))} />
                        </Form.Item>
                        <Form.Item name="trades" label={t('fields.trades')} extra={t('fields.tradesHint')}>
                            <Select mode="multiple" allowClear maxTagCount="responsive"
                                options={TRADE_IDS.map(id => ({ value: id, label: tEnums(`trade.${id}`) }))} />
                        </Form.Item>
                        <Form.Item name="nameTh" label={t('fields.nameTh')} extra={t('fields.nameHint')}
                            dependencies={['nameEn']}
                            rules={[({ getFieldValue }) => ({
                                validator: (_, v: string | undefined) => ((v ?? '').trim() !== '' || ((getFieldValue('nameEn') as string | undefined) ?? '').trim() !== ''
                                    ? Promise.resolve() : Promise.reject(new Error(t('fields.nameRequired')))),
                            })]}>
                            <Input maxLength={200} />
                        </Form.Item>
                        <Form.Item name="nameEn" label={t('fields.nameEn')}><Input maxLength={200} /></Form.Item>
                        <Form.Item name="taxId" label={t('fields.taxId')}><Input maxLength={20} inputMode="numeric" /></Form.Item>
                        <Form.Item name="branchCode" label={t('fields.branchCode')} extra={t('fields.branchCodeHint')}><Input maxLength={10} inputMode="numeric" /></Form.Item>
                        <Form.Item name="isJuristic" label={t('fields.isJuristic')} extra={t('fields.isJuristicHint')} valuePropName="checked"><Switch /></Form.Item>
                        <Form.Item name="vatRegistered" label={t('fields.vatRegistered')} valuePropName="checked"><Switch /></Form.Item>
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
                    <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
                        <Form.Item name="defaultWhtPreset" label={t('fields.whtPreset')} extra={t('fields.whtPresetHint')}>
                            <Select options={SUPPLIER_WHT_PRESETS.map(p => ({
                                value: p, label: `${tEnums(`whtPreset.${p}`)} (${pct(SUPPLIER_WHT_PRESET_RATE[p])})`,
                            }))} />
                        </Form.Item>
                        <Form.Item name="creditTermDays" label={t('fields.creditTermDays')}>
                            <InputNumber className="!w-full" min={0} max={365} precision={0} inputMode="numeric" />
                        </Form.Item>
                    </div>
                </SectionCard>
                <SectionCard title={t('sections.bank')}>
                    <Form.List name="bankAccounts">
                        {(fields, { add, remove }) => (
                            <div className="flex flex-col gap-3">
                                {fields.length === 0 && <span className="text-gray-500">{t('bank.empty')}</span>}
                                {fields.map(field => (
                                    <div key={field.key} className="grid grid-cols-1 gap-x-3 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
                                        <Form.Item className="md:col-span-2" name={[field.name, 'bankName']} label={t('bank.bankName')}
                                            rules={[{ required: true, whitespace: true, message: t('bank.required') }]}><Input maxLength={80} /></Form.Item>
                                        <Form.Item name={[field.name, 'bankCode']} label={t('bank.bankCode')}><Input maxLength={10} /></Form.Item>
                                        <Form.Item className="md:col-span-2" name={[field.name, 'accountName']} label={t('bank.accountName')}
                                            rules={[{ required: true, whitespace: true, message: t('bank.required') }]}><Input maxLength={120} /></Form.Item>
                                        <Form.Item name={[field.name, 'accountNo']} label={t('bank.accountNo')}
                                            rules={[{ required: true, message: t('bank.required') }, { pattern: /^[0-9-]+$/, message: t('bank.accountNoInvalid') }]}>
                                            <Input maxLength={30} inputMode="numeric" />
                                        </Form.Item>
                                        <Form.Item className="md:col-span-5" name={[field.name, 'branch']} label={t('bank.branch')}><Input maxLength={80} /></Form.Item>
                                        {!readOnly && (
                                            <div className="flex items-end justify-end pb-6">
                                                <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('bank.remove')} onClick={() => { remove(field.name); }} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {!readOnly && fields.length < SUPPLIER_BANK_ACCOUNTS_MAX && (
                                    <Button className="self-start" icon={<PlusOutlined />}
                                        onClick={() => { add({ bankCode: '', bankName: '', accountName: '', accountNo: '', branch: '' }); }}>{t('bank.add')}</Button>
                                )}
                            </div>
                        )}
                    </Form.List>
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
