'use client';

// ─── Header: "เข้าสู่ระบบ" for guests; for signed-in users a menu (workspace, projects, members, sign out) ───
import { useRouter } from 'next/navigation';
import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { CheckOutlined, FolderOpenOutlined, LoginOutlined, LogoutOutlined, TeamOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { initials, useSession } from '../auth/session';
import { signOut } from '../auth/actions';
import { useCurrentWorkspace } from '../query/hooks';
import { ROLE_LABEL } from '../permissions';

export function AccountMenu({ compact = false }: { compact?: boolean }) {
    const router = useRouter();
    const qc = useQueryClient();
    const status = useSession(s => s.status);
    const user = useSession(s => s.user);
    const { workspace, workspaces, select } = useCurrentWorkspace();

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
        { type: 'divider' },
        { key: 'logout', icon: <LogoutOutlined />, label: 'ออกจากระบบ', danger: true },
    ];

    const onClick: MenuProps['onClick'] = ({ key }) => {
        if (key.startsWith('ws:')) {
            select(key.slice(3));
            router.push('/projects');
        } else if (key === 'projects') {
            router.push('/projects');
        } else if (key === 'members') {
            router.push('/workspace/members');
        } else if (key === 'logout') {
            void signOut(qc).then(() => { router.push('/journey'); });
        }
    };

    return (
        <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
            <button type="button" aria-label="บัญชีผู้ใช้"
                title={workspace?.kind === 'company' ? workspace.name : user.displayName}
                className="flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 transition pl-1 pr-2 py-1 min-h-10 md:min-h-0 cursor-pointer border-0">
                <Avatar size={26} style={{ background: '#fa8c16', fontSize: 12, flexShrink: 0 }}>{initials(user.displayName)}</Avatar>
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
