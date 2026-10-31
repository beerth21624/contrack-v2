'use client';

// ─── A status / enum value as a coloured tag; the text comes from `enums.<enumName>.<value>` ───
// Each module declares its labels in enums.json (th + en) and may pass its own colours; common status names get a
// sensible default tone (draft grey, pending blue, approved / paid green, rejected / void red, expired orange).
import { Tag } from 'antd';
import { useTranslations } from 'next-intl';

export type StatusTone = 'default' | 'processing' | 'success' | 'warning' | 'error';

type EnumsTranslator = ReturnType<typeof useTranslations<'enums'>>;
type EnumKey = Parameters<EnumsTranslator>[0];

const DEFAULT_TONES: Record<string, StatusTone> = {
    draft: 'default', open: 'processing', pending: 'processing', submitted: 'processing', sent: 'processing', in_progress: 'processing',
    issued: 'processing', partially_paid: 'warning', partially_received: 'warning', approved: 'success', accepted: 'success', signed: 'success',
    active: 'success', paid: 'success', received: 'success', completed: 'success', closed: 'default', rejected: 'error', void: 'error',
    voided: 'error', cancelled: 'error', expired: 'warning', overdue: 'error', on_hold: 'warning', superseded: 'default',
};

/** The tone of a status value (the module's own map first, then the defaults, else grey). */
export function statusTone(value: string, tones?: Partial<Record<string, StatusTone>>): StatusTone {
    return tones?.[value] ?? DEFAULT_TONES[value] ?? 'default';
}

export function StatusTag({ enumName, value, tones, className }: {
    /** The enum's key in enums.json, e.g. `quotationStatus`. */
    enumName: string;
    value: string;
    tones?: Partial<Record<string, StatusTone>>;
    className?: string;
}) {
    const te = useTranslations('enums');
    const key = `${enumName}.${value}` as EnumKey;
    // A value without a label (new server, old web) shows as it is rather than breaking the page.
    const label = te.has(key) ? te(key) : value;
    return <Tag color={statusTone(value, tones)} className={`!m-0 ${className ?? ''}`}>{label}</Tag>;
}
