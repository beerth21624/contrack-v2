'use client';

// ─── The cost ledger rows behind one cost code (or the "unassigned" rows): commitments, releases, actual cost ───
import { Alert, Drawer, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { CostLedgerEntryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { useJobCostLedger } from './hooks';

/** `costCodeId` null = the rows without a cost code. */
export interface LedgerTarget {
    costCodeId: string | null;
    title: string;
}

export function LedgerDrawer({ projectId, target, onClose }: { projectId: string; target: LedgerTarget | null; onClose: () => void }) {
    const t = useTranslations('jobCost.ledger');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const ledger = useJobCostLedger(projectId, target?.costCodeId ?? undefined, target !== null);
    const entries = (ledger.data?.entries ?? [])
        .filter(e => target === null || e.costCodeId === target.costCodeId)
        .slice()
        .reverse();
    const committedOpen = entries.reduce((s, e) => (e.kind === 'actual' ? s : s + e.amount), 0);
    const actual = entries.reduce((s, e) => (e.kind === 'actual' ? s + e.amount : s), 0);

    const columns: ColumnsType<CostLedgerEntryDto> = [
        { key: 'date', title: t('columns.date'), render: (_, r) => <DateText value={r.entryDate} /> },
        { key: 'kind', title: t('columns.kind'), render: (_, r) => <StatusTag enumName="costEntryKind" value={r.kind} tones={{ commit: 'processing', commit_release: 'warning', actual: 'success' }} /> },
        { key: 'category', title: t('columns.category'), render: (_, r) => te.has(`costCategory.${r.category}`) ? te(`costCategory.${r.category}`) : r.category },
        { key: 'source', title: t('columns.source'), render: (_, r) => { const key = `costSourceType.${r.sourceType}` as 'costSourceType.manual'; return te.has(key) ? te(key) : r.sourceType; } },
        { key: 'amount', title: t('columns.amount'), align: 'right', render: (_, r) => <MoneyText value={r.amount} className={r.amount < 0 ? 'text-red-600' : ''} /> },
        { key: 'note', title: t('columns.note'), dataIndex: 'note' },
    ];

    return (
        <Drawer open={target !== null} onClose={onClose} size="large" title={target === null ? '' : t('title', { name: target.title })} destroyOnHidden>
            {ledger.isError ? <Alert type="error" showIcon title={toText(ledger.error)} />
                : ledger.data === undefined ? <Skeleton active />
                    : (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
                                <span>{t('committedOpen')} <MoneyText value={committedOpen} className="font-semibold" /></span>
                                <span>{t('actual')} <MoneyText value={actual} className="font-semibold" /></span>
                            </div>
                            <Table<CostLedgerEntryDto>
                                rowKey="id" size="small" columns={columns} dataSource={entries} pagination={{ pageSize: 20, hideOnSinglePage: true }}
                                scroll={{ x: 'max-content' }} locale={{ emptyText: t('empty') }}
                            />
                        </div>
                    )}
        </Drawer>
    );
}
