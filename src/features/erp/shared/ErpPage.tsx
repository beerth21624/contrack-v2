'use client';

// ─── The frame of every ERP screen: 1200 px column + page header (title, actions, breadcrumb) ───
// The app shell (AppLayoutUI) already gives the 16 px phone / 24 px desktop gutter; this only caps the width.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Breadcrumb } from 'antd';
import { useTranslations } from 'next-intl';

export interface ErpCrumb {
    label: ReactNode;
    /** Omit for the current page (last crumb). */
    href?: string;
}

export function ErpPage({ title, subtitle, extra, breadcrumb, children }: {
    title?: ReactNode;
    subtitle?: ReactNode;
    extra?: ReactNode;
    breadcrumb?: readonly ErpCrumb[];
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 w-full min-w-0">
            {title !== undefined && <PageHeader title={title} subtitle={subtitle} extra={extra} breadcrumb={breadcrumb} />}
            {children}
        </div>
    );
}

/** Title (and an optional line under it) left, actions right; stacks on phones. */
export function PageHeader({ title, subtitle, extra, breadcrumb }: {
    title: ReactNode;
    subtitle?: ReactNode;
    extra?: ReactNode;
    breadcrumb?: readonly ErpCrumb[];
}) {
    const t = useTranslations('erp');
    return (
        <header className="bg-white border border-gray-200 rounded-card p-5 max-md:p-4 shadow-card flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 min-w-0">
                {breadcrumb !== undefined && breadcrumb.length > 0 && (
                    <nav aria-label={t('page.breadcrumb')} className="mb-1">
                        <Breadcrumb
                            items={breadcrumb.map((c, i) => ({
                                key: i,
                                title: c.href !== undefined ? <Link href={c.href}>{c.label}</Link> : c.label,
                            }))}
                        />
                    </nav>
                )}
                <h1 className="text-page-title font-semibold text-gray-900 m-0 break-words">{title}</h1>
                {subtitle !== undefined && <div className="text-secondary text-gray-600 mt-1">{subtitle}</div>}
            </div>
            {extra !== undefined && <div className="flex flex-wrap items-center gap-2">{extra}</div>}
        </header>
    );
}
