'use client';

import { useParams } from 'next/navigation';
import { ProjectOverviewPage } from '@/features/erp/hub/ProjectOverviewPage';

export default function ProjectOverviewRoute() {
    const params = useParams<{ projectId: string }>();
    return <ProjectOverviewPage projectId={params.projectId} />;
}
