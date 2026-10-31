'use client';

// ─── Pick a government reference price for a BOQ material line (WP-21) ───
// <PriceReferenceButton workspaceId={ws} unit="ลบ.ม." onPick={price => …} /> — a small button that opens a search dialog;
// the chosen item's price goes to `onPick`. <PriceReferencePicker> is the dialog alone.
import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Table, Tag, Tooltip } from 'antd';
import { TagOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PriceReferenceItemDto } from '@/shared/contract';
import { MoneyText } from '../shared/MoneyText';
import { usePriceReferenceSearch } from './hooks';

export function PriceReferencePicker({ workspaceId, open, unit, onPick, onClose }: {
    workspaceId: string | undefined;
    open: boolean;
    /** The BOQ line's unit, shown so the user can compare it with the catalogue unit. */
    unit?: string;
    onPick: (item: PriceReferenceItemDto) => void;
    onClose: () => void;
}) {
    const t = useTranslations('priceReference');
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    useEffect(() => {
        const id = setTimeout(() => setQ(text), 250);
        return () => clearTimeout(id);
    }, [text]);
    const search = usePriceReferenceSearch(workspaceId, q, open);
    const rows = search.data ?? [];

    return (
        <Modal open={open} onCancel={onClose} footer={null} width={900} destroyOnHidden title={t('title')}>
            <Input.Search autoFocus allowClear value={text} onChange={e => setText(e.target.value)}
                placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} className="!mb-3" />
            {unit !== undefined && unit !== '' && <div className="mb-2 text-xs text-gray-500">{t('lineUnit', { unit })}</div>}
            {search.isError && <Alert type="error" showIcon className="!mb-3" title={t('loadFailed')} />}
            <Table<PriceReferenceItemDto> size="small" rowKey="id" loading={search.isLoading} dataSource={rows}
                pagination={false} scroll={{ y: 380 }}
                locale={{ emptyText: q.trim() === '' ? t('emptyHint') : t('noResults') }}
                columns={[
                    {
                        title: t('columns.material'), key: 'material',
                        render: (_: unknown, r) => (
                            <div>
                                <div>
                                    {r.material}
                                    {r.greenLabel && <Tag color="green" className="!ml-2">{t('green')}</Tag>}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {[r.spec, r.brand, r.model].filter(x => x !== '').join(' · ')}
                                </div>
                            </div>
                        ),
                    },
                    { title: t('columns.unit'), dataIndex: 'unit', key: 'unit', width: 90 },
                    {
                        title: t('columns.price'), key: 'price', width: 120, align: 'right',
                        render: (_: unknown, r) => <MoneyText value={r.price} />,
                    },
                    {
                        title: '', key: 'use', width: 90,
                        render: (_: unknown, r) => <Button size="small" type="primary" onClick={() => onPick(r)}>{t('use')}</Button>,
                    },
                ]} />
            <div className="mt-2 text-xs text-gray-500">{t('source')}</div>
        </Modal>
    );
}

/** An icon button for a BOQ price cell; opens the picker and closes it after a pick. */
export function PriceReferenceButton({ workspaceId, unit, onPick }: {
    workspaceId: string | undefined;
    unit?: string;
    onPick: (price: number, item: PriceReferenceItemDto) => void;
}) {
    const t = useTranslations('priceReference');
    const [open, setOpen] = useState(false);
    return (
        <>
            <Tooltip title={t('button')}>
                <Button type="text" size="small" icon={<TagOutlined />} aria-label={t('button')} onClick={() => setOpen(true)} />
            </Tooltip>
            {open && (
                <PriceReferencePicker workspaceId={workspaceId} open unit={unit} onClose={() => setOpen(false)}
                    onPick={item => { onPick(item.price, item); setOpen(false); }} />
            )}
        </>
    );
}
