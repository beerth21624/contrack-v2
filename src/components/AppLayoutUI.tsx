'use client';

import React, { useState } from 'react';
import { Layout, Menu, Typography, Drawer, Button, ConfigProvider, theme, App as AntdApp, Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import {
    FlagOutlined,
    CalculatorOutlined, MenuOutlined, ScheduleOutlined, FieldTimeOutlined,
    MoneyCollectOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useProjectStore } from '@/store/project-store';
import { CloudRuntime } from '@/features/cloud/CloudRuntime';
import { AccountMenu } from '@/features/cloud/ui/AccountMenu';
import { ProjectBadge } from '@/features/cloud/ui/ProjectBadge';
import { ReadOnlyBanner } from '@/features/cloud/ui/ReadOnlyBanner';

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

    const [isMobile, setIsMobile] = React.useState(false);

    React.useEffect(() => {
        const updateSize = () => setIsMobile(window.innerWidth < 768);
        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

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
            <Header style={{
                display: 'flex', alignItems: 'center',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2e 100%)',
                borderBottom: '2px solid #fa8c16',
                padding: isMobile ? '0 12px' : '0 28px', height: 64,
                boxShadow: '0 2px 8px rgba(0,0,0,.15)',
            }}>
                <div style={{ marginRight: isMobile ? 'auto' : 32, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #fa8c16, #ffa940)',
                        padding: 7, borderRadius: 8, display: 'flex',
                        boxShadow: '0 2px 6px rgba(250,140,22,.3)',
                    }}>
                        <CalculatorOutlined style={{ fontSize: 18, color: '#fff' }} />
                    </div>
                    <Title level={5} style={{ margin: 0, lineHeight: '1.2', color: '#fff', letterSpacing: 0.5 }}>{tApp('title')}</Title>
                </div>

                <div className="hidden md:flex flex-1">
                    <Menu
                        mode="horizontal" theme="dark"
                        selectedKeys={[activeKey]}
                        items={menuItems}
                        style={{ flex: 1, borderBottom: 'none', background: 'transparent' }}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginRight: 8 }}>
                    <ProjectBadge compact={isMobile} />
                </div>

                <LanguageSwitcher />

                <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
                    <AccountMenu compact={isMobile} />
                </div>

                <div className="md:hidden">
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
                        <div style={{ background: '#fa8c16', padding: 4, borderRadius: 4, display: 'flex' }}>
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

            <Content style={{ padding: '24px 12px', maxWidth: 1400, margin: '0 auto', width: '100%', background: '#f5f5f7', minHeight: 'calc(100vh - 64px - 52px)' }}>
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
            theme={{
                algorithm: theme.defaultAlgorithm,
                cssVar: { key: 'app-theme' },
                token: {
                    colorPrimary: '#fa8c16',
                    colorInfo: '#1890ff',
                    colorSuccess: '#52c41a',
                    colorWarning: '#faad14',
                    colorError: '#f5222d',
                    borderRadius: 8,
                    wireframe: false,
                    fontFamily: "var(--font-sarabun), 'Sarabun', sans-serif",
                    fontSize: 15,
                },
                components: {
                    Layout: { headerBg: '#1e1e1e', headerColor: '#ffffff', bodyBg: '#f5f5f7' },
                    Menu: {
                        darkItemBg: 'transparent',
                        darkItemColor: 'rgba(255,255,255,.6)',
                        itemSelectedColor: '#fa8c16',
                        darkItemSelectedColor: '#fa8c16',
                        darkItemSelectedBg: 'transparent',
                        darkItemHoverColor: '#ffffff',
                    },
                    Button: { fontWeight: 600, controlHeight: 40 },
                    Table: { headerBg: '#fafafa', headerColor: '#1f1f1f', borderColor: '#f0f0f0', cellPaddingBlock: 12 },
                    Input: { controlHeight: 40 },
                    InputNumber: { controlHeight: 40 },
                    Select: { controlHeight: 40 },
                    Card: { borderRadiusLG: 10 },
                    Collapse: { borderRadiusLG: 10 },
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
