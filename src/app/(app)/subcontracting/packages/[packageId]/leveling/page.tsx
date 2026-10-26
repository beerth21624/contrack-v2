'use client';

import { useParams } from 'next/navigation';
import { LevelingPage } from '@/features/subcontracting/buyer/leveling/LevelingPage';

export default function LevelingRoute() {
    const params = useParams<{ packageId: string }>();
    return <LevelingPage key={params.packageId} packageId={params.packageId} />;
}
