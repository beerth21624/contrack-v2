'use client';

// ─── The shell of the (print) route group: antd (UI locale) + session start, grey backdrop, no menu ───
// Print pages fetch the document with the signed-in user's token, so the session starts here as in the app shell.
import { useEffect, type ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { bootstrapSession } from '@/features/cloud/auth/session';
import { useAntdLocale } from '@/i18n/LocaleProvider';

function SessionStart() {
    useEffect(() => { void bootstrapSession(); }, []);
    return null;
}

export function PrintShell({ children }: { children: ReactNode }) {
    const antdLocale = useAntdLocale();
    return (
        <ConfigProvider
            locale={antdLocale}
            theme={{
                token: {
                    colorPrimary: '#F97316',
                    borderRadius: 6,
                    fontFamily: "var(--font-plex-thai), 'IBM Plex Sans Thai', system-ui, sans-serif",
                },
            }}
        >
            <AntdApp message={{ maxCount: 1 }}>
                <SessionStart />
                <div className="min-h-dvh bg-gray-200 print:bg-white">{children}</div>
            </AntdApp>
        </ConfigProvider>
    );
}
