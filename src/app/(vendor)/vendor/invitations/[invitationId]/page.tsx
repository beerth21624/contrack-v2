'use client';

import { useParams } from 'next/navigation';
import { InvitationPage } from '@/features/vendor/pages/InvitationPage';

export default function VendorInvitationRoute() {
    const params = useParams<{ invitationId: string }>();
    return <InvitationPage id={params.invitationId} />;
}
