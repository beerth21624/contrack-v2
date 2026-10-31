'use client';

import { useParams } from 'next/navigation';
import { ModuleGate } from '@/features/modules/ModuleGate';
import { DiaryCalendarPage } from '@/features/erp/site-diary/DiaryCalendarPage';

export default function ProjectSiteDiaryRoute() {
    const params = useParams<{ projectId: string }>();
    return (
        <ModuleGate module="site-diary" next={`/p/${encodeURIComponent(params.projectId)}/site-diary`}>
            <DiaryCalendarPage projectId={params.projectId} />
        </ModuleGate>
    );
}
