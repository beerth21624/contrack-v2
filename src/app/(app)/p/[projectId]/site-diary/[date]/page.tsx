'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { DailyReportPage } from '@/features/erp/site-diary/DailyReportPage';

export default function ProjectSiteDiaryDayRoute() {
    const params = useParams<{ projectId: string; date: string }>();
    return (
        <ModuleGate module="site-diary" next={`/p/${encodeURIComponent(params.projectId)}/site-diary/${encodeURIComponent(params.date)}`}>
            <DailyReportPage key={params.date} projectId={params.projectId} date={params.date} />
        </ModuleGate>
    );
}
