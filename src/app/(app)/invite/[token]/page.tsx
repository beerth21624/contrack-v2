'use client';

import { useParams } from 'next/navigation';
import { AcceptInvitationPage } from '@/features/cloud/workspaces/AcceptInvitationPage';

export default function InviteRoute() {
    const params = useParams<{ token: string }>();
    return <AcceptInvitationPage token={params.token} />;
}