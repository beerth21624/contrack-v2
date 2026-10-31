'use client';

// ─── Header: "เข้าสู่ระบบ" for guests; for signed-in users a menu (workspace, projects, members, sign out) ───
import { useRouter } from 'next/navigation';
import { App, Avatar, Button, Dropdown, type MenuProps } from 'antd';
import {
    AppstoreOutlined, AuditOutlined, CheckOutlined, SafetyCertificateOutlined, FolderOpenOutlined, LoginOutlined, LogoutOutlined, ScheduleOutlined, TeamOutlined, ToolOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { isLocale } from '@/i18n/config';
import { useAppLocale } from '@/i18n/LocaleProvider';
import { qk } from '../query/keys';
import { useWorkforceEnabled } from '../api/workforce';
import { initials, useSession } from '../auth/session';
import { signOut } from '../auth/actions';
import { useCurrentWorkspace } from '../query/hooks';
import { ROLE_LABEL, can } from '../permissions';
import { useModuleEnabled, usePlatformModules } from '@/features/modules/modules';
import { usePlatformAdminStatus } from '@/features/erp/admin/hooks';

/** The language switch stays hidden until the old screens are translated (docs/erp/PROGRESS.md D-16). */
const LANGUAGE_SWITCH = process.env.NEXT_PUBLIC_LANGUAGE_SWITCH === '1';

export function AccountMenu({ compact = false }: { compact?: boolean }) {
    const router = useRouter();
    const qc = useQueryClient();
    const status = useSession(s => s.status);
    const user = useSession(s => s.user);
    const { workspace, workspaces, select } = useCurrentWorkspace();
    // Business modules: the switch page only when this server offers any and the user may switch them.
    const offersModules = (usePlatformModules().data?.length ?? 0) > 0 && can(workspace?.role, 'modules.manage');
    const workforceOn = useWorkforceEnabled();
    const { message } = App.useApp();
    const tCommon = useTranslations('common');
    const tAccount = useTranslations('account');
    const tAdmin = useTranslations('admin');
    const tNav = useTranslations('nav');
    // Approvals (project-hub): inbox for everybody, policies for those who manage the company.
    const hubOn = useModuleEnabled('project-hub', workspace?.id).enabled;
    // Platform admins (PLATFORM_ADMIN_EMAILS) get the entitlements page; nobody else sees the entry.
    const platformAdmin = usePlatformAdminStatus().admin;
    const { locale, setLocale } = useAppLocale();

    if (status === 'unknown') return null;

    if (status === 'guest' || !user) {
        return (
            <Button type="primary" ghost size="small" icon={<LoginOutlined />} onClick={() => router.push('/login')}
                aria-label="เข้าสู่ระบบ" className="!h-10 !min-w-10 md:!h-8">
                {compact ? null : <span className="hidden md:inline">เข้าสู่ระบบ</span>}
            </Button>
        );
    }

    const items: MenuProps['items'] = [
        {
            key: 'who', disabled: true,
            label: (
                <div className="py-1 max-w-[min(280px,calc(100vw-128px))]">
                    <div className="font-semibold text-gray-900 truncate" title={user.displayName}>{user.displayName}</div>
                    <div className="text-[12px] text-gray-500 truncate" title={user.email}>{user.email}</div>
                </div>
            ),
        },
        { type: 'divider' },
        {
            type: 'group', key: 'ws', label: 'พื้นที่ทำงาน',
            children: workspaces.map(w => ({
                key: `ws:${w.id}`,
                icon: w.id === workspace?.id ? <CheckOutlined className="text-orange-500" /> : <span className="inline-block w-[14px]" />,
                // A long workspace name is cut short (full name on hover) so the menu fits a phone.
                label: (
                    <span className="flex min-w-0 max-w-[min(260px,calc(100vw-152px))]" title={w.kind === 'personal' ? undefined : w.name}>
                        <span className="truncate">{w.kind === 'personal' ? 'ส่วนตัว' : w.name}</span>
                        <span className="shrink-0 whitespace-pre text-[12px] text-gray-400"> · {ROLE_LABEL[w.role]}</span>
                    </span>
                ),
            })),
        },
        { type: 'divider' },
        { key: 'projects', icon: <FolderOpenOutlined />, label: 'โครงการทั้งหมด' },
        { key: 'members', icon: <TeamOutlined />, label: 'สมาชิก' },
        ...(offersModules ? [{ key: 'modules', icon: <AppstoreOutlined />, label: 'โมดูลเสริม' }] : []),
        ...(hubOn ? [{ key: 'approvals', icon: <AuditOutlined />, label: tNav('approvals') }] : []),
        ...(hubOn && can(workspace?.role, 'company.manage') ? [{ key: 'approval-policies', icon: <AuditOutlined />, label: tNav('approvalPolicies') }] : []),
        ...(platformAdmin ? [{ key: 'admin-entitlements', icon: <SafetyCertificateOutlined />, label: tAdmin('menuLink') }] : []),
        // Business module: the entry exists only while the platform offers it.
        ...(workforceOn ? [
            { key: 'crews', icon: <ToolOutlined />, label: 'ทีมช่างและบุคลากร' },
            { key: 'board', icon: <ScheduleOutlined />, label: 'กระดานจัดคน' },
        ] : []),
        ...(LANGUAGE_SWITCH ? [
            { type: 'divider' as const },
            {
                type: 'group' as const, key: 'lang', label: tAccount('language'),
                children: (['th', 'en'] as const).map(l => ({
                    key: `lang:${l}`,
                    icon: l === locale ? <CheckOutlined className="text-orange-500" /> : <span className="inline-block w-[14px]" />,
                    label: l === 'th' ? tCommon('thai') : tCommon('english'),
                })),
            },
        ] : []),
        { type: 'divider' },
        { key: 'logout', icon: <LogoutOutlined />, label: 'ออกจากระบบ', danger: true },
    ];

    const onClick: MenuProps['onClick'] = ({ key }) => {
        if (key.startsWith('lang:')) {
            const next = key.slice(5);
            if (!isLocale(next) || next === locale) return;
            void setLocale(next).then(saved => {
                // Not saved: nothing changed (the profile language would win again on the next load).
                if (!saved) { void message.warning(tAccount('languageSaveFailed')); return; }
                // The profile now holds the new language: refetch it so the runtime does not put the old one back.
                void qc.invalidateQueries({ queryKey: qk.me });
            });
        } else if (key.startsWith('ws:')) {
            select(key.slice(3));
            router.push('/projects');
        } else if (key === 'projects') {
            router.push('/projects');
        } else if (key === 'members') {
            router.push('/workspace/members');
        } else if (key === 'modules') {
            router.push('/workspace/modules');
        } else if (key === 'approvals') {
            router.push('/approvals');
        } else if (key === 'approval-policies') {
            router.push('/workspace/approval-policies');
        } else if (key === 'admin-entitlements') {
            router.push('/admin/entitlements');
        } else if (key === 'crews') {
            router.push('/workspace/crews');
        } else if (key === 'board') {
            router.push('/workspace/board');
        } else if (key === 'logout') {
            void signOut(qc).then(() => { router.push('/journey'); });
        }
    };

    return (
        <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
            <button type="button" aria-label="บัญชีผู้ใช้"
                title={workspace?.kind === 'company' ? workspace.name : user.displayName}
                className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 transition pl-1 pr-2 h-10 md:h-8 cursor-pointer border-0">
                <Avatar size={24} style={{ background: '#F97316', fontSize: 12, flexShrink: 0 }}>{initials(user.displayName)}</Avatar>
                {/* The name needs room the horizontal menu takes at xl: shown beside the drawer (lg) and on wide screens. */}
                {!compact && (
                    <span className="hidden lg:max-xl:block min-[1440px]:block text-[13px] text-white/90 max-w-[140px] truncate">
                        {workspace?.kind === 'company' ? workspace.name : user.displayName}
                    </span>
                )}
            </button>
        </Dropdown>
    );
}
