'use client';

// ─── Small pieces shared by the two tabs of ทีมช่างและบุคลากร ───
import type { FormRule } from 'antd';
import {
    EMPLOYMENT_LABEL, EMPLOYMENT_TYPES, PERSON_ROLES, PERSON_ROLE_LABEL, WORKFORCE_NAME_MAX, WORKFORCE_NOTE_MAX,
    WORKFORCE_TRADE_IDS, WORKFORCE_TRADE_LABEL, WORKFORCE_WAGE_MAX, type RateCardDto,
} from '@/shared/contract';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { workforceConflictMessage } from '@/features/cloud/api/workforce';

export const TRADE_OPTIONS = WORKFORCE_TRADE_IDS.map(t => ({ value: t, label: WORKFORCE_TRADE_LABEL[t] }));
export const ROLE_OPTIONS = PERSON_ROLES.map(r => ({ value: r, label: PERSON_ROLE_LABEL[r] }));
export const EMPLOYMENT_OPTIONS = EMPLOYMENT_TYPES.map(e => ({ value: e, label: EMPLOYMENT_LABEL[e] }));

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
/** "3,400" (whole baht). */
export const baht = (n: number): string => BAHT.format(n);

export const rateCardLabel = (c: Pick<RateCardDto, 'name' | 'skilledRate' | 'labourerRate'>): string =>
    `${c.name} · ช่าง ${baht(c.skilledRate)} / คนงาน ${baht(c.labourerRate)}`;

/** The Thai message for a refused write: the 409 reason when there is one, else the general message. */
export const writeErrorMessage = (e: unknown): string => workforceConflictMessage(e) ?? thaiErrorMessage(e);

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

export const RULES = {
    name: [
        { required: true, whitespace: true, message: 'กรอกชื่อ' },
        { max: WORKFORCE_NAME_MAX, message: `ยาวได้ไม่เกิน ${String(WORKFORCE_NAME_MAX)} ตัวอักษร` },
    ],
    crewName: [
        { required: true, whitespace: true, message: 'ตั้งชื่อทีม เช่น ทีมก่อฉาบช่างแดง' },
        { max: WORKFORCE_NAME_MAX, message: `ยาวได้ไม่เกิน ${String(WORKFORCE_NAME_MAX)} ตัวอักษร` },
    ],
    trade: [{ required: true, message: 'เลือกสายงาน' }],
    nickname: [{ max: 40, message: 'ยาวได้ไม่เกิน 40 ตัวอักษร' }],
    phone: [
        { max: 20, message: 'ยาวได้ไม่เกิน 20 ตัวอักษร' },
        { pattern: /^\+?[\d\s-]*$/, message: 'ใช้ตัวเลข ช่องว่าง หรือขีด เช่น 081-234-5678' },
    ],
    wage: [{ type: 'number', min: 0, max: WORKFORCE_WAGE_MAX, message: `0–${baht(WORKFORCE_WAGE_MAX)} บาท` }],
    note: [{ max: WORKFORCE_NOTE_MAX, message: `ยาวได้ไม่เกิน ${String(WORKFORCE_NOTE_MAX)} ตัวอักษร` }],
} satisfies Record<string, FormRule[]>;

/** The card around each tab's table (same card as the members page). */
export function Card({ children }: { children: React.ReactNode }) {
    return <div className="bg-white border border-gray-200 rounded-card p-4 md:p-5 shadow-card min-w-0">{children}</div>;
}
