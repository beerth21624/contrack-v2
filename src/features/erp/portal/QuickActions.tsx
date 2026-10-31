'use client';

// ─── Quick actions: the buttons the role and the active modules allow ───
import Link from 'next/link';
import { Button } from 'antd';
import { useTranslations } from 'next-intl';
import type { QuickAction } from '@/shared/contract';

export function QuickActions({ actions }: { actions: readonly QuickAction[] }) {
    const t = useTranslations('portal');
    if (actions.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2" aria-label={t('quickActions.title')}>
            {actions.map((a, i) => (
                <Link key={a.id} href={a.href}>
                    <Button type={i === 0 ? 'primary' : 'default'}>{t(`quickActions.${a.id}`)}</Button>
                </Link>
            ))}
        </div>
    );
}
