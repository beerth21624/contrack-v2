'use client';

import { useParams } from 'next/navigation';
import { PackagePage } from '@/features/subcontracting/buyer/package/PackagePage';

export default function PackageRoute() {
    const params = useParams<{ packageId: string }>();
    // Keyed by id so moving between packages starts with fresh page state.
    return <PackagePage key={params.packageId} packageId={params.packageId} />;
}
