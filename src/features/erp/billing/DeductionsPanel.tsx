'use client';

// ─── Deductions of a claim (penalty, other, escalation indices) and the amounts the server worked out ───
import type { ReactNode } from 'react';
import { Checkbox, Input, InputNumber } from 'antd';
import { useTranslations } from 'next-intl';
import type { ArClaimDto, MainContractTerms } from '@/shared/contract';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';

export interface Deductions {
    periodFrom: string;
    periodTo: string;
    penaltyDays: number;
    /** null = computed from the days. */
    penaltyOverride: number | null;
    otherDeduction: number;
    otherDeductionNote: string;
    escalationIndices: Record<string, number>;
}

export function deductionsOf(c: ArClaimDto): Deductions {
    return {
        periodFrom: c.periodFrom ?? '',
        periodTo: c.periodTo ?? '',
        penaltyDays: c.penaltyDays,
        penaltyOverride: c.penaltyOverride,
        otherDeduction: c.otherDeduction,
        otherDeductionNote: c.otherDeductionNote,
        escalationIndices: c.escalationIndices,
    };
}

function Row({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
    return (
        <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? 'border-t border-gray-300 font-semibold' : ''}`}>
            <span className="min-w-0 break-words">{label}</span>{children}
        </div>
    );
}

export function DeductionsPanel({ claim, escalation, value, onChange, disabled }: {
    claim: ArClaimDto;
    escalation: MainContractTerms['escalation'];
    value: Deductions;
    onChange: (next: Deductions) => void;
    disabled: boolean;
}) {
    const t = useTranslations('billing');
    const set = <K extends keyof Deductions>(key: K, v: Deductions[K]) => onChange({ ...value, [key]: v });
    const milestone = claim.mode === 'milestone';

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('claims.periodFrom')}
                        <Input type="date" disabled={disabled} value={value.periodFrom} onChange={e => set('periodFrom', e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('claims.periodTo')}
                        <Input type="date" disabled={disabled} value={value.periodTo} onChange={e => set('periodTo', e.target.value)} />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('deductions.penaltyDays')}
                    <InputNumber<number> className="!w-full" min={0} max={36500} precision={0} disabled={disabled} value={value.penaltyDays}
                        onChange={v => set('penaltyDays', v ?? 0)} />
                </label>
                <div className="flex flex-col gap-1 text-[13px] text-gray-600">
                    <Checkbox disabled={disabled} checked={value.penaltyOverride !== null}
                        onChange={e => set('penaltyOverride', e.target.checked ? claim.penalty : null)}>{t('deductions.penaltyOverride')}</Checkbox>
                    {value.penaltyOverride !== null && (
                        <>
                            <MoneyInput disabled={disabled} value={value.penaltyOverride} max={claim.penaltyMax} onChange={v => set('penaltyOverride', v ?? 0)} />
                            <span className="text-gray-500">{t('deductions.penaltyMax')}: <MoneyText value={claim.penaltyMax} /></span>
                        </>
                    )}
                </div>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('deductions.other')}
                    <MoneyInput disabled={disabled} value={value.otherDeduction} onChange={v => set('otherDeduction', v ?? 0)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('deductions.otherNote')}
                    <Input disabled={disabled} maxLength={1000} value={value.otherDeductionNote} onChange={e => set('otherDeductionNote', e.target.value)} />
                </label>
                {escalation !== null && escalation.enabled && escalation.terms.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="text-[13px] font-medium text-gray-700">{t('deductions.indices')}</div>
                        {escalation.terms.map(term => (
                            <label key={term.index} className="flex flex-col gap-1 text-[13px] text-gray-600">
                                {term.index} <span className="text-gray-400">({t('deductions.baseIndex')}: {term.baseValue})</span>
                                <InputNumber<number> className="!w-full" min={0} step={0.01} disabled={disabled}
                                    value={value.escalationIndices[term.index] ?? null}
                                    onChange={v => {
                                        const rest = Object.fromEntries(Object.entries(value.escalationIndices).filter(([k]) => k !== term.index));
                                        set('escalationIndices', v === null || v <= 0 ? rest : { ...rest, [term.index]: v });
                                    }} />
                            </label>
                        ))}
                        {claim.escalationK !== null && <div className="text-[13px] text-gray-500">K = {claim.escalationK.toFixed(4)}</div>}
                    </div>
                )}
            </div>

            <div className="flex flex-col text-[14px]">
                <Row label={t('summary.workValue')}><MoneyText value={claim.workValue} /></Row>
                {!milestone && <Row label={t('summary.previous')}><MoneyText value={claim.previousValue} muted /></Row>}
                {!milestone && <Row label={t('summary.cumulative')}><MoneyText value={claim.cumulativeValue} muted /></Row>}
                {claim.escalation !== 0 && <Row label={t('summary.escalation')}><MoneyText value={claim.escalation} /></Row>}
                <Row label={t('summary.advanceRecovery')}><MoneyText value={-claim.advanceRecovery} /></Row>
                <Row label={t('summary.vatBase')}><MoneyText value={claim.vatBase} /></Row>
                <Row label={t('summary.vat')}><MoneyText value={claim.vat} /></Row>
                <Row label={t('summary.retention')}><MoneyText value={-claim.retention} /></Row>
                <Row label={t('summary.wht')}><MoneyText value={-claim.wht} /></Row>
                <Row label={t('summary.penalty')}><MoneyText value={-claim.penalty} /></Row>
                {claim.otherDeduction > 0 && <Row label={t('summary.other')}><MoneyText value={-claim.otherDeduction} /></Row>}
                <Row strong label={t('summary.payable')}><MoneyText value={claim.payable} currency /></Row>
            </div>
        </div>
    );
}
