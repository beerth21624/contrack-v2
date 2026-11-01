'use client';

// ─── Light layout of the crew screens: brand, team switcher, notifications, sign-out. No contractor menu. ───
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { App as AntdApp, Badge, Button, ConfigProvider, Select } from 'antd';
import { BellOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/features/cloud/api/routes';
import { bootstrapSession, useSession } from '@/features/cloud/auth/session';
import { usePlatformModuleEnabled } from '@/features/modules/modules';
import { useAntdLocale, useAppLocale } from '@/i18n/LocaleProvider';
import { vendorApi, vk } from '../api';
import { formatDateTime } from '../format';
import { useNotifications, useVendorWorkspace } from '../hooks';
import { vendorTheme } from '../theme';
import { PageSpinner, Sheet } from './common';

function NotificationsButton() {
    const t = useTranslations('vendor');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const q = useNotifications();
    const markRead = useMutation({
        mutationFn: vendorApi.notifications.markRead,
        onSettled: () => qc.invalidateQueries({ queryKey: vk.notifications }),
    });
    const unread = q.data?.unread ?? 0;
    const items = q.data?.items ?? [];

    const openItem = (id: string, href: string, read: boolean) => {
        if (!read) markRead.mutate({ ids: [id] });
        setOpen(false);
        if (href.startsWith('/') && !href.startsWith('//')) router.push(href);
    };

    return (
        <>
            <Badge count={unread} size="small" offset={[-6, 6]}>
                <Button type="text" aria-label={t('shell.notifications')} onClick={() => setOpen(true)}
                    icon={<BellOutlined className="text-white text-lg" />} className="!w-11 !h-11" />
            </Badge>
            <Sheet open={open} onClose={() => setOpen(false)} title={t('shell.notifications')}
                footer={unread > 0 ? <Button block type="text" onClick={() => markRead.mutate({ all: true })}>{t('shell.markAllRead')}</Button> : undefined}>
                {items.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">{t('shell.noNotifications')}</div>
                ) : (
                    <ul className="m-0 p-0 list-none flex flex-col">
                        {items.map(n => (
                            <li key={n.id}>
                                <button type="button" onClick={() => openItem(n.id, n.href, n.readAt !== null)}
                                    className="w-full text-left bg-transparent border-0 border-b border-gray-100 py-3 px-1 cursor-pointer">
                                    <div className={`text-body ${n.readAt === null ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{n.title}</div>
                                    {n.body !== '' && <div className="text-secondary text-gray-600">{n.body}</div>}
                                    <div className="text-caption text-gray-400 mt-0.5">{formatDateTime(n.createdAt, locale)}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Sheet>
        </>
    );
}

function TeamSwitcher() {
    const t = useTranslations('vendor');
    const ws = useVendorWorkspace();
    if (ws.all.length < 2 || ws.current === undefined) return null;
    return (
        <div className="bg-white border-b border-gray-200">
            <div className="mx-auto max-w-[640px] px-4 py-2 flex items-center gap-2">
                <TeamOutlined className="text-gray-500" />
                <span className="text-secondary text-gray-600 shrink-0">{t('shell.workingAs')}</span>
                <Select
                    className="flex-1 min-w-0"
                    value={ws.current.workspaceId}
                    onChange={(v: string) => ws.select(v)}
                    options={ws.all.map(v => ({ value: v.workspaceId, label: v.teamName }))}
                    aria-label={t('shell.chooseTeam')}
                />
            </div>
        </div>
    );
}

function Header({ showActions }: { showActions: boolean }) {
    const t = useTranslations('vendor');
    const { locale, setLocale } = useAppLocale();
    const router = useRouter();
    const qc = useQueryClient();
    const status = useSession(s => s.status);
    const signOut = useMutation({
        mutationFn: () => api.auth.logout(),
        onSettled: () => {
            qc.removeQueries({ queryKey: vk.all });
            qc.removeQueries({ queryKey: vk.notifications });
            router.push('/vendor/login');
        },
    });
    return (
        <header className="sticky top-0 z-30" style={{ background: '#1e1e1e', borderBottom: '2px solid #F97316' }}>
            <div className="mx-auto max-w-[640px] h-14 px-2 flex items-center gap-1">
                <Link href="/vendor" className="flex items-center min-h-11 px-2 mr-auto text-white no-underline">
                    <span className="font-semibold tracking-wide">ConTrack</span>
                    <span className="ml-1.5 text-orange-400 font-medium">{t('shell.brandSuffix')}</span>
                </Link>
                <Button type="text" aria-label={t('shell.switchLanguage')} className="!text-white !h-11"
                    onClick={() => { void setLocale(locale === 'th' ? 'en' : 'th'); }}>{t('shell.otherLanguage')}</Button>
                {status === 'signed-in' && (
                    <>
                        {showActions && <NotificationsButton />}
                        {showActions && (
                            <Button type="text" aria-label={t('shell.teamProfile')} onClick={() => router.push('/vendor/profile')}
                                icon={<TeamOutlined className="text-white text-lg" />} className="!w-11 !h-11" />
                        )}
                        <Button type="text" aria-label={t('shell.signOut')} loading={signOut.isPending} onClick={() => signOut.mutate()}
                            icon={<LogoutOutlined className="text-white text-lg" />} className="!w-11 !h-11" />
                    </>
                )}
            </div>
        </header>
    );
}

/** Starts the session from the refresh cookie (no contractor runtime: no project resume, no realtime). */
function SessionStart() {
    useEffect(() => { void bootstrapSession(); }, []);
    return null;
}

/** The platform switched subcontracting off: one calm page, nothing else is asked of the server. */
function ServiceOff() {
    const t = useTranslations('vendor');
    return (
        <div className="text-center py-24 px-4">
            <div className="text-card-title font-semibold text-gray-900">{t('shell.serviceOff')}</div>
            <div className="mt-2 text-secondary text-gray-600">{t('shell.serviceOffHint')}</div>
        </div>
    );
}

export function VendorShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const platform = usePlatformModuleEnabled('subcontracting');
    const off = !platform.loading && !platform.enabled;
    // The guest link page shows no team switcher (it is about one invitation).
    const showSwitcher = !off && pathname.startsWith('/vendor') && !pathname.startsWith('/vendor/login');
    const antdLocale = useAntdLocale();
    return (
        <ConfigProvider theme={vendorTheme} locale={antdLocale}>
            <AntdApp message={{ maxCount: 1 }}>
                <SessionStart />
                <div className="min-h-dvh bg-page">
                    <Header showActions={!off} />
                    {showSwitcher && <TeamSwitcher />}
                    <main className="mx-auto max-w-[640px] px-4 pt-4 pb-32">
                        {platform.loading ? <PageSpinner /> : off ? <ServiceOff /> : children}
                    </main>
                </div>
            </AntdApp>
        </ConfigProvider>
    );
}
