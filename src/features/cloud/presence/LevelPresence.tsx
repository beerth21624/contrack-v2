'use client';

// ─── Team on the level map and level pages: who is where (presence), who is assigned, soft lock ───
import { Alert, App, Avatar, Button, Dropdown, Tooltip, type MenuProps } from 'antd';
import { UserOutlined, UserSwitchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { LevelAssignmentDto, MemberDto, PresenceEntry } from '@/shared/contract';
import { useProjectStore } from '@/store/project-store';
import { useErrorMessage } from '../api/error-message';
import { initials, useSession } from '../auth/session';
import { can } from '../permissions';
import { useAssignLevel, useAssignments, useMembers } from '../query/hooks';
import { useCloud } from '../state';

export interface CloudLevelInfo {
    enabled: boolean;
    projectId: string;
    canAssign: boolean;
    members: MemberDto[];
    /** Other members on a level (not this user). */
    othersOn: (levelId: string) => PresenceEntry[];
    assigneeOf: (levelId: string) => { assignment: LevelAssignmentDto; member: MemberDto | undefined } | undefined;
}

const NONE: CloudLevelInfo = { enabled: false, projectId: '', canAssign: false, members: [], othersOn: () => [], assigneeOf: () => undefined };

/** Presence + assignments of the open cloud project (disabled in guest mode). Call once per page. */
export function useCloudLevelInfo(): CloudLevelInfo {
    const binding = useProjectStore(s => s.binding);
    const cloud = binding.kind === 'cloud' ? binding : null;
    const myId = useSession(s => s.user?.id ?? null);
    const presence = useCloud(s => s.presence);
    const assignments = useAssignments(cloud?.projectId);
    const members = useMembers(cloud?.workspaceId);
    if (!cloud) return NONE;
    const memberList = members.data ?? [];
    return {
        enabled: true,
        projectId: cloud.projectId,
        canAssign: can(cloud.role, 'levels.assign'),
        members: memberList,
        othersOn: (levelId) => presence.filter(p => p.levelId === levelId && p.userId !== myId),
        assigneeOf: (levelId) => {
            const assignment = assignments.data?.find(a => a.levelId === levelId);
            return assignment ? { assignment, member: memberList.find(m => m.userId === assignment.userId) } : undefined;
        },
    };
}

type PresenceT = ReturnType<typeof useTranslations<'cloud.presence'>>;

/** "Somchai" (or "Somchai and Somying"); Thai puts a polite prefix before each name. */
export function namesOf(people: { displayName: string }[], t: PresenceT): string {
    return people.map(p => t('person', { name: p.displayName })).join(t('joiner'));
}

/** Avatars of the other members on a level (on its map node). */
export function LevelPresenceAvatars({ info, levelId }: { info: CloudLevelInfo; levelId: string }) {
    const t = useTranslations('cloud.presence');
    if (!info.enabled) return null;
    const others = info.othersOn(levelId);
    if (others.length === 0) return null;
    return (
        <Tooltip title={t('editingTip', { names: namesOf(others, t) })}>
            <span className="ml-auto shrink-0">
                <Avatar.Group size="small" max={{ count: 2 }}>
                    {others.map(p => (
                        <Avatar key={p.userId} size="small" style={{ background: '#1677ff', fontSize: 11 }}>{initials(p.displayName)}</Avatar>
                    ))}
                </Avatar.Group>
            </span>
        </Tooltip>
    );
}

/** Who the level is assigned to, and (owner/admin) a control to assign it. Below the level's map node. */
export function LevelAssignee({ info, levelId }: { info: CloudLevelInfo; levelId: string }) {
    const { message } = App.useApp();
    const t = useTranslations('cloud.presence');
    const toText = useErrorMessage();
    const assign = useAssignLevel(info.projectId);
    if (!info.enabled) return null;
    const current = info.assigneeOf(levelId);
    const name = current ? current.member?.displayName ?? t('leftMember') : null;

    const label = (
        <span className="flex items-center gap-1 min-w-0 text-[12px] text-gray-500">
            <UserOutlined />
            <span className="truncate">{name ?? t('unassigned')}</span>
        </span>
    );
    if (!info.canAssign) return name === null ? null : <div className="px-1">{label}</div>;

    const items: MenuProps['items'] = [
        ...info.members.map(m => ({ key: m.userId, label: m.displayName })),
        { type: 'divider' as const },
        { key: '__none', label: t('unassign'), disabled: current === undefined },
    ];
    const onClick: MenuProps['onClick'] = ({ key }) => {
        assign.mutate({ levelId, userId: key === '__none' ? null : key }, {
            onError: (e) => { void message.error(toText(e)); },
        });
    };
    return (
        <Dropdown menu={{ items, onClick, selectable: true, selectedKeys: current ? [current.assignment.userId] : [] }} trigger={['click']}>
            <Button type="text" size="small" className="!px-1 !h-6 !justify-start max-w-full" loading={assign.isPending}
                icon={<UserSwitchOutlined className="text-gray-400" />} aria-label={t('assignAria')}>
                {label}
            </Button>
        </Dropdown>
    );
}

/** Soft lock: a warning when another member is on the same level (nothing is blocked). */
export function LevelSoftLock({ levelId }: { levelId: string }) {
    const info = useCloudLevelInfo();
    const t = useTranslations('cloud.presence');
    const myId = useSession(s => s.user?.id ?? null);
    if (!info.enabled) return null;
    const others = info.othersOn(levelId);
    const assignee = info.assigneeOf(levelId);
    const assignedToOther = assignee !== undefined && assignee.assignment.userId !== myId;
    if (others.length === 0 && !assignedToOther) return null;
    if (others.length === 0 && assignee !== undefined) {
        return (
            <Alert type="info" showIcon title={t('assignedTitle', { name: assignee.member?.displayName ?? t('otherMember') })}
                description={t('assignedDesc')} />
        );
    }
    return (
        <Alert type="warning" showIcon title={t('editingTitle', { names: namesOf(others, t) })}
            description={t('editingDesc')} />
    );
}
