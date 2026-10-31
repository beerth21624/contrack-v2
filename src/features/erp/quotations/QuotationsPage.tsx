'use client';

// ─── /p/[projectId]/quotations: the quotations of a project, newest first ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Skeleton, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { QuotationDto, QuotationVersionSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { CreateFromBoqDialog, CreateQuotationButton, quotationHref, useCanCreateQuotation } from './CreateFromBoqDialog';
import { useQuotations } from './hooks';
import { QUOTATION_STATUS_TONES } from './status';

/** The version a row stands for: the latest one that is not a cancelled draft, else the latest. */
function shownVersion(q: QuotationDto): QuotationVersionSummaryDto | undefined {
    const byNo = [...q.versions].sort((a, b) => b.versionNo - a.versionNo);
    return byNo.find(v => v.status !== 'cancelled') ?? byNo[0];
}

export function QuotationsPage({ projectId }: { projectId: string }) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const list = useQuotations(projectId);
    const hub = useHubProject(projectId);
    const canCreate = useCanCreateQuotation(hub.data?.project.workspaceId);
    const [dialog, setDialog] = useState(false);

    if (list.isLoading) return <Skeleton active />;
    if (list.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const rows = list.data ?? [];

    const columns: ColumnsType<QuotationDto> = [
        {
            key: 'title', title: t('list.columns.title'),
            render: (_, q) => (
                <Link href={quotationHref(projectId, q.id)} className="font-medium break-words">{q.title === '' ? t('untitled') : q.title}</Link>
            ),
        },
        { key: 'number', title: t('list.columns.number'), render: (_, q) => <DocumentNumberTag number={q.number} /> },
        {
            key: 'status', title: t('list.columns.status'),
            render: (_, q) => {
                const v = shownVersion(q);
                return (
                    <span className="inline-flex flex-wrap items-center gap-1">
                        {v !== undefined && <StatusTag enumName="quotationVersionStatus" value={v.status} tones={QUOTATION_STATUS_TONES} />}
                        {v !== undefined && q.versions.length > 1 && <Tag className="!m-0">{t('versionNo', { no: v.versionNo })}</Tag>}
                    </span>
                );
            },
        },
        { key: 'total', title: t('list.columns.total'), align: 'right', render: (_, q) => <MoneyText value={shownVersion(q)?.grandTotal} className="font-semibold" /> },
        { key: 'validUntil', title: t('list.columns.validUntil'), render: (_, q) => <DateText value={shownVersion(q)?.validUntil} /> },
        { key: 'updatedAt', title: t('list.columns.updatedAt'), render: (_, q) => <DateText value={q.updatedAt} style="dateTime" /> },
    ];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={t('list.title')}
                extra={canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog(true)}>{t('list.create')}</Button> : undefined}
            >
                {rows.length === 0 ? (
                    <EmptyState title={t('list.empty.title')} hint={t('list.empty.hint')}
                        action={<CreateQuotationButton projectId={projectId} workspaceId={hub.data?.project.workspaceId} type="primary" />} />
                ) : (
                    <Table<QuotationDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                )}
            </SectionCard>
            <CreateFromBoqDialog projectId={projectId} open={dialog} onClose={() => setDialog(false)} />
        </div>
    );
}
