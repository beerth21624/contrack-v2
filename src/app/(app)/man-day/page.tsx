'use client';

import { Spin } from 'antd';
import { useProjectStore } from '@/store/project-store';
import { ManDayPage } from '@/features/planning/manday/ManDayPage';

export default function ManDayRoute() {
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    return <ManDayPage />;
}
