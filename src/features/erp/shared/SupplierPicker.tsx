'use client';

// ─── Pick a supplier of the workspace (search as you type, optionally by kind / trade) or create a new one in place ───
// <SupplierPicker value={supplierId} onChange={(id, supplier) => …} /> — `workspaceId` defaults to the current workspace.
import { useEffect, useState } from 'react';
import { App, Modal, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { type SupplierDto, type SupplierKind, type TradeId, can } from '@/shared/contract';
import { SupplierForm } from '../suppliers/SupplierForm';
import { useCreateSupplier, useSupplier, useSuppliers } from '../suppliers/hooks';
import { useErpWorkspace } from './useErpWorkspace';

const NEW = '__new__';
const labelOf = (s: SupplierDto): string => (s.nameTh !== '' ? s.nameTh : s.nameEn);

export function SupplierPicker({ value, onChange, workspaceId, kind, trade, disabled, allowCreate = true, allowClear = true, placeholder, className, status }: {
    value?: string | null;
    onChange?: (supplierId: string | null, supplier: SupplierDto | null) => void;
    workspaceId?: string;
    /** Only suppliers of this kind / trade in the list. */
    kind?: SupplierKind;
    trade?: TradeId;
    disabled?: boolean;
    /** Offer "new supplier" (needs `suppliers.manage`). */
    allowCreate?: boolean;
    allowClear?: boolean;
    placeholder?: string;
    className?: string;
    status?: 'error' | 'warning';
}) {
    const t = useTranslations('suppliers');
    const { message } = App.useApp();
    const ws = useErpWorkspace(workspaceId);
    const wsId = ws.workspaceId;
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState<string | null>(null);
    const list = useSuppliers(wsId, { q, kind, trade });
    const selected = useSupplier(value ?? undefined);
    const create = useCreateSupplier(wsId ?? '');
    const mayCreate = allowCreate && can(ws.role, 'suppliers.manage');

    useEffect(() => {
        const id = setTimeout(() => setQ(search), 250);
        return () => clearTimeout(id);
    }, [search]);

    const found = list.data ?? [];
    const byId = new Map<string, SupplierDto>(found.map(s => [s.id, s]));
    if (selected.data !== undefined) byId.set(selected.data.id, selected.data);
    const options = [
        ...found.map(s => ({ value: s.id, label: labelOf(s) })),
        ...(value !== undefined && value !== null && !found.some(s => s.id === value)
            ? [{ value, label: selected.data !== undefined ? labelOf(selected.data) : value }] : []),
        ...(mayCreate ? [{ value: NEW, label: search.trim() === '' ? t('picker.create') : t('picker.createNamed', { name: search.trim() }) }] : []),
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
                options={options}
                onChange={(v: string | undefined) => {
                    if (v === NEW) { setCreating(search.trim()); return; }
                    onChange?.(v ?? null, v === undefined ? null : byId.get(v) ?? null);
                }}
            />
            <Modal open={creating !== null} title={t('picker.modalTitle')} footer={null} width={880} destroyOnHidden onCancel={() => setCreating(null)}>
                <SupplierForm
                    defaultName={creating ?? undefined}
                    defaultKind={kind}
                    defaultTrades={trade === undefined ? undefined : [trade]}
                    submitting={create.isPending}
                    submitLabel={t('actions.create')}
                    cancelLabel={t('picker.cancel')}
                    onCancel={() => setCreating(null)}
                    onSubmit={async body => {
                        const s = await create.mutateAsync(body);
                        void message.success(t('created'));
                        setCreating(null);
                        setSearch('');
                        onChange?.(s.id, s);
                    }}
                />
            </Modal>
        </>
    );
}
