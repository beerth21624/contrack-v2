'use client';

// ─── Projects that need attention: the reasons the roll-ups give, with the overdue receivable when billing is on ───
import Link from 'next/link';
import { Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { RiskyProject } from '@/shared/contract';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { projectHref } from '../hub/ProjectCard';

export function RiskyProjects({ projects }: { projects: readonly RiskyProject[] }) {
    const t = useTranslations('portal');
    return (
        <SectionCard title={t('risky.title')}>
            {projects.length === 0 ? (
                <EmptyState title={t('risky.empty')} />
            ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-gray-100 p-0">
                    {projects.map(p => (
                        <li key={p.projectId}>
                            <Link href={projectHref(p.projectId)} className="flex min-w-0 flex-col gap-1 px-1 py-2.5 text-inherit no-underline hover:bg-gray-50">
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    <span className="truncate font-medium text-gray-900">{p.projectName}</span>
                                    {p.overdueReceivable !== null && <MoneyText value={p.overdueReceivable} className="text-red-600" />}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {p.reasons.map(r => <Tag key={r} color="error" className="!m-0">{t(`risky.reasons.${r}`)}</Tag>)}
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
