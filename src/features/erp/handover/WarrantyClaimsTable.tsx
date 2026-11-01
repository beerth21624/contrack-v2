'use client';

// ─── Warranty claims of a project: number, reported date, description, severity, status, assignee, due, cost ───
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { WarrantyClaimDto } from '@/shared/contract';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { CLAIM_STATUS_TONES, SEVERITY_TONES } from './status';

export function WarrantyClaimsTable({ claims, onOpen }: { claims: readonly WarrantyClaimDto[]; onOpen: (claim: WarrantyClaimDto) => void }) {
    const t = useTranslations('handover');
    const columns: ColumnsType<WarrantyClaimDto> = [
        {
            key: 'number', title: t('claims.columns.number'),
            render: (_, c) => <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-blue-600" onClick={() => onOpen(c)}><DocumentNumberTag number={c.number} /></button>,
        },
        { key: 'date', title: t('claims.columns.reportedDate'), render: (_, c) => <DateText value={c.reportedDate} /> },
        { key: 'description', title: t('claims.columns.description'), render: (_, c) => <span className="line-clamp-2 break-words">{c.description}</span> },
        { key: 'severity', title: t('claims.columns.severity'), render: (_, c) => <StatusTag enumName="warrantyClaimSeverity" value={c.severity} tones={SEVERITY_TONES} /> },
        { key: 'status', title: t('claims.columns.status'), render: (_, c) => <StatusTag enumName="warrantyClaimStatus" value={c.status} tones={CLAIM_STATUS_TONES} /> },
        { key: 'assignee', title: t('claims.columns.assignee'), render: (_, c) => (c.assigneeName !== '' ? c.assigneeName : '–') },
        { key: 'due', title: t('claims.columns.dueDate'), render: (_, c) => <DateText value={c.dueDate} /> },
        { key: 'cost', title: t('claims.columns.cost'), align: 'right', render: (_, c) => (c.costAmount > 0 ? <MoneyText value={c.costAmount} /> : '–') },
    ];
    return (
        <Table<WarrantyClaimDto>
            size="small" rowKey="id" columns={columns} dataSource={[...claims]} scroll={{ x: 'max-content' }}
            pagination={claims.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
            onRow={c => ({ onDoubleClick: () => onOpen(c) })}
        />
    );
}
