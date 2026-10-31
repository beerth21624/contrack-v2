'use client';

import { useParams } from 'next/navigation';
import { PublicLinkPage } from '@/features/erp/customer-links/PublicLinkPage';

export default function PublicLinkRoute() {
    const params = useParams<{ token: string }>();
    return <PublicLinkPage token={params.token} />;
}
