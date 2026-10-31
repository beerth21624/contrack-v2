'use client';

// ─── A document's running number (`QT-2026-0001`), or the "draft" tag while it has none ───
import { Tag } from 'antd';
import { useTranslations } from 'next-intl';

export function DocumentNumberTag({ number, className }: { number: string | null | undefined; className?: string }) {
    const t = useTranslations('erp');
    if (number === null || number === undefined || number === '') {
        return <Tag className={`!m-0 ${className ?? ''}`}>{t('documentNumber.draft')}</Tag>;
    }
    return <span className={`font-mono tabular-nums whitespace-nowrap ${className ?? ''}`}>{number}</span>;
}
