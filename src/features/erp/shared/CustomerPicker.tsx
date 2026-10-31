'use client';

// ─── Pick a customer of the workspace (search as you type) or create a new one without leaving the screen ───
// <CustomerPicker value={customerId} onChange={(id, customer) => …} /> — `workspaceId` defaults to the current workspace.
import { useEffect, useState } from 'react';
import { App, Modal, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { type CustomerDto, can } from '@/shared/contract';
import { CustomerForm } from '../customers/CustomerForm';
import { useCreateCustomer, useCustomer, useCustomers } from '../customers/hooks';
import { useErpWorkspace } from './useErpWorkspace';

const NEW = '__new__';
const labelOf = (c: CustomerDto): string => (c.nameTh !== '' ? c.nameTh : c.nameEn);

export function CustomerPicker({ value, onChange, workspaceId, disabled, allowCreate = true, allowClear = true, placeholder, className, status }: {
    value?: string | null;
    onChange?: (customerId: string | null, customer: CustomerDto | null) => void;
    workspaceId?: string;
    disabled?: boolean;
    /** Offer "new customer" (needs `customers.manage`). */
    allowCreate?: boolean;
    allowClear?: boolean;
    placeholder?: string;
    className?: string;
    status?: 'error' | 'warning';
}) {
    const t = useTranslations('customers');
    const { message } = App.useApp();
    const ws = useErpWorkspace(workspaceId);
    const wsId = ws.workspaceId;
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState<string | null>(null);
    const list = useCustomers(wsId, { q });
    const selected = useCustomer(value ?? undefined);
    const create = useCreateCustomer(wsId ?? '');
    const mayCreate = allowCreate && can(ws.role, 'customers.manage');

    useEffect(() => {
        const id = setTimeout(() => setQ(search), 250);
        return () => clearTimeout(id);
    }, [search]);

    const found = list.data ?? [];
    const byId = new Map<string, CustomerDto>(found.map(c => [c.id, c]));
    if (selected.data !== undefined) byId.set(selected.data.id, selected.data);
    const options = [
        ...found.map(c => ({ value: c.id, label: labelOf(c), customer: c })),
        ...(value !== undefined && value !== null && !found.some(c => c.id === value)
            ? [{ value, label: selected.data !== undefined ? labelOf(selected.data) : value, customer: selected.data }] : []),
        ...(mayCreate ? [{ value: NEW, label: search.trim() === '' ? t('picker.create') : t('picker.createNamed', { name: search.trim() }), customer: undefined }] : []),
    ];

    return (
        <>
            <Select
                showSearch={{ filterOption: false, searchValue: search, onSearch: setSearch }}
                allowClear={allowClear}
                className={className ?? 'w-full'}
                disabled={disabled}
                status={status}
                placeholder={placeholder ?? t('picker.placeholder')}
                value={value ?? undefined}
                loading={list.isLoading}
                onOpenChange={open => { if (!open) setSearch(''); }}
                notFoundContent={t('picker.noResult')}
                optionRender={o => (o.value === NEW ? <span className="flex items-center gap-2 text-orange-600"><PlusOutlined />{o.label}</span> : o.label)}
                options={options.map(o => ({ value: o.value, label: o.label }))}
                onChange={(v: string | undefined) => {
                    if (v === NEW) { setCreating(search.trim()); return; }
                    onChange?.(v ?? null, v === undefined ? null : byId.get(v) ?? null);
                }}
            />
            <Modal open={creating !== null} title={t('picker.modalTitle')} footer={null} width={880} destroyOnHidden onCancel={() => setCreating(null)}>
                <CustomerForm
                    defaultName={creating ?? undefined}
                    submitting={create.isPending}
                    submitLabel={t('actions.create')}
                    cancelLabel={t('picker.cancel')}
                    onCancel={() => setCreating(null)}
                    onSubmit={async body => {
                        const c = await create.mutateAsync(body);
                        void message.success(t('created'));
                        setCreating(null);
                        setSearch('');
                        onChange?.(c.id, c);
                    }}
                />
            </Modal>
        </>
    );
}
