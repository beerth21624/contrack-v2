'use client';

import { Spin } from 'antd';
import { useProjectStore } from '@/store/project-store';
import { SchedulePage } from '@/features/planning/schedule/SchedulePage';

export default function ScheduleRoute() {
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return <SchedulePage />;
}
