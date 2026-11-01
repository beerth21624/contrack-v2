'use client';

// ─── Small pieces shared by the two tabs of ทีมช่างและบุคลากร ───
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { FormRule } from 'antd';
import {
    EMPLOYMENT_TYPES, PERSON_ROLES, WORKFORCE_NAME_MAX, WORKFORCE_NOTE_MAX, WORKFORCE_TRADE_IDS, WORKFORCE_WAGE_MAX,
    type RateCardDto,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { workforceConflictMessage } from '@/features/cloud/api/workforce';
import { employmentNameOf, roleNameOf, tradeNameOf, type WorkforceT } from '../text';

/** The select options of trades, person roles and employment types, labelled in the UI language. */
export function useWorkforceOptions() {
    const t = useTranslations('workforce');
    return useMemo(() => ({
        trades: WORKFORCE_TRADE_IDS.map(id => ({ value: id, label: tradeNameOf(t, id) })),
        roles: PERSON_ROLES.map(r => ({ value: r, label: roleNameOf(t, r) })),
        employment: EMPLOYMENT_TYPES.map(e => ({ value: e, label: employmentNameOf(t, e) })),
    }), [t]);
}

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
/** "3,400" (whole baht). */
export const baht = (n: number): string => BAHT.format(n);

export const rateCardLabel = (t: WorkforceT, c: Pick<RateCardDto, 'name' | 'skilledRate' | 'labourerRate'>): string =>
    t('rules.rateCard', { name: c.name, skilled: baht(c.skilledRate), labourers: baht(c.labourerRate) });

/** The message for a refused write: the 409 reason when there is one, else the general message. */
export function useWriteErrorMessage(): (e: unknown) => string {
    const errorMessage = useErrorMessage();
    return (e: unknown) => workforceConflictMessage(e) ?? errorMessage(e);
}

/** antd InputNumber parser/formatter for whole baht with thousands separators. */
export const bahtFormatter = (v: number | string | undefined): string => {
    if (v === undefined || v === '') return '';
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? BAHT.format(n) : String(v);
};
export const bahtParser = (v: string | undefined): number => {
    const n = Number((v ?? '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
};

/** The form rules of the crew and person editors, worded in the UI language. */
export function useWorkforceRules() {
    const t = useTranslations('workforce');
    return useMemo(() => {
        const max = (n: number): FormRule => ({ max: n, message: t('rules.maxChars', { max: String(n) }) });
        return {
            name: [{ required: true, whitespace: true, message: t('rules.nameRequired') }, max(WORKFORCE_NAME_MAX)],
            crewName: [{ required: true, whitespace: true, message: t('rules.crewNameRequired') }, max(WORKFORCE_NAME_MAX)],
            trade: [{ required: true, message: t('rules.tradeRequired') }],
            nickname: [max(40)],
            phone: [max(20), { pattern: /^\+?[\d\s-]*$/, message: t('rules.phonePattern') }],
            wage: [{ type: 'number', min: 0, max: WORKFORCE_WAGE_MAX, message: t('rules.wage', { max: baht(WORKFORCE_WAGE_MAX) }) }],
            note: [max(WORKFORCE_NOTE_MAX)],
        } satisfies Record<string, FormRule[]>;
    }, [t]);
}

/** The card around each tab's table (same card as the members page). */
export function Card({ children }: { children: React.ReactNode }) {
    return <div className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card min-w-0">{children}</div>;
}
