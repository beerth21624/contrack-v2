'use client';

import { useParams } from 'next/navigation';
import { GuestPackagePage } from '@/features/vendor/pages/GuestPackagePage';

export default function GuestPackageRoute() {
    const params = useParams<{ token: string }>();
    return <GuestPackagePage token={params.token} />;
}
