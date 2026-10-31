'use client';

// ─── /p/<id>/site-diary: today's report, any day, the reports so far, the S-curve and the open problems ───
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, DatePicker, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { can, type SiteReportSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { OpenIssuesList } from './IssuesPanel';
import { ProgressChart } from './ProgressChart';
import { bangkokToday, diaryHref } from './form';
import { useSiteIssues, useSiteProgress, useSiteReports } from './hooks';

export function DiaryCalendarPage({ projectId }: { projectId: string }) {
    const t = useTranslations('siteDiary');
    const te = useTranslations('enums.siteWeather');
    const toText = useErrorMessage();
    const router = useRouter();
    const ws = useErpWorkspace();
    const today = bangkokToday();
    const reports = useSiteReports(projectId);
    const progress = useSiteProgress(projectId);
    const issues = useSiteIssues(projectId, 'open');
    const canReport = can(ws.role, 'site.report');
    const todayReport = (reports.data ?? []).find(r => r.reportDate === today);

    const columns: ColumnsType<SiteReportSummaryDto> = [
        { key: 'date', title: t('reports.columns.date'), render: (_, r) => <Link href={diaryHref(projectId, r.reportDate)} className="font-medium"><DateText value={r.reportDate} /></Link> },
        { key: 'status', title: t('reports.columns.status'), render: (_, r) => <StatusTag enumName="siteReportStatus" value={r.status} /> },
        {
            key: 'weather', title: t('reports.columns.weather'),
            render: (_, r) => [r.weatherMorning, r.weatherAfternoon].filter(w => w !== null).map(w => te(w)).join(' / ') || '–',
        },
        { key: 'people', title: t('reports.columns.people'), align: 'right', render: (_, r) => r.headcount },
        { key: 'work', title: t('reports.columns.work'), align: 'right', render: (_, r) => r.workItemCount },
        { key: 'photos', title: t('reports.columns.photos'), align: 'right', render: (_, r) => r.photoCount },
        { key: 'issues', title: t('reports.columns.issues'), align: 'right', render: (_, r) => r.openIssueCount },
    ];

    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <DatePicker allowClear={false} placeholder={t('pickDate')} disabledDate={d => d.isAfter(dayjs(today), 'day')}
                        onChange={d => { if (d !== null) router.push(diaryHref(projectId, d.format('YYYY-MM-DD'))); }} />
                    {(canReport || todayReport !== undefined) && (
                        <Button type="primary" onClick={() => router.push(diaryHref(projectId, today))}>
                            {todayReport === undefined ? t('writeToday') : t('openToday')}
                        </Button>
                    )}
                </div>
            )}
        >
            <SectionCard title={t('progress.title')}>
                {progress.isError ? <Alert type="error" showIcon title={toText(progress.error)} />
                    : progress.data === undefined ? <Skeleton active />
                        : <ProgressChart data={progress.data} />}
            </SectionCard>
            <SectionCard title={t('issues.title')}>
                {issues.isError ? <Alert type="error" showIcon title={toText(issues.error)} />
                    : issues.data === undefined ? <Skeleton active />
                        : <OpenIssuesList projectId={projectId} issues={issues.data} canResolve={canReport} />}
            </SectionCard>
            <SectionCard title={t('reports.title')}>
                {reports.isError ? <Alert type="error" showIcon title={toText(reports.error)} />
                    : (reports.data ?? []).length === 0 && !reports.isLoading
                        ? <EmptyState title={t('reports.empty')} hint={t('reports.emptyHint')} />
                        : <Table<SiteReportSummaryDto> rowKey="id" size="small" loading={reports.isLoading} columns={columns} dataSource={reports.data ?? []}
                            pagination={{ pageSize: 31, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} />}
            </SectionCard>
        </ErpPage>
    );
}
