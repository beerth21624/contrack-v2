'use client';

// ─── Pick cost codes of the BOQ for a purchase request; the quantity that remains is filled in by the server ───
import { useState } from 'react';
import { Input, Modal, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { CostCodeDto } from '@/shared/contract';
import { useCostCodes } from '../boq-control/hooks';
import { QtyText } from '../shared/QtyText';

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

export function FromBoqPicker({ projectId, busy, onPick, onClose }: {
    projectId: string;
    busy: boolean;
    onPick: (costCodeIds: string[]) => void;
    onClose: () => void;
}) {
    const t = useTranslations('procurement.fromBoq');
    const codes = useCostCodes(projectId);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string[]>([]);
    const q = norm(search);
    const rows = (codes.data ?? []).filter(c => c.status === 'active' && (q === '' || norm(`${c.code} ${c.descTh} ${c.descEn}`).includes(q)));

    const columns: ColumnsType<CostCodeDto> = [
        { key: 'code', title: t('columns.code'), render: (_, c) => <span className="font-semibold tabular-nums">{c.code}</span> },
        { key: 'desc', title: t('columns.desc'), render: (_, c) => <span className="break-words">{c.descTh}</span> },
        { key: 'qty', title: t('columns.qty'), align: 'right', render: (_, c) => <QtyText value={c.baselineQty + c.voQty} unit={c.unit} /> },
    ];

    return (
        <Modal open title={t('title')} width={760} okText={t('submit', { count: selected.length })} confirmLoading={busy}
            okButtonProps={{ disabled: selected.length === 0 }} onCancel={onClose} onOk={() => onPick(selected)} destroyOnHidden>
            <div className="flex min-w-0 flex-col gap-3">
                <div className="text-[13px] text-gray-500">{t('hint')}</div>
                <Input allowClear value={search} placeholder={t('search')} onChange={e => setSearch(e.target.value)} />
                <Table<CostCodeDto> size="small" rowKey="id" columns={columns} dataSource={rows} loading={codes.isLoading}
                    locale={{ emptyText: codes.isError ? t('loadFailed') : t('empty') }}
                    rowSelection={{ selectedRowKeys: selected, preserveSelectedRowKeys: true, onChange: keys => setSelected(keys.map(String)) }}
                    pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
                    scroll={{ x: 'max-content', y: 360 }} />
            </div>
        </Modal>
    );
}
