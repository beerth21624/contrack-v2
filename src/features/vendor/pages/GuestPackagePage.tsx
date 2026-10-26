'use client';

// ─── /s/[token]: the job a buyer sent by LINE/SMS, readable without signing in ───
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Result } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeclineRequest, GuestPackageDto } from '@/shared/contract';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { vendorApi, vk } from '../api';
import { useGuestPackage, useVendorWorkspace } from '../hooks';
import { useNow } from '../now';
import { BottomBar, ErrorState, PageSpinner, Section, Sheet } from '../ui/common';
import { CreateCrewProfile } from '../ui/CreateCrewProfile';
import { AskQuestionSheet, DeclineSheet, PackageDetails, closedReason } from '../ui/PackageView';

function expired(e: unknown): boolean {
    return isApiError(e) && (e.status === 410 || e.code === 'invitation_invalid');
}

function GuestBody({ token, pkg }: { token: string; pkg: GuestPackageDto }) {
    const router = useRouter();
    const qc = useQueryClient();
    const { message } = App.useApp();
    const now = useNow();
    const status = useSession(s => s.status);
    const ws = useVendorWorkspace();
    const [sheet, setSheet] = useState<'ask' | 'decline' | 'crew' | null>(null);
    const invitationHref = `/vendor/invitations/${pkg.invitationId}`;

    const refresh = () => qc.invalidateQueries({ queryKey: vk.guest(token) });
    const ask = useMutation({
        mutationFn: (question: string) => vendorApi.guest.ask(token, { question }),
        onSuccess: () => { setSheet(null); void message.success('ส่งคำถามแล้ว ผู้ว่าจ้างตอบแล้วจะแสดงที่นี่'); void refresh(); },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    const decline = useMutation({
        mutationFn: (body: DeclineRequest) => vendorApi.guest.decline(token, body),
        onSuccess: () => { setSheet(null); void message.success('แจ้งผู้ว่าจ้างแล้ว'); void refresh(); },
        onError: (e) => { void message.error(thaiErrorMessage(e)); },
    });
    const claim = useMutation({
        mutationFn: (workspaceId: string) => vendorApi.claimInvitation(token, workspaceId),
        onSuccess: (res) => { router.push(`/vendor/invitations/${res.invitationId}`); },
        onError: (e) => {
            // Already linked to this crew (second visit): the invitation page opens anyway.
            if (pkg.linkedToVendor) router.push(invitationHref);
            else void message.error(thaiErrorMessage(e));
        },
    });

    const bid = () => {
        if (status !== 'signed-in') {
            router.push(`/vendor/login?token=${encodeURIComponent(token)}&next=${encodeURIComponent(invitationHref)}`);
            return;
        }
        if (ws.current !== undefined) claim.mutate(ws.current.workspaceId);
        else if (ws.none) setSheet('crew');
    };

    const closed = closedReason(pkg, now);
    const submitted = pkg.invitationStatus === 'submitted';
    const waitingForWorkspace = status === 'unknown' || (status === 'signed-in' && ws.isLoading);
    const openMine = () => router.push(status === 'signed-in' ? '/vendor' : `/vendor/login?token=${encodeURIComponent(token)}&next=%2Fvendor`);

    return (
        <>
            <div className="flex flex-col gap-3">
                {closed !== null && (
                    <Section tone={closed.tone === 'success' ? 'success' : 'default'}>
                        <div className={`text-section font-medium ${closed.tone === 'success' ? 'text-green-700' : 'text-gray-700'}`}>{closed.title}</div>
                        {pkg.outcome === 'won' && (
                            <Button className="!mt-3" type="primary" size="large" block onClick={openMine}>ดูงานของฉัน</Button>
                        )}
                    </Section>
                )}
                <PackageDetails pkg={pkg} onAsk={closed === null ? () => setSheet('ask') : undefined} />
                {closed === null && (
                    <div className="flex flex-col items-center gap-1 py-2">
                        <Button type="text" size="large" onClick={() => setSheet('decline')}>ไม่รับงานนี้</Button>
                    </div>
                )}
            </div>

            {closed === null && (
                <BottomBar>
                    <Button type="primary" size="large" block loading={claim.isPending || waitingForWorkspace} onClick={bid}>
                        {submitted ? 'ดูราคาที่ส่งแล้ว / ส่งราคาใหม่' : 'เสนอราคา'}
                    </Button>
                </BottomBar>
            )}

            <AskQuestionSheet open={sheet === 'ask'} onClose={() => setSheet(null)} busy={ask.isPending} onSubmit={q => ask.mutate(q)} />
            <DeclineSheet open={sheet === 'decline'} onClose={() => setSheet(null)} busy={decline.isPending} onSubmit={b => decline.mutate(b)} />
            <Sheet open={sheet === 'crew'} onClose={() => setSheet(null)} title="ก่อนเสนอราคา">
                <CreateCrewProfile defaultTrade={pkg.trade} onCreated={id => { setSheet(null); claim.mutate(id); }} />
            </Sheet>
        </>
    );
}

export function GuestPackagePage({ token }: { token: string }) {
    const q = useGuestPackage(token);
    if (q.isPending) return <PageSpinner />;
    if (q.isError) {
        if (expired(q.error)) {
            return <Result status="info" title="ลิงก์นี้หมดอายุหรือถูกยกเลิก" subTitle="ติดต่อผู้ว่าจ้างเพื่อขอลิงก์ใหม่" />;
        }
        return <ErrorState error={q.error} onRetry={() => { void q.refetch(); }} />;
    }
    return <GuestBody token={token} pkg={q.data} />;
}
