'use client';

// ─── The commercial terms of a contract: advance, retention, penalty, warranty, guarantee, K escalation ───
import { useState, type ReactNode } from 'react';
import { App, Button, Input, InputNumber, Select, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { PENALTY_BASES, RETENTION_RELEASES, type MainContractDto, type MainContractTerms } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { PercentInput } from '../quotations/PercentInput';
import { usePatchContract } from './hooks';

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
    return (
        <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
            <span>{label}</span>
            {children}
            {hint !== undefined && <span className="text-[12px] text-gray-400">{hint}</span>}
        </label>
    );
}


export function TermsForm({ contract, disabled, onSaved }: {
    contract: MainContractDto;
    disabled: boolean;
    /** Called after a successful save ("save and continue"). */
    onSaved?: () => void;
}) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchContract(contract.id);
    const [terms, setTerms] = useState<MainContractTerms>(contract.terms);
    const set = <K extends keyof MainContractTerms>(key: K, value: MainContractTerms[K]) => setTerms(s => ({ ...s, [key]: value }));
    const esc = terms.escalation;

    const escalationProblem = esc !== null && esc.enabled && esc.terms.length > 0
        && Math.abs(esc.terms.reduce((s, x) => s + x.weight, 0) + esc.fixed - 1) > 0.0001;

    const save = async () => {
        try {
            await patch.mutateAsync({ terms });
            void message.success(t('terms.saved'));
            onSaved?.();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label={t('terms.advancePct')} hint={t('terms.advanceHint')}>
                    <PercentInput value={terms.advancePct} max={30} disabled={disabled} onChange={v => set('advancePct', v ?? 0)} className="!w-full" />
                </Field>
                <Field label={t('terms.retentionPct')}>
                    <PercentInput value={terms.retentionPct} max={10} disabled={disabled} onChange={v => set('retentionPct', v ?? 0)} className="!w-full" />
                </Field>
                <Field label={t('terms.retentionCapPct')} hint={t('terms.retentionCapHint')}>
                    <PercentInput value={terms.retentionCapPct} max={100} allowEmpty disabled={disabled} onChange={v => set('retentionCapPct', v)} className="!w-full" />
                </Field>
                <Field label={t('terms.retentionRelease')}>
                    <Select<MainContractTerms['retentionRelease']> value={terms.retentionRelease} disabled={disabled} onChange={v => set('retentionRelease', v)}
                        options={RETENTION_RELEASES.map(v => ({ value: v, label: te(`retentionRelease.${v}`) }))} />
                </Field>
                <Field label={t('terms.customerWhtRate')}>
                    <PercentInput value={terms.customerWhtRate} max={15} disabled={disabled} onChange={v => set('customerWhtRate', v ?? 0)} className="!w-full" />
                </Field>
                <Field label={t('terms.paymentTermDays')}>
                    <InputNumber<number> className="!w-full" min={0} max={365} precision={0} disabled={disabled} value={terms.paymentTermDays}
                        onChange={v => set('paymentTermDays', v ?? 0)} />
                </Field>
                <Field label={t('terms.penaltyRatePerDay')}>
                    <PercentInput value={terms.penaltyRatePerDay} max={100} disabled={disabled} onChange={v => set('penaltyRatePerDay', v ?? 0)} className="!w-full" />
                </Field>
                <Field label={t('terms.penaltyBase')}>
                    <Select<MainContractTerms['penaltyBase']> value={terms.penaltyBase} disabled={disabled} onChange={v => set('penaltyBase', v)}
                        options={PENALTY_BASES.map(v => ({ value: v, label: te(`penaltyBase.${v}`) }))} />
                </Field>
                <Field label={t('terms.penaltyCapPct')}>
                    <PercentInput value={terms.penaltyCapPct} max={100} disabled={disabled} onChange={v => set('penaltyCapPct', v ?? 0)} className="!w-full" />
                </Field>
                <Field label={t('terms.warrantyMonths')}>
                    <InputNumber<number> className="!w-full" min={0} max={240} precision={0} disabled={disabled} value={terms.warrantyMonths}
                        onChange={v => set('warrantyMonths', v ?? 0)} />
                </Field>
                <Field label={t('terms.guaranteePct')}>
                    <PercentInput value={terms.guaranteePct} max={100} disabled={disabled} onChange={v => set('guaranteePct', v ?? 0)} className="!w-full" />
                </Field>
            </div>

            <div className="rounded-card border border-gray-200 p-3">
                <div className="flex items-center gap-2">
                    <Switch checked={esc?.enabled === true} disabled={disabled}
                        onChange={on => set('escalation', on
                            ? { fixed: 0.3, terms: [], threshold: 0.04, ...(esc ?? {}), enabled: true }
                            : (esc === null ? null : { ...esc, enabled: false }))} />
                    <span className="font-medium">{t('terms.escalation')}</span>
                    <span className="text-[12px] text-gray-400">{t('terms.escalationHint')}</span>
                </div>
                {esc !== null && esc.enabled && (
                    <div className="mt-3 flex flex-col gap-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <Field label={t('terms.escFixed')}>
                                <PercentInput value={esc.fixed} max={100} disabled={disabled} onChange={v => set('escalation', { ...esc, fixed: v ?? 0 })} className="!w-full" />
                            </Field>
                            <Field label={t('terms.escThreshold')}>
                                <PercentInput value={esc.threshold} max={100} disabled={disabled} onChange={v => set('escalation', { ...esc, threshold: v ?? 0 })} className="!w-full" />
                            </Field>
                        </div>
                        {esc.terms.map((row, i) => (
                            <div key={i} className="grid grid-cols-[1fr_110px_140px_auto] items-end gap-2 max-md:grid-cols-2">
                                <Field label={t('terms.escIndex')}>
                                    <Input value={row.index} disabled={disabled} maxLength={40}
                                        onChange={e => set('escalation', { ...esc, terms: esc.terms.map((x, j) => (j === i ? { ...x, index: e.target.value } : x)) })} />
                                </Field>
                                <Field label={t('terms.escWeight')}>
                                    <PercentInput value={row.weight} max={100} disabled={disabled} className="!w-full"
                                        onChange={v => set('escalation', { ...esc, terms: esc.terms.map((x, j) => (j === i ? { ...x, weight: v ?? 0 } : x)) })} />
                                </Field>
                                <Field label={t('terms.escBase')}>
                                    <InputNumber<number> className="!w-full" min={0.0001} max={1e9} disabled={disabled} value={row.baseValue}
                                        onChange={v => set('escalation', { ...esc, terms: esc.terms.map((x, j) => (j === i ? { ...x, baseValue: v ?? 1 } : x)) })} />
                                </Field>
                                <Button type="text" danger icon={<DeleteOutlined />} disabled={disabled} aria-label={t('actions.remove')}
                                    onClick={() => set('escalation', { ...esc, terms: esc.terms.filter((_, j) => j !== i) })} />
                            </div>
                        ))}
                        <div>
                            <Button icon={<PlusOutlined />} disabled={disabled || esc.terms.length >= 20}
                                onClick={() => set('escalation', { ...esc, terms: [...esc.terms, { index: '', weight: 0, baseValue: 100 }] })}>
                                {t('terms.escAdd')}
                            </Button>
                        </div>
                        {escalationProblem && <div className="text-[13px] text-amber-600">{t('terms.escSumWarning')}</div>}
                    </div>
                )}
            </div>

            {!disabled && (
                <div className="flex justify-end">
                    <Button type="primary" loading={patch.isPending}
                        disabled={esc !== null && esc.enabled && esc.terms.some(x => x.index.trim() === '')}
                        onClick={() => { void save(); }}>
                        {onSaved !== undefined ? t('actions.saveContinue') : t('actions.save')}
                    </Button>
                </div>
            )}
        </div>
    );
}

