'use client';

// ─── "Customer link" button of a document: create a public link (shown once), copy / share it, see and cancel links ───
// Usage: <ShareLinkButton workspaceId={ws} subjectType="quotation" subjectId={version.id} /> — show it only to users with
// the subject's permission (the backend checks it again).
import { useState } from 'react';
import { App, Button, Input, InputNumber, List, Modal, Space, Tag, Typography } from 'antd';
import { CopyOutlined, LinkOutlined, ShareAltOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CUSTOMER_LINK_DEFAULT_DAYS, type CustomerLinkDto, type CustomerLinkSubject } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { customerLinkKeys, customerLinksApi } from '../customer-links/api';
import { ConfirmAction } from './ConfirmAction';
import { statusTone } from './StatusTag';

const STATUS_COLOR = { default: 'default', processing: 'processing', success: 'success', warning: 'warning', error: 'error' } as const;

export function ShareLinkButton({ workspaceId, subjectType, subjectId, disabled, size }: {
    workspaceId: string;
    subjectType: CustomerLinkSubject;
    subjectId: string;
    disabled?: boolean;
    size?: 'small' | 'middle' | 'large';
}) {
    const t = useTranslations('customerLinks.share');
    const f = useFormat();
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [days, setDays] = useState<number>(CUSTOMER_LINK_DEFAULT_DAYS);
    const [createdUrl, setCreatedUrl] = useState<string | null>(null);

    const key = customerLinkKeys.subject(workspaceId, subjectType, subjectId);
    const links = useQuery({ queryKey: key, queryFn: () => customerLinksApi.list(workspaceId, subjectType, subjectId), enabled: open });
    const create = useMutation({
        mutationFn: () => customerLinksApi.create(workspaceId, { subjectType, subjectId, expiresInDays: days }),
        onSuccess: res => { setCreatedUrl(res.url); void qc.invalidateQueries({ queryKey: key }); },
        onError: e => { void message.error(toText(e)); },
    });

    const copy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            void message.success(t('copied'));
        } catch {
            // Clipboard refused (insecure context): the field stays selectable.
        }
    };
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    const revoke = async (link: CustomerLinkDto) => {
        await customerLinksApi.revoke(link.id);
        void message.success(t('revoked'));
        await qc.invalidateQueries({ queryKey: key });
    };

    const close = () => { setOpen(false); setCreatedUrl(null); };

    return (
        <>
            <Button icon={<LinkOutlined />} disabled={disabled} size={size} onClick={() => setOpen(true)}>{t('button')}</Button>
            <Modal open={open} title={t('title')} onCancel={close} footer={null} destroyOnHidden>
                <Typography.Paragraph type="secondary">{t('hint')}</Typography.Paragraph>
                <Space wrap className="mb-3">
                    <span>{t('expiresInDays')}</span>
                    <InputNumber min={1} max={365} precision={0} value={days} onChange={v => setDays(typeof v === 'number' ? v : CUSTOMER_LINK_DEFAULT_DAYS)} />
                    <Button type="primary" loading={create.isPending} onClick={() => create.mutate()}>{t('create')}</Button>
                </Space>
                {createdUrl !== null && (
                    <div className="mb-4 flex flex-col gap-2">
                        <Typography.Text type="warning">{t('created')}</Typography.Text>
                        <Space.Compact className="w-full">
                            <Input readOnly value={createdUrl} onFocus={e => e.target.select()} />
                            <Button icon={<CopyOutlined />} onClick={() => void copy(createdUrl)}>{t('copy')}</Button>
                            {canShare && (
                                <Button icon={<ShareAltOutlined />} onClick={() => { navigator.share({ url: createdUrl }).catch(() => undefined); }}>
                                    {t('share')}
                                </Button>
                            )}
                        </Space.Compact>
                    </div>
                )}
                <Typography.Title level={5}>{t('existing')}</Typography.Title>
                <List
                    loading={links.isPending}
                    dataSource={links.data ?? []}
                    locale={{ emptyText: t('none') }}
                    renderItem={link => (
                        <List.Item
                            actions={link.status === 'active' ? [
                                <ConfirmAction key="revoke" danger size="small" type="link" title={t('revokeConfirm')} onConfirm={() => revoke(link)}>
                                    {t('revoke')}
                                </ConfirmAction>,
                            ] : []}
                        >
                            <List.Item.Meta
                                title={<Tag color={STATUS_COLOR[statusTone(link.status, { responded: 'success', revoked: 'default' })]}>{t(`status.${link.status}`)}</Tag>}
                                description={[
                                    t('createdAt', { date: f.dateTime(link.createdAt) }),
                                    t('expires', { date: f.date(link.expiresAt) }),
                                    t('views', { count: link.viewCount }),
                                ].join(' · ')}
                            />
                        </List.Item>
                    )}
                />
            </Modal>
        </>
    );
}
