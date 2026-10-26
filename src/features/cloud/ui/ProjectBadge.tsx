'use client';

// ─── Which project is open (this browser's, or a cloud project) and whether it is saved ───
import { useRouter } from 'next/navigation';
import { Dropdown, Tooltip, type MenuProps } from 'antd';
import {
    CheckCircleFilled, ClockCircleFilled, CloudOutlined, DisconnectOutlined, FolderOpenOutlined, LaptopOutlined,
    LoadingOutlined, RollbackOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '@/store/project-store';
import { useSession } from '../auth/session';
import { closeCloudProject } from '../projects/controller';
import { syncStatusText, useCloud } from '../state';
import type { SyncState } from '../sync/engine';

const STATUS_ICON: Record<SyncState, React.ReactNode> = {
    saved: <CheckCircleFilled style={{ color: '#52c41a' }} />,
    saving: <LoadingOutlined style={{ color: '#ffa940' }} />,
    pending: <ClockCircleFilled style={{ color: '#faad14' }} />,
    offline: <DisconnectOutlined style={{ color: '#ff7875' }} />,
};

export const LOCAL_PROJECT_TEXT = 'โครงการในเครื่องนี้';

export function ProjectBadge({ compact = false }: { compact?: boolean }) {
    const router = useRouter();
    const binding = useProjectStore(s => s.binding);
    const status = useSession(s => s.status);
    const project = useCloud(s => s.project);
    const sync = useCloud(s => s.syncStatus);
    const opening = useCloud(s => s.opening);

    const pill = 'flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 h-8 text-[12px] text-white/85 max-w-[260px]';

    if (binding.kind === 'guest') {
        const body = (
            <span className={pill}>
                {opening ? <LoadingOutlined /> : <LaptopOutlined />}
                {!compact && <span className="truncate">{opening ? 'กำลังเปิดโครงการ…' : LOCAL_PROJECT_TEXT}</span>}
            </span>
        );
        return (
            <Tooltip title={status === 'signed-in'
                ? 'บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น — อัปโหลดขึ้น cloud ได้ที่ "โครงการทั้งหมด"'
                : 'บันทึกไว้ในเบราว์เซอร์นี้ เข้าสู่ระบบเพื่อเก็บขึ้น cloud และทำงานเป็นทีม'}>
                {body}
            </Tooltip>
        );
    }

    const items: MenuProps['items'] = [
        { key: 'projects', icon: <FolderOpenOutlined />, label: 'โครงการทั้งหมด' },
        { key: 'local', icon: <RollbackOutlined />, label: `กลับไป${LOCAL_PROJECT_TEXT}` },
    ];
    const onClick: MenuProps['onClick'] = ({ key }) => {
        if (key === 'projects') router.push('/projects');
        if (key === 'local') void closeCloudProject().then(() => { router.push('/journey'); });
    };

    return (
        <Dropdown menu={{ items, onClick }} trigger={['click']} placement="bottomRight">
            <button type="button" className={`${pill} cursor-pointer hover:bg-white/10`} aria-label="โครงการที่เปิดอยู่">
                <CloudOutlined />
                {!compact && <span className="truncate font-semibold">{project?.name ?? 'โครงการ cloud'}</span>}
                <span className="flex items-center gap-1 whitespace-nowrap text-white/70">
                    {STATUS_ICON[sync.state]}
                    {!compact && syncStatusText(sync)}
                </span>
            </button>
        </Dropdown>
    );
}
