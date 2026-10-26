// ─── antd theme of the crew screens: the design-system tokens (docs/rebuild/DESIGN_SYSTEM.md) with phone-sized controls ───
import type { ThemeConfig } from 'antd';

export const vendorTheme: ThemeConfig = {
    cssVar: { key: 'vendor-theme' },
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
        // Touch targets ≥ 44 px: the crew taps with work gloves off, on a phone, often outdoors.
        controlHeight: 44,
        controlHeightSM: 36,
        controlHeightLG: 48,
        wireframe: false,
        fontFamily: "var(--font-plex-thai), 'IBM Plex Sans Thai', system-ui, sans-serif",
        // 16 px keeps iOS from zooming into focused inputs.
        fontSize: 16,
        lineHeight: 1.55,
        boxShadowTertiary: '0 1px 2px rgb(16 24 40 / .04)',
    },
    components: {
        Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
        Card: { borderRadiusLG: 10 },
        Tag: { defaultBg: '#F3F4F6' },
        Tabs: { horizontalItemPadding: '12px 4px' },
    },
};
