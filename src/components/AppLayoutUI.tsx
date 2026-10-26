'use client';

import React, { useState } from 'react';
import { Layout, Menu, Typography, Drawer, Button, ConfigProvider, theme, App as AntdApp, Spin } from 'antd';
import thTH from 'antd/locale/th_TH';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import { usePathname, useRouter } from 'next/navigation';
import {
    FlagOutlined,
    CalculatorOutlined, MenuOutlined, ScheduleOutlined, FieldTimeOutlined,
    MoneyCollectOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/store/project-store';
import { CloudRuntime } from '@/features/cloud/CloudRuntime';
import { AccountMenu } from '@/features/cloud/ui/AccountMenu';
import { ProjectBadge } from '@/features/cloud/ui/ProjectBadge';
import { ReadOnlyBanner } from '@/features/cloud/ui/ReadOnlyBanner';

// Thai names in the date picker (months, weekdays) and in every antd built-in text (placeholders, Popconfirm buttons,
// Empty, pagination). Module level, so the server render and the client agree. Only the language changes: dates are
// still shown with explicit formats (DD/MM/YYYY, Christian-era year), never the Buddhist year.
dayjs.locale('th');

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function AppLayoutUIContent({ children }: { children: React.ReactNode }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const tNav = useTranslations('nav');
    const tApp = useTranslations('app');
    
    const hasHydrated = useProjectStore(state => state.hasHydrated);

    // Determine active menu key from pathname
    let activeKey = 'journey';
    if (pathname.startsWith('/boq') || pathname.startsWith('/calc')) activeKey = 'boq';
    else if (pathname.includes('/schedule')) activeKey = 'schedule';
    else if (pathname.includes('/man-day')) activeKey = 'man-day';
    else if (pathname.includes('/cashflow')) activeKey = 'cashflow';
    else if (/^\/(projects|workspace|login|register|invite)(\/|$)/.test(pathname)) activeKey = '';

    const menuItems = [
        { key: 'journey', icon: <FlagOutlined />, label: tNav('journey'), onClick: () => router.push('/journey') },
        { key: 'boq', icon: <CalculatorOutlined />, label: tNav('boqHome'), onClick: () => router.push('/boq') },
        { key: 'man-day', icon: <FieldTimeOutlined />, label: tNav('manDay'), onClick: () => router.push('/man-day') },
        { key: 'schedule', icon: <ScheduleOutlined />, label: tNav('schedule'), onClick: () => router.push('/schedule') },
        { key: 'cashflow', icon: <MoneyCollectOutlined />, label: tNav('cashflow'), onClick: () => router.push('/cashflow') },
    ];

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' && target.classList.contains('ant-input-number-input')) {
                if (e.key.length > 1 || e.ctrlKey || e.metaKey || e.altKey) {
                    return; // allow control keys
                }
                if (!/^[\d.-]$/.test(e.key)) {
                    e.preventDefault(); // suppress invalid characters like 'e', letters, symbols
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);


    return (
        <Layout className="min-h-screen">
            {/* Breakpoints are CSS (no window-width state), so the first paint already has the right header.
                The horizontal menu needs ~1240px next to the badge and account menu: below xl it lives in the drawer. */}
            <Header className="gap-2" style={{
                display: 'flex', alignItems: 'center',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2e 100%)',
                borderBottom: '2px solid #F97316',
                padding: '0 28px', height: 64,
                // Items are centred by flex; antd's 64px line-height would make text boxes (and pills) taller than the bar.
                lineHeight: 1.5,
                boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            }}>
                <div className="shrink-0 mr-auto xl:mr-4" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #F97316, #FB923C)',
                        padding: 7, borderRadius: 8, display: 'flex',
                        boxShadow: '0 2px 6px rgba(250,140,22,.3)',
                    }}>
                        <CalculatorOutlined style={{ fontSize: 18, color: '#fff' }} />
                    </div>
                    <Title level={5} style={{ margin: 0, lineHeight: '1.2', color: '#fff', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{tApp('title')}</Title>
                </div>

                <div className="hidden xl:flex flex-1 min-w-0">
                    <Menu
                        mode="horizontal" theme="dark"
                        selectedKeys={[activeKey]}
                        items={menuItems}
                        // The full bar height (64 − the 2 px bottom border): antd's header rule makes the menu inherit
                        // the header's line-height, so it is set here.
                        style={{ flex: 1, minWidth: 0, borderBottom: 'none', background: 'transparent', lineHeight: '62px' }}
                    />
                </div>

                <div className="min-w-0" style={{ display: 'flex', alignItems: 'center' }}>
                    <ProjectBadge />
                </div>

                <div className="shrink-0" style={{ display: 'flex', alignItems: 'center' }}>
                    <AccountMenu />
                </div>

                <div className="xl:hidden shrink-0">
                    <Button
                        type="text"
                        icon={<MenuOutlined style={{ fontSize: 22, color: '#fff' }} />}
                        onClick={() => setDrawerOpen(true)}
                        aria-label="เมนู"
                        style={{
                            background: 'transparent', border: 'none',
                            minWidth: 44, minHeight: 44,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    />
                </div>
            </Header>

            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#F97316', padding: 4, borderRadius: 4, display: 'flex' }}>
                            <CalculatorOutlined style={{ fontSize: 16, color: '#000' }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>Contrack</span>
                    </div>
                }
                placement="left"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                styles={{ body: { padding: 0 }, wrapper: { width: 280 } }}
                rootStyle={{ zIndex: 1060 }}
            >
                <Menu
                    mode="inline"
                    selectedKeys={[activeKey]}
                    onClick={() => setDrawerOpen(false)}
                    items={menuItems}
                    style={{ borderRight: 'none' }}
                />
            </Drawer>

            {/* One frame for every page: 1200 content width, 24 px gutters (16 on phones). */}
            <Content className="px-4 py-4 sm:px-6 sm:py-6"
                style={{ maxWidth: 1248, margin: '0 auto', width: '100%', background: '#F6F7F9', minHeight: 'calc(100vh - 64px - 52px)' }}>
                {!hasHydrated ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '60vh' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <>
                        <ReadOnlyBanner />
                        {children}
                    </>
                )}
            </Content>

            <Footer style={{
                textAlign: 'center', color: '#b0b0b0', fontSize: 12, padding: '14px 24px',
                background: '#fafafa', borderTop: '1px solid #ebebeb',
                letterSpacing: 0.3,
            }}>
                {tApp('footer')}
            </Footer>
            
        </Layout>
    );
}

export function AppLayoutUI({ children }: { children: React.ReactNode }) {
    return (
        <ConfigProvider
            locale={thTH}
            theme={{
                algorithm: theme.defaultAlgorithm,
                cssVar: { key: 'app-theme' },
                // docs/rebuild/DESIGN_SYSTEM.md — the same values as the tokens in globals.css.
                token: {
                    colorPrimary: '#F97316',
                    colorInfo: '#2563EB',
                    colorSuccess: '#16A34A',
                    colorWarning: '#D97706',
                    colorError: '#DC2626',
                    colorText: '#111827',
                    colorTextSecondary: '#4B5563',
                    colorTextTertiary: '#9CA3AF',
                    colorBorder: '#E5E7EB',
                    colorBorderSecondary: '#F3F4F6',
                    colorBgLayout: '#F6F7F9',
                    borderRadius: 6,
                    borderRadiusLG: 10,
                    borderRadiusSM: 4,
                    controlHeight: 36,
                    controlHeightSM: 32,
                    controlHeightLG: 40,
                    wireframe: false,
                    fontFamily: "var(--font-plex-thai), 'IBM Plex Sans Thai', system-ui, sans-serif",
                    fontSize: 14,
                    lineHeight: 1.55,
                    boxShadowTertiary: '0 1px 2px rgb(16 24 40 / .04)',
                },
                components: {
                    Layout: { headerBg: '#1e1e1e', headerColor: '#ffffff', bodyBg: '#F6F7F9' },
                    Menu: {
                        darkItemBg: 'transparent',
                        darkItemColor: 'rgba(255,255,255,.6)',
                        itemSelectedColor: '#F97316',
                        darkItemSelectedColor: '#F97316',
                        darkItemSelectedBg: 'transparent',
                        darkItemHoverColor: '#ffffff',
                    },
                    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
                    Table: { headerBg: '#F9FAFB', headerColor: '#111827', borderColor: '#F3F4F6', cellPaddingBlock: 10 },
                    Card: { borderRadiusLG: 10 },
                    Collapse: { borderRadiusLG: 10 },
                    Tag: { defaultBg: '#F3F4F6' },
                },
            }}
        >
            <AntdApp message={{ maxCount: 1 }}>
                <CloudRuntime />
                <AppLayoutUIContent>{children}</AppLayoutUIContent>
            </AntdApp>
        </ConfigProvider>
    );
}
