'use client';

// ─── Customer register: search, filter by type, show archived, add ───
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Input, Modal, Result, Select, Skeleton, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { CUSTOMER_KINDS, type CustomerDto, type CustomerKind, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { CustomerForm } from './CustomerForm';
import { useCreateCustomer, useCustomers } from './hooks';

const detailHref = (id: string): string => `/customers/${encodeURIComponent(id)}`;

export function CustomersPage() {
    const t = useTranslations('customers');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const ws = useErpWorkspace();
    const wsId = ws.workspaceId;
    const mayManage = can(ws.role, 'customers.manage');
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const [kind, setKind] = useState<CustomerKind | undefined>(undefined);
    const [archived, setArchived] = useState(false);
    const [adding, setAdding] = useState(false);
    const list = useCustomers(wsId, { q, kind, archived });
    const create = useCreateCustomer(wsId ?? '');

    useEffect(() => {
        const id = setTimeout(() => setQ(text), 300);
        return () => clearTimeout(id);
    }, [text]);

    const columns: ColumnsType<CustomerDto> = [
        {
            title: t('columns.name'),
            key: 'name',
            render: (_, c) => (
                <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.nameTh !== '' ? c.nameTh : c.nameEn}</span>
                    {c.nameTh !== '' && c.nameEn !== '' && <span className="text-gray-500">{c.nameEn}</span>}
                    {c.archivedAt !== null && <Tag className="!m-0">{t('archivedTag')}</Tag>}
                </span>
            ),
        },
        { title: t('columns.kind'), key: 'kind', responsive: ['md'], render: (_, c) => tEnums(`customerKind.${c.kind}`) },
        {
            title: t('columns.taxId'), key: 'taxId', responsive: ['lg'],
            render: (_, c) => (c.taxId === '' ? '–' : <span className="tabular-nums">{c.taxId}{c.branchCode !== '' ? ` / ${c.branchCode}` : ''}</span>),
        },
        { title: t('columns.contact'), key: 'contact', responsive: ['lg'], render: (_, c) => (c.contactName === '' ? '–' : c.contactName) },
        { title: t('columns.phone'), key: 'phone', responsive: ['md'], render: (_, c) => (c.phone === '' ? '–' : c.phone) },
    ];

    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={mayManage ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>{t('add')}</Button> : undefined}
        >
            <SectionCard>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Input.Search className="!w-full md:!w-80" allowClear value={text} placeholder={t('search')}
                        onChange={e => setText(e.target.value)} onSearch={v => setQ(v)} />
                    <Select<CustomerKind | 'all'> className="min-w-40" value={kind ?? 'all'} onChange={v => setKind(v === 'all' ? undefined : v)}
                        options={[{ value: 'all', label: t('allKinds') }, ...CUSTOMER_KINDS.map(k => ({ value: k, label: tEnums(`customerKind.${k}`) }))]} />
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
                        title={q !== '' || kind !== undefined || archived ? t('emptySearch') : t('empty')}
                        hint={q === '' && kind === undefined && !archived && mayManage ? t('emptyHint') : undefined}
                        action={q === '' && kind === undefined && !archived && mayManage
                            ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setAdding(true)}>{t('add')}</Button> : undefined}
                    />
                ) : (
                    <Table<CustomerDto> rowKey="id" columns={columns} dataSource={list.data} pagination={false} size="middle"
                        scroll={{ x: 'max-content' }}
                        onRow={c => ({ onClick: () => router.push(detailHref(c.id)), className: 'cursor-pointer' })} />
                )}
            </SectionCard>
            <Modal open={adding} title={t('add')} footer={null} width={880} destroyOnHidden onCancel={() => setAdding(false)}>
                <CustomerForm
                    submitting={create.isPending}
                    submitLabel={t('actions.create')}
                    cancelLabel={t('picker.cancel')}
                    onCancel={() => setAdding(false)}
                    onSubmit={async body => {
                        const c = await create.mutateAsync(body);
                        void message.success(t('created'));
                        setAdding(false);
                        router.push(detailHref(c.id));
                    }}
                />
            </Modal>
        </ErpPage>
    );
}
