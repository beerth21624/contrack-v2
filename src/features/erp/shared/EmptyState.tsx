'use client';

// ─── Nothing to show yet: a calm empty picture, a line (and an optional hint) and an optional action ───
import type { ReactNode } from 'react';
import { Empty } from 'antd';
import { useTranslations } from 'next-intl';

export function EmptyState({ title, hint, action, className }: {
    /** Default: `erp.empty.default`. */
    title?: ReactNode;
    hint?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    const t = useTranslations('erp');
    return (
        <Empty
            className={className}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
                <div className="flex flex-col gap-1">
                    <span className="text-gray-900">{title ?? t('empty.default')}</span>
                    {hint !== undefined && <span className="text-secondary text-gray-500">{hint}</span>}
                </div>
            )}
        >
            {action}
        </Empty>
    );
}
