'use client';

// ─── In-app notifications (bell in the header): unread count, latest messages, open = mark read ───
// Hidden for guests and wherever no business module is in use (plain BOQ has nothing to notify).
import { useRouter } from 'next/navigation';
import { Badge, Button, Dropdown, Empty } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type MarkNotificationsReadRequest, type NotificationDto, notificationListDtoSchema } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { useSession } from '@/features/cloud/auth/session';
import { formatDateTime } from '@/features/cloud/ui/common';
import { useModuleEnabled } from '@/features/modules/modules';
import { useHasVendorWorkspace } from '@/features/subcontracting/shared/useHasVendorWorkspace';

const KEY = ['notifications'] as const;

export function NotificationBell({ dark = true }: { dark?: boolean }) {
    const router = useRouter();
    const qc = useQueryClient();
    const signedIn = useSession(s => s.status === 'signed-in');
    // Only where a business module is in use: the workspace switched it on, or the user runs a crew.
    const moduleOn = useModuleEnabled('subcontracting').enabled;
    const isVendor = useHasVendorWorkspace();
    const active = signedIn && (moduleOn || isVendor);
    const q = useQuery({
        queryKey: KEY,
        queryFn: () => apiClient.request('GET', '/notifications', { query: { limit: 20 }, schema: notificationListDtoSchema }),
        enabled: active,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
    });
    const markRead = useMutation({
        mutationFn: (body: MarkNotificationsReadRequest) => apiClient.request('POST', '/notifications/read', { body }),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); },
    });
    if (!active) return null;

    const items = q.data?.items ?? [];
    const open = (n: NotificationDto) => {
        if (n.readAt === null) markRead.mutate({ ids: [n.id] });
        if (n.href !== '') router.push(n.href);
    };

    return (
        <Dropdown
            trigger={['click']}
            placement="bottomRight"
            popupRender={() => (
                <div className="w-[340px] max-w-[calc(100vw-32px)] rounded-[10px] border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                        <span className="font-semibold">การแจ้งเตือน</span>
                        {(q.data?.unread ?? 0) > 0 && (
                            <Button type="link" size="small" onClick={() => markRead.mutate({ all: true })}>อ่านทั้งหมด</Button>
                        )}
                    </div>
                    {items.length === 0
                        ? <Empty className="py-6" image={Empty.PRESENTED_IMAGE_SIMPLE} description="ยังไม่มีการแจ้งเตือน" />
                        : (
                            <ul className="max-h-[420px] overflow-y-auto">
                                {items.map(n => (
                                    <li key={n.id}>
                                        <button type="button" onClick={() => open(n)}
                                            className={`block w-full border-b border-gray-100 px-4 py-3 text-left hover:bg-gray-50 ${n.readAt === null ? 'bg-orange-50/50' : ''}`}>
                                            <div className={n.readAt === null ? 'font-medium' : ''}>{n.title}</div>
                                            {n.body !== '' && <div className="text-[13px] text-gray-600">{n.body}</div>}
                                            <div className="mt-1 text-[12px] text-gray-400">{formatDateTime(n.createdAt)}</div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>
            )}
        >
            <Button type="text" aria-label="การแจ้งเตือน" style={{ minWidth: 40, minHeight: 40 }}
                icon={(
                    <Badge count={q.data?.unread ?? 0} size="small" offset={[2, -2]}>
                        <BellOutlined style={{ fontSize: 18, color: dark ? '#fff' : '#111827' }} />
                    </Badge>
                )}
            />
        </Dropdown>
    );
}
