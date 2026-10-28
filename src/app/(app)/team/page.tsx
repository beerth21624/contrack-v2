'use client';

import { Spin } from 'antd';
import { useProjectStore } from '@/store/project-store';
import { ProjectTeamPage } from '@/features/workforce/project-team/ProjectTeamPage';

export default function TeamRoute() {
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return <ProjectTeamPage />;
}
