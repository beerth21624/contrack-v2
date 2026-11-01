'use client';

// ─── /vendor/login: phone number → 6-digit SMS code (→ name and team for a new phone) → signed in ───
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, Button, Input } from 'antd';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { OTP_LENGTH, formatThaiPhone, phoneSchema, type MyVendorsDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { safeNext } from '@/features/cloud/auth/form-rules';
import { useSession } from '@/features/cloud/auth/session';
import { vendorApi, vk } from '../api';
import { maskedPhoneTail, phoneMatchesMasked } from '../format';
import { useGuestPackage } from '../hooks';
import { useNow } from '../now';
import { useVendorWorkspaceStore } from '../workspace-store';
import { Section } from '../ui/common';
import { CreateCrewProfile } from '../ui/CreateCrewProfile';

const RESEND_AFTER_MS = 60_000;

type Step = 'phone' | 'code' | 'team' | 'crew' | 'finishing';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-secondary font-medium text-gray-700">{label}</span>
            {children}
            {hint !== undefined && <span className="text-caption text-gray-500">{hint}</span>}
        </label>
    );
}

export function VendorLoginPage() {
    const t = useTranslations('vendor');
    const toText = useErrorMessage();
    const router = useRouter();
    const qc = useQueryClient();
    const params = useSearchParams();
    const token = params.get('token');
    const next = safeNext(params.get('next'), '/vendor');
    const status = useSession(s => s.status);
    const selectWorkspace = useVendorWorkspaceStore(s => s.select);
    const invitation = useGuestPackage(token);
    const now = useNow(1000);

    const [step, setStep] = useState<Step>('phone');
    const [phone, setPhone] = useState('');
    const [exists, setExists] = useState(true);
    const [sentAt, setSentAt] = useState<number | null>(null);
    const [code, setCode] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [teamName, setTeamName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [vendors, setVendors] = useState<MyVendorsDto>([]);

    const masked = invitation.data?.invitedPhoneMasked ?? '';
    // The buyer's name for the crew is the default team name (typing replaces it).
    const invitedName = invitation.data?.invitedDisplayName ?? '';
    const team = teamName.trim() === '' ? invitedName.trim() : teamName.trim();
    const tail = maskedPhoneTail(masked);
    const parsedPhone = phoneSchema.safeParse(phone);
    const e164 = parsedPhone.success ? parsedPhone.data : null;
    const waitMs = sentAt === null || now === 0 ? 0 : Math.max(0, sentAt + RESEND_AFTER_MS - now);

    /** Signed in: link the invitation to the crew and go on. */
    const enter = async (workspaceId: string) => {
        setStep('finishing');
        selectWorkspace(workspaceId);
        if (token !== null && token !== '') {
            // The sign-in may already have linked it (new phone + invitationToken): a refusal here is not an error.
            await vendorApi.claimInvitation(token, workspaceId).catch(() => undefined);
        }
        await qc.invalidateQueries({ queryKey: vk.all });
        router.replace(next);
    };

    const afterSignIn = async (hint: string | null) => {
        const list = await vendorApi.me().catch((): MyVendorsDto => []);
        qc.setQueryData(vk.me, list);
        setVendors(list);
        if (list.length > 1) { setStep('team'); return; }
        const ws = list[0]?.workspaceId ?? hint;
        if (ws !== null) { await enter(ws); return; }
        if (token !== null && token !== '') { setStep('crew'); return; }
        setStep('finishing');
        router.replace(next);
    };

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError(toText(e));
        } finally {
            setBusy(false);
        }
    };

    const sendCode = () => run(async () => {
        if (e164 === null) { setError(t('login.invalidPhone')); return; }
        const res = await vendorApi.otp.check({ phone: e164 });
        await vendorApi.otp.request({ phone: e164 });
        setExists(res.exists);
        setSentAt(Date.now());
        setCode('');
        setStep('code');
    });

    const resend = () => run(async () => {
        if (e164 === null) return;
        await vendorApi.otp.request({ phone: e164 });
        setSentAt(Date.now());
    });

    const needNames = !exists;
    const codeOk = code.length === OTP_LENGTH;
    const namesOk = !needNames || (displayName.trim() !== '' && team !== '');

    const verify = () => run(async () => {
        if (e164 === null || !codeOk) return;
        const res = await vendorApi.otp.verify({
            phone: e164,
            code,
            displayName: needNames ? displayName.trim() : undefined,
            teamName: needNames ? team : undefined,
            invitationToken: token !== null && token.length >= 16 ? token : undefined,
        });
        await afterSignIn(res.vendorWorkspaceId);
    });

    if (step === 'phone' && status === 'signed-in') {
        return (
            <Section title={t('login.alreadySignedIn')}>
                <Button type="primary" size="large" block loading={busy} onClick={() => { void run(() => afterSignIn(null)); }}>{t('login.continue')}</Button>
            </Section>
        );
    }

    if (step === 'team') {
        return (
            <Section title={t('login.whichTeam')}>
                <div className="flex flex-col gap-2">
                    {vendors.map(v => (
                        <Button key={v.workspaceId} size="large" block onClick={() => { void run(() => enter(v.workspaceId)); }} disabled={busy}>
                            {v.teamName}
                        </Button>
                    ))}
                </div>
            </Section>
        );
    }

    if (step === 'crew') {
        return (
            <Section>
                <CreateCrewProfile defaultTrade={invitation.data?.trade} onCreated={id => { void run(() => enter(id)); }} />
            </Section>
        );
    }

    return (
        <Section>
            <h1 className="m-0 text-page-title font-semibold">{t('login.title')}</h1>
            <p className="m-0 mt-1 mb-4 text-secondary text-gray-600">{t('login.subtitle')}</p>
            {error !== null && <Alert type="error" showIcon title={error} className="!mb-4" />}

            {step === 'phone' && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void sendCode(); }}>
                    <Field label={t('login.mobile')} hint={tail === '' ? undefined : t('login.invitedTail', { tail })}>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel"
                            placeholder="081-234-5678" maxLength={16} autoFocus />
                    </Field>
                    {e164 !== null && !phoneMatchesMasked(phone, masked) && (
                        <div className="text-caption text-amber-600">{t('login.phoneMismatch')}</div>
                    )}
                    <Button type="primary" htmlType="submit" size="large" block loading={busy} disabled={e164 === null}>{t('login.requestCode')}</Button>
                </form>
            )}

            {(step === 'code' || step === 'finishing') && (
                <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); void verify(); }}>
                    <div className="text-body text-gray-700">
                        {t('login.codeSentTo')} <span className="font-medium">{e164 === null ? phone : formatThaiPhone(e164)}</span>
                        <Button type="link" size="small" onClick={() => { setStep('phone'); setError(null); }}>{t('login.changeNumber')}</Button>
                    </div>
                    <Field label={t('login.code6')}>
                        <Input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
                            inputMode="numeric" autoComplete="one-time-code" maxLength={OTP_LENGTH} autoFocus
                            style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', height: 56 }} aria-label={t('login.code6')} />
                    </Field>
                    {needNames && (
                        <>
                            <Field label={t('createProfile.contactName')}>
                                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} autoComplete="name" placeholder={t('login.namePlaceholder')} />
                            </Field>
                            <Field label={t('createProfile.teamName')} hint={t('login.teamHint')}>
                                <Input value={teamName} onChange={e => setTeamName(e.target.value)} maxLength={120} autoComplete="organization" placeholder={invitedName === '' ? t('createProfile.teamNamePlaceholder') : invitedName} />
                            </Field>
                        </>
                    )}
                    <Button type="primary" htmlType="submit" size="large" block loading={busy || step === 'finishing'} disabled={!codeOk || !namesOk}>
                        {t('login.enter')}
                    </Button>
                    <Button type="text" block disabled={waitMs > 0 || busy} onClick={() => { void resend(); }}>
                        {waitMs > 0 ? t('login.resendIn', { n: Math.ceil(waitMs / 1000) }) : t('login.resend')}
                    </Button>
                </form>
            )}
        </Section>
    );
}
