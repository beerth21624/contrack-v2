'use client';

// ─── Supplier register: search, filter by kind / trade, show archived, add, import from the subcontracting vendor list ───
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Input, Modal, Rate, Result, Select, Skeleton, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ImportOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { SUPPLIER_KINDS, type SupplierDto, type SupplierKind, TRADE_IDS, type TradeId, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useModuleEnabled } from '@/features/modules/modules';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { SupplierForm } from './SupplierForm';
import { useCreateSupplier, useImportScSuppliers, useSuppliers } from './hooks';

export const supplierHref = (id: string): string => `/suppliers/${encodeURIComponent(id)}`;

export function SuppliersPage() {
    const t = useTranslations('suppliers');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message, modal } = App.useApp();
    const router = useRouter();
    const ws = useErpWorkspace();
    const wsId = ws.workspaceId;
    const mayManage = can(ws.role, 'suppliers.manage');
    const subcontracting = useModuleEnabled('subcontracting', wsId);
    const mayImport = mayManage && subcontracting.enabled;
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [kind, setKind] = useState<SupplierKind | undefined>(undefined);
    const [trade, setTrade] = useState<TradeId | undefined>(undefined);
    const [archived, setArchived] = useState(false);
    const [adding, setAdding] = useState(false);
    const list = useSuppliers(wsId, { q, kind, trade, archived });
    const create = useCreateSupplier(wsId ?? '');
    const importSc = useImportScSuppliers(wsId ?? '');

    useEffect(() => {
        const id = setTimeout(() => setQ(text), 300);
        return () => clearTimeout(id);
    }, [text]);

    const runImport = () => {
        modal.confirm({
            title: t('import.confirm'),
            content: t('import.hint'),
            okText: t('import.run'),
            cancelText: t('picker.cancel'),
            onOk: async () => {
                try {
                    const r = await importSc.mutateAsync();
                    void message.success(r.created === 0 ? t('import.nothing') : t('import.done', { count: r.created }));
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    const filtered = q !== '' || kind !== undefined || trade !== undefined || archived;
    const columns: ColumnsType<SupplierDto> = [
        {
            title: t('columns.name'),
            key: 'name',
            render: (_, s) => (
                <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.nameTh !== '' ? s.nameTh : s.nameEn}</span>
                    {s.nameTh !== '' && s.nameEn !== '' && <span className="text-gray-500">{s.nameEn}</span>}
                    {s.scVendorListEntryId !== null && <Tag className="!m-0" color="orange">{t('fromScTag')}</Tag>}
                    {s.archivedAt !== null && <Tag className="!m-0">{t('archivedTag')}</Tag>}
                </span>
            ),
        },
        { title: t('columns.kind'), key: 'kind', responsive: ['md'], render: (_, s) => tEnums(`supplierKind.${s.kind}`) },
        {
            title: t('columns.trades'), key: 'trades', responsive: ['lg'],
            render: (_, s) => (s.trades.length === 0 ? '–' : (
                <span className="flex flex-wrap gap-1">{s.trades.map(id => <Tag key={id} className="!m-0">{tEnums(`trade.${id}`)}</Tag>)}</span>
            )),
        },
        {
            title: t('columns.taxId'), key: 'taxId', responsive: ['lg'],
            render: (_, s) => (s.taxId === '' ? '–' : <span className="tabular-nums">{s.taxId}{s.branchCode !== '' ? ` / ${s.branchCode}` : ''}</span>),
        },
        { title: t('columns.phone'), key: 'phone', responsive: ['md'], render: (_, s) => (s.phone === '' ? '–' : s.phone) },
        {
            title: t('columns.rating'), key: 'rating', responsive: ['md'],
            render: (_, s) => (s.rating === null ? <span className="text-gray-400">{t('rating.none')}</span> : (
                <span className="flex items-center gap-1 whitespace-nowrap">
                    <Rate disabled allowHalf value={Math.round(s.rating * 2) / 2} className="!text-sm" />
                    <span className="tabular-nums text-gray-500">{s.rating.toFixed(1)} ({s.ratingCount})</span>
                </span>
            )),
        },
    ];

    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={mayManage ? (
                <Space wrap>
                    {mayImport && <Button icon={<ImportOutlined />} loading={importSc.isPending} onClick={runImport}>{t('import.button')}</Button>}
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>{t('add')}</Button>
                </Space>
            ) : undefined}
        >
            <SectionCard>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Input.Search className="!w-full md:!w-80" allowClear value={text} placeholder={t('search')}
                        onChange={e => setText(e.target.value)} onSearch={v => setQ(v)} />
                    <Select<SupplierKind | 'all'> className="min-w-40" value={kind ?? 'all'} onChange={v => setKind(v === 'all' ? undefined : v)}
                        options={[{ value: 'all', label: t('allKinds') }, ...SUPPLIER_KINDS.map(k => ({ value: k, label: tEnums(`supplierKind.${k}`) }))]} />
                    <Select<TradeId | 'all'> className="min-w-48" value={trade ?? 'all'} onChange={v => setTrade(v === 'all' ? undefined : v)}
                        options={[{ value: 'all', label: t('allTrades') }, ...TRADE_IDS.map(id => ({ value: id, label: tEnums(`trade.${id}`) }))]} />
                    <label className="flex items-center gap-2 text-secondary text-gray-600">
                        <Switch checked={archived} onChange={setArchived} />{t('showArchived')}
                    </label>
                </div>
                {list.isError ? (
                    <Result status="warning" title={t('loadFailed')} subTitle={toText(list.error)}
                        extra={<Button onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
                ) : list.data === undefined ? (
                    <Skeleton active />
                ) : list.data.length === 0 ? (
                    <EmptyState
                        title={filtered ? t('emptySearch') : t('empty')}
                        hint={!filtered && mayManage ? (mayImport ? t('emptyHintImport') : t('emptyHint')) : undefined}
                        action={!filtered && mayManage ? (
                            <Space wrap>
                                {mayImport && <Button icon={<ImportOutlined />} loading={importSc.isPending} onClick={runImport}>{t('import.button')}</Button>}
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>{t('add')}</Button>
                            </Space>
                        ) : undefined}
                    />
                ) : (
                    <Table<SupplierDto> rowKey="id" columns={columns} dataSource={list.data} pagination={false} size="middle"
                        scroll={{ x: 'max-content' }}
                        onRow={s => ({ onClick: () => router.push(supplierHref(s.id)), className: 'cursor-pointer' })} />
                )}
            </SectionCard>
            <Modal open={adding} title={t('add')} footer={null} width={880} destroyOnHidden onCancel={() => setAdding(false)}>
                <SupplierForm
                    submitting={create.isPending}
                    submitLabel={t('actions.create')}
                    cancelLabel={t('picker.cancel')}
                    onCancel={() => setAdding(false)}
                    onSubmit={async body => {
                        const s = await create.mutateAsync(body);
                        void message.success(t('created'));
                        setAdding(false);
                        router.push(supplierHref(s.id));
                    }}
                />
            </Modal>
        </ErpPage>
    );
}
