'use client';

// ─── Document settings of a draft: format, detail level, language, VAT, starting rates, discount, rounding, Factor F parts,
// dates, payment terms, terms and notes ───
import { Alert, Button, Input, InputNumber, Select, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { QuotationPart, QuotationPricing } from '@/domain/quotation';
import {
    DETAIL_LEVELS, DOC_LANGUAGES, MILESTONE_TRIGGERS, QUOTATION_DISCOUNT_KINDS, QUOTATION_FORMATS, QUOTATION_ROUNDINGS,
    type MilestoneTemplateItem, type QuotationVatMode,
} from '@/shared/contract';
import { CustomerPicker } from '../shared/CustomerPicker';
import { MoneyInput } from '../shared/MoneyInput';
import { type EditorForm, type FormProblem, fitParts, sectionTitle } from './logic';
import { PercentInput } from './PercentInput';

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <label className={`flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 ${wide ? 'md:col-span-2' : ''}`}>
            {label}
            {children}
        </label>
    );
}

export function PricingPanel({ form, workspaceId, editable, seesMargins, vatRegistered, problems, onEdit, onFormat, onApplyRates }: {
    form: EditorForm;
    workspaceId: string;
    editable: boolean;
    seesMargins: boolean;
    vatRegistered: boolean;
    problems: readonly FormProblem[];
    onEdit: (patch: Partial<EditorForm>) => void;
    onFormat: (format: EditorForm['format']) => void;
    onApplyRates: () => void;
}) {
    const t = useTranslations('quotations');
    const tEnums = useTranslations('enums');
    const government = form.format === 'government';
    const p = form.pricing;
    const setPricing = (patch: Partial<QuotationPricing>) => onEdit({ pricing: { ...p, ...patch } });
    const disabled = !editable;
    const vatModes: QuotationVatMode[] = government ? ['included_in_factor'] : ['document', 'per_category', 'none'];
    const noDiscount = government || p.vatMode === 'per_category';
    const includedSections = form.sections.filter(s => s.included);

    const setParts = (parts: QuotationPart[]) => setPricing({ parts: fitParts(parts, form.sections) });
    const patchPart = (i: number, patch: Partial<QuotationPart>) => setParts(p.parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const assign = (i: number, nos: number[]) => setParts(p.parts.map((x, j) => (j === i
        ? { ...x, sectionNos: nos }
        : { ...x, sectionNos: x.sectionNos.filter(n => !nos.includes(n)) })));
    const addPart = () => {
        let n = p.parts.length + 1;
        while (p.parts.some(x => x.key === `p${n}`)) n += 1;
        setParts([...p.parts, { key: `p${n}`, titleTh: '', titleEn: '', sectionNos: [], factorF: 1 }]);
    };

    const terms = form.paymentTerms;
    const setTerms = (next: MilestoneTemplateItem[]) => onEdit({ paymentTerms: next });
    const patchTerm = (i: number, patch: Partial<MilestoneTemplateItem>) => setTerms(terms.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const termsPct = terms.reduce((s, x) => s + x.pct, 0);

    return (
        <div className="flex flex-col gap-5">
            {problems.length > 0 && (
                <Alert type="warning" showIcon title={t('problems.title')} description={<ul className="m-0 pl-4">{problems.map(x => <li key={x}>{t(`problems.${x}`)}</li>)}</ul>} />
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label={t('fields.title')} wide>
                    <Input value={form.title} maxLength={200} disabled={disabled} onChange={e => onEdit({ title: e.target.value })} />
                </Field>
                <Field label={t('fields.customer')} wide>
                    <CustomerPicker workspaceId={workspaceId} value={form.customerId} disabled={disabled} onChange={id => onEdit({ customerId: id })} />
                </Field>
                <Field label={t('fields.format')}>
                    <Select value={form.format} disabled={disabled} onChange={onFormat}
                        options={QUOTATION_FORMATS.map(f => ({ value: f, label: tEnums(`quotationFormat.${f}`) }))} />
                </Field>
                <Field label={t('fields.detailLevel')}>
                    <Select value={form.detailLevel} disabled={disabled || government} onChange={v => onEdit({ detailLevel: v })}
                        options={DETAIL_LEVELS.map(f => ({ value: f, label: tEnums(`detailLevel.${f}`) }))} />
                </Field>
                <Field label={t('fields.language')}>
                    <Select value={form.language} disabled={disabled} onChange={v => onEdit({ language: v })}
                        options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                </Field>
                <div className="hidden md:block" />
                <Field label={t('fields.issueDate')}>
                    <Input type="date" value={form.issueDate ?? ''} disabled={disabled} onChange={e => onEdit({ issueDate: e.target.value === '' ? null : e.target.value })} />
                </Field>
                <Field label={t('fields.validUntil')}>
                    <Input type="date" value={form.validUntil ?? ''} disabled={disabled} onChange={e => onEdit({ validUntil: e.target.value === '' ? null : e.target.value })} />
                </Field>
            </div>

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <div className="font-semibold">{t('pricing.vatTitle')}</div>
                {!vatRegistered && <Alert type="info" showIcon title={t('pricing.notVatRegistered')} />}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label={t('pricing.vatMode')}>
                        <Select value={p.vatMode} disabled={disabled || government || !vatRegistered} onChange={v => setPricing({ vatMode: v })}
                            options={vatModes.map(m => ({ value: m, label: t(`vatModes.${m}`) }))} />
                    </Field>
                    <Field label={t('pricing.vatRate')}>
                        <PercentInput className="!w-full" max={100} value={p.vatRate} disabled={disabled || !vatRegistered} onChange={v => { if (v !== null) setPricing({ vatRate: v }); }} />
                    </Field>
                </div>
            </div>

            {!government && seesMargins && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                    <div className="font-semibold">{t('pricing.ratesTitle')}</div>
                    <div className="text-[13px] text-gray-500">{t('pricing.ratesHint')}</div>
                    <div className="flex flex-wrap items-end gap-3">
                        {(['markupRate', 'overheadRate', 'profitRate'] as const).map(k => (
                            <Field key={k} label={t(`sections.${k}`)}>
                                <PercentInput value={p.defaults[k]} disabled={disabled} onChange={v => { if (v !== null) setPricing({ defaults: { ...p.defaults, [k]: v } }); }} />
                            </Field>
                        ))}
                        <Button disabled={disabled} onClick={onApplyRates}>{t('pricing.applyRates')}</Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <div className="font-semibold">{t('pricing.discountTitle')}</div>
                {noDiscount && <div className="text-[13px] text-gray-500">{t(government ? 'pricing.noDiscountGovernment' : 'pricing.noDiscountPerCategory')}</div>}
                <div className="flex flex-wrap items-end gap-3">
                    <Field label={t('pricing.discountKind')}>
                        <Select className="!w-[160px]" allowClear placeholder={t('pricing.noDiscount')} disabled={disabled || noDiscount}
                            value={p.discount?.kind}
                            onChange={v => setPricing({ discount: { kind: v, value: 0 } })}
                            onClear={() => setPricing({ discount: null })}
                            options={QUOTATION_DISCOUNT_KINDS.map(k => ({ value: k, label: t(`discountKinds.${k}`) }))} />
                    </Field>
                    {p.discount !== null && p.discount.kind === 'amount' && (
                        <Field label={t('pricing.discountValue')}>
                            <MoneyInput className="!w-[160px]" disabled={disabled || noDiscount} value={p.discount.value}
                                onChange={v => setPricing({ discount: { kind: 'amount', value: v ?? 0 } })} />
                        </Field>
                    )}
                    {p.discount !== null && p.discount.kind === 'pct' && (
                        <Field label={t('pricing.discountValue')}>
                            <PercentInput max={100} disabled={disabled || noDiscount} value={p.discount.value}
                                onChange={v => setPricing({ discount: { kind: 'pct', value: v ?? 0 } })} />
                        </Field>
                    )}
                    <Field label={t('pricing.rounding')}>
                        <Select className="!w-[200px]" value={p.rounding} disabled={disabled || noDiscount} onChange={v => setPricing({ rounding: v })}
                            options={QUOTATION_ROUNDINGS.map(r => ({ value: r, label: t(`roundings.${r}`) }))} />
                    </Field>
                </div>
            </div>

            {government && (
                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                    <div className="font-semibold">{t('pricing.partsTitle')}</div>
                    <div className="text-[13px] text-gray-500">{t('pricing.partsHint')}</div>
                    {p.parts.map((part, i) => (
                        <div key={part.key} className="grid grid-cols-1 gap-3 rounded-card border border-gray-100 bg-gray-50 p-3 md:grid-cols-2">
                            <Field label={t('pricing.partTitleTh')}>
                                <Input value={part.titleTh} maxLength={200} disabled={disabled} onChange={e => patchPart(i, { titleTh: e.target.value })} />
                            </Field>
                            <Field label={t('pricing.partTitleEn')}>
                                <Input value={part.titleEn} maxLength={200} disabled={disabled} onChange={e => patchPart(i, { titleEn: e.target.value })} />
                            </Field>
                            <Field label={t('pricing.factorF')}>
                                <InputNumber<number> className="!w-full tabular-nums" min={0.0001} max={10} step={0.01} precision={4} disabled={disabled}
                                    value={part.factorF} onChange={v => patchPart(i, { factorF: v ?? 1 })} />
                            </Field>
                            <Field label={t('pricing.partSections')}>
                                <Select mode="multiple" value={part.sectionNos} disabled={disabled} onChange={v => assign(i, v)}
                                    showSearch={{ optionFilterProp: 'label' }}
                                    options={includedSections.map(s => ({ value: s.sectionNo, label: `${s.sectionNo < 100 ? `${s.sectionNo}. ` : ''}${sectionTitle(s, 'th')}` }))} />
                            </Field>
                            {editable && p.parts.length > 1 && (
                                <div className="md:col-span-2">
                                    <Button danger size="small" icon={<DeleteOutlined />} onClick={() => setParts(p.parts.filter((_, j) => j !== i))}>{t('pricing.removePart')}</Button>
                                </div>
                            )}
                        </div>
                    ))}
                    {editable && <div><Button icon={<PlusOutlined />} onClick={addPart}>{t('pricing.addPart')}</Button></div>}
                </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <div className="font-semibold">{t('payment.title')}</div>
                <div className="text-[13px] text-gray-500">{t('payment.hint')}</div>
                {terms.map((x, i) => (
                    <div key={i} className="grid grid-cols-1 items-end gap-2 rounded-card border border-gray-100 bg-gray-50 p-3 md:grid-cols-[1fr_1fr_110px_170px_auto]">
                        <Field label={t('payment.labelTh')}><Input value={x.labelTh} maxLength={120} disabled={disabled} onChange={e => patchTerm(i, { labelTh: e.target.value })} /></Field>
                        <Field label={t('payment.labelEn')}><Input value={x.labelEn} maxLength={120} disabled={disabled} onChange={e => patchTerm(i, { labelEn: e.target.value })} /></Field>
                        <Field label={t('payment.pct')}>
                            <PercentInput className="!w-full" max={100} disabled={disabled} value={x.pct} onChange={v => patchTerm(i, { pct: v ?? 0 })} />
                        </Field>
                        <Field label={t('payment.trigger')}>
                            <Select value={x.trigger} disabled={disabled}
                                onChange={v => { const { progressAt: _drop, ...rest } = x; setTerms(terms.map((y, j) => (j === i ? (v === 'progress' ? { ...rest, trigger: v, progressAt: 0.5 } : { ...rest, trigger: v }) : y))); }}
                                options={MILESTONE_TRIGGERS.map(m => ({ value: m, label: tEnums(`milestoneTrigger.${m}`) }))} />
                        </Field>
                        <Space>
                            {x.trigger === 'progress' && (
                                <PercentInput max={100} disabled={disabled} value={x.progressAt ?? 0.5} aria-label={t('payment.progressAt')}
                                    onChange={v => patchTerm(i, { progressAt: v === null || v <= 0 ? 0.01 : v })} />
                            )}
                            {editable && <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('payment.remove')} onClick={() => setTerms(terms.filter((_, j) => j !== i))} />}
                        </Space>
                    </div>
                ))}
                <div className="flex flex-wrap items-center gap-3">
                    {editable && (
                        <Button icon={<PlusOutlined />}
                            onClick={() => setTerms([...terms, { labelTh: '', labelEn: '', pct: terms.length === 0 ? 1 : Math.max(0.0001, Math.round((1 - termsPct) * 1e6) / 1e6), trigger: 'manual' }])}>
                            {t('payment.add')}
                        </Button>
                    )}
                    {terms.length > 0 && <span className="text-[13px] text-gray-600">{t('payment.total', { pct: (termsPct * 100).toFixed(2) })}</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 md:grid-cols-2">
                <Field label={t('fields.termsTh')}>
                    <Input.TextArea rows={4} maxLength={10000} value={form.termsTh} disabled={disabled} onChange={e => onEdit({ termsTh: e.target.value })} />
                </Field>
                <Field label={t('fields.termsEn')}>
                    <Input.TextArea rows={4} maxLength={10000} value={form.termsEn} disabled={disabled} onChange={e => onEdit({ termsEn: e.target.value })} />
                </Field>
                <Field label={t('fields.note')} wide>
                    <Input.TextArea rows={2} maxLength={5000} value={form.note} disabled={disabled} onChange={e => onEdit({ note: e.target.value })} />
                </Field>
            </div>
        </div>
    );
}
