'use client';

import { useParams } from 'next/navigation';
import { Spin } from 'antd';
import { useProjectStore } from '@/store/project-store';
import { LevelPage } from '@/features/journey/LevelPage';

export default function LevelRoute() {
    const params = useParams<{ level: string }>();
    const hasHydrated = useProjectStore(s => s.hasHydrated);
    if (!hasHydrated) return <div className="flex justify-center p-20"><Spin size="large" /></div>;
    // Keyed by level so moving to the next level starts from the top with fresh page state.
    return <LevelPage key={params.level} levelId={params.level} />;
}
