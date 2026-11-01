'use client';

// ─── Small shared pieces of the cloud pages ───
import Link from 'next/link';
import { Button, Result, Spin } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Locale } from '@/i18n/config';
import { formatDateTime as formatDateTimeIn } from '@/i18n/format';
import { useSession } from '../auth/session';

export const spinner = <div className="flex justify-center p-20"><Spin size="large" /></div>;

/** Renders children only for a signed-in user; a sign-in prompt for guests (guest mode keeps working). */
export function RequireSignIn({ children, next, title }: { children: React.ReactNode; next: string; title: string }) {
    const t = useTranslations('shell.requireSignIn');
    const status = useSession(s => s.status);
    if (status === 'unknown') return spinner;
    if (status === 'guest') {
        return (
            <Result
                icon={<LoginOutlined className="!text-orange-400" />}
                title={title}
                subTitle={t('subtitle')}
                extra={[
                    <Link key="login" href={`/login?next=${encodeURIComponent(next)}`}><Button type="primary">{t('signIn')}</Button></Link>,
                    <Link key="register" href={`/register?next=${encodeURIComponent(next)}`}><Button>{t('register')}</Button></Link>,
                    <Link key="local" href="/journey"><Button type="link">{t('continueLocal')}</Button></Link>,
                ]}
            />
        );
    }
    return <>{children}</>;
}

// Thai months with the Christian-era year, like the rest of the app (calendar, S-Curve, crew board): plain 'th-TH'
// prints the Buddhist year (69 for 2026). English uses the shared formatter (`31 Oct 2026, 14:05`).
const DATE_FORMAT = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** Date and time (Thai: day, short Thai month, 2-digit year, time); "" for an invalid date. English gives `26 Oct 2026, 11:17`. */
export function formatDateTime(iso: string, locale: Locale = 'th'): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return locale === 'th' ? DATE_FORMAT.format(d) : formatDateTimeIn(iso, locale);
}

/** `formatDateTime` bound to the UI language. */
export function useDateTime(): (iso: string) => string {
    const locale = useLocale();
    return useCallback((iso: string) => formatDateTime(iso, locale), [locale]);
}
