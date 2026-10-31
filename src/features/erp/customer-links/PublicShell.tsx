'use client';

// ─── The shell of the (public) route group: antd + its own query client; no session, no app menu ───
// Deliberately not CloudProviders / bootstrapSession: the customer is never signed in, so nothing here calls /auth/refresh.
import { useState, type ReactNode } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAntdLocale } from '@/i18n/LocaleProvider';

export function PublicShell({ children }: { children: ReactNode }) {
    const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }));
    const antdLocale = useAntdLocale();
    return (
        <QueryClientProvider client={client}>
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
                    <div className="min-h-dvh bg-gray-100">{children}</div>
                </AntdApp>
            </ConfigProvider>
        </QueryClientProvider>
    );
}
