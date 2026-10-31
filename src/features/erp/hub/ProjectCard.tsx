'use client';

// ─── One project in the hub grid: name, code, status, customer, site, period and the figures modules supply ───
import Link from 'next/link';
import { Progress, Tag } from 'antd';
import { EnvironmentOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { HubProjectDto, ProjectType } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { PROJECT_STATUS_TONES } from './status';

export const projectHref = (projectId: string): string => `/p/${encodeURIComponent(projectId)}`;

export function ProjectCard({ row, defaultType }: {
    row: HubProjectDto;
    /** The company's default project type (for rows without their own); undefined = unknown, the type is left out. */
    defaultType?: ProjectType;
}) {
    const t = useTranslations('hub');
    const tEnums = useTranslations('enums');
    const fmt = useFormat();
    const { project, hub, rollup } = row;
    const start = hub.actualStart ?? hub.plannedStart;
    const finish = hub.actualFinish ?? hub.plannedFinish;
    const progress = rollup.progressPct;
    const type = hub.projectType ?? defaultType;

    return (
        <Link href={projectHref(project.id)}
            className="flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 bg-white p-4 text-inherit no-underline transition hover:border-orange-300 hover:shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-gray-900" title={project.name}>{project.name}</div>
                    <div className="truncate text-[12px] text-gray-500 tabular-nums">{hub.code ?? t('noCode')}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusTag enumName="projectStatus" value={hub.status} tones={PROJECT_STATUS_TONES} />
                    {project.archivedAt !== null && <Tag className="!m-0">{t('archivedTag')}</Tag>}
                </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                <span className="flex min-w-0 items-center gap-2">
                    <UserOutlined className="shrink-0 text-gray-400" />
                    <span className="truncate">{row.customerName ?? t('noCustomer')}</span>
                </span>
                {hub.siteAddress !== '' && (
                    <span className="flex min-w-0 items-center gap-2">
                        <EnvironmentOutlined className="shrink-0 text-gray-400" />
                        <span className="truncate" title={hub.siteAddress}>{hub.siteAddress}</span>
                    </span>
                )}
                {(start !== null || finish !== null) && (
                    <span className="flex min-w-0 items-center gap-2">
                        <CalendarOutlined className="shrink-0 text-gray-400" />
                        <span className="truncate tabular-nums">{start === null ? '–' : fmt.date(start)} – {finish === null ? '–' : fmt.date(finish)}</span>
                    </span>
                )}
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-gray-100 pt-2 text-[12px] text-gray-500">
                <span>{type === undefined ? '' : tEnums(`projectType.${type}`)}</span>
                {rollup.contractValue !== null && (
                    <span>{t('card.contractValue')} <MoneyText value={rollup.contractValue} className="font-medium text-gray-900" /></span>
                )}
            </div>
            {progress !== null && (
                <Progress percent={Math.round(progress * 100)} size="small" strokeColor="#F97316" className="!mb-0" />
            )}
        </Link>
    );
}
