'use client';

import React, { useState } from 'react';
import { Layout, Menu, Typography, Drawer, Button, ConfigProvider, theme, App as AntdApp, Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import {
    DashboardOutlined, SettingOutlined, TableOutlined,
    CalculatorOutlined, MenuOutlined, ScheduleOutlined, ToolOutlined, FieldTimeOutlined,
    MoneyCollectOutlined, UndoOutlined, ExclamationCircleFilled, ControlOutlined
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAppStore } from '@/lib/store';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

function AppLayoutUIContent({ children }: { children: React.ReactNode }) {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const tNav = useTranslations('nav');
    const tApp = useTranslations('app');
    
    const resetAll = useAppStore(state => state.resetAll);
    const hasHydrated = useAppStore(state => state._hasHydrated);
    const { modal, message } = AntdApp.useApp();

    // Determine active menu key from pathname
    let activeKey = 'timeline';
    if (pathname.startsWith('/boq') || pathname.startsWith('/calc')) activeKey = 'boq';
    else if (pathname.includes('/summary')) activeKey = 'summary';
    else if (pathname.includes('/schedule')) activeKey = 'schedule';
    else if (pathname.includes('/man-day')) activeKey = 'man-day';
    else if (pathname.includes('/cashflow')) activeKey = 'cashflow';
    else if (pathname.includes('/price-list')) activeKey = 'price-list';
    else if (pathname.includes('/productivity')) activeKey = 'productivity';

    const menuItems = [
        { key: 'boq', icon: <CalculatorOutlined />, label: tNav('boqHome'), onClick: () => router.push('/boq') },
        { key: 'summary', icon: <TableOutlined />, label: tNav('boqSummary'), onClick: () => router.push('/summary') },
        { key: 'timeline', icon: <DashboardOutlined />, label: tNav('taskList'), onClick: () => router.push('/timeline') },
        { key: 'schedule', icon: <ScheduleOutlined />, label: tNav('schedule'), onClick: () => router.push('/schedule') },
        { key: 'man-day', icon: <FieldTimeOutlined />, label: tNav('manDay'), onClick: () => router.push('/man-day') },
        { key: 'cashflow', icon: <MoneyCollectOutlined />, label: tNav('cashflow'), onClick: () => router.push('/cashflow') },
        { key: 'price-list', icon: <SettingOutlined />, label: tNav('priceList'), onClick: () => router.push('/price-list') },
        { key: 'productivity', icon: <ToolOutlined />, label: tNav('productivity'), onClick: () => router.push('/productivity') },
    ];

    const handleReset = () => {
        modal.confirm({
            title: 'ยืนยันการรีเซ็ตข้อมูล',
            icon: <ExclamationCircleFilled />,
            content: 'ต้องการรีเซ็ตข้อมูลทั้งหมดหรือไม่?\nข้อมูลที่กรอกไว้ทุก Step, ราคา, และ Productivity จะถูกล้างหมด',
            okText: 'รีเซ็ตข้อมูล',
            okType: 'danger',
            cancelText: 'ยกเลิก',
            onOk() {
                resetAll();
                message.success('รีเซ็ตข้อมูลระบบเรียบร้อยแล้ว');
                router.push('/timeline');
            },
        });
    };

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

                <LanguageSwitcher />

                <Button
                    type="text"
                    icon={<ControlOutlined style={{ color: 'rgba(255,255,255,.6)', fontSize: 18 }} />}
                    onClick={() => setSettingsOpen(true)}
                    aria-label="ตั้งค่าโครงการ"
                    style={{
                        background: 'transparent', border: 'none',
                        minWidth: 36, minHeight: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: 4,
                    }}
                />

                <Button
                    type="text"
                    icon={<UndoOutlined style={{ color: 'rgba(255,255,255,.6)' }} />}
                    onClick={handleReset}
                    aria-label="รีเซ็ตข้อมูล"
                    style={{
                        background: 'transparent', border: 'none',
                        minWidth: 36, minHeight: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginLeft: 4,
                    }}
                />

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
                    children
                )}
            </Content>

            <Footer style={{
                textAlign: 'center', color: '#b0b0b0', fontSize: 12, padding: '14px 24px',
                background: '#fafafa', borderTop: '1px solid #ebebeb',
                letterSpacing: 0.3,
            }}>
                {tApp('footer')}
            </Footer>
            
            <ProjectSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
                <AppLayoutUIContent>{children}</AppLayoutUIContent>
            </AntdApp>
        </ConfigProvider>
    );
}
