'use client';

// ─── The lines of one section: description (TH / EN), unit, qty, unit prices, amount ───
import { Button, Input, Table, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyInput } from '../shared/QtyInput';
import type { FormLine, PricedLine } from './logic';

export function LinesTable({ lines, editable, seesMargins, onPatch, onRemove, onAdd }: {
    lines: readonly PricedLine[];
    editable: boolean;
    seesMargins: boolean;
    onPatch: (ck: string, patch: Partial<FormLine>) => void;
    onRemove: (ck: string) => void;
    onAdd: (kind: 'custom' | 'note') => void;
}) {
    const t = useTranslations('quotations');

    const columns: ColumnsType<PricedLine> = [
        {
            key: 'desc', title: t('lines.desc'),
            render: (_, l) => (editable ? (
                <div className="flex min-w-[220px] flex-col gap-1">
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2000} value={l.descTh} aria-label={t('lines.descTh')}
                        placeholder={t('lines.descTh')} onChange={e => onPatch(l.ck, { descTh: e.target.value })} />
                    <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} maxLength={2000} value={l.descEn} aria-label={t('lines.descEn')}
                        placeholder={t('lines.descEn')} onChange={e => onPatch(l.ck, { descEn: e.target.value })} />
                </div>
            ) : (
                <div className="min-w-[220px] break-words">
                    <div className={l.kind === 'note' ? 'italic text-gray-600' : ''}>{l.descTh}</div>
                    {l.descEn !== '' && <div className="text-[12px] text-gray-500">{l.descEn}</div>}
                </div>
            )),
        },
        {
            key: 'unit', title: t('lines.unit'), width: 90,
            render: (_, l) => (l.kind === 'note' ? null : editable && l.kind === 'custom'
                ? <Input className="!w-[80px]" maxLength={40} value={l.unit} aria-label={t('lines.unit')} onChange={e => onPatch(l.ck, { unit: e.target.value })} />
                : <span className="whitespace-nowrap">{l.unit}</span>),
        },
        {
            key: 'qty', title: t('lines.qty'), align: 'right',
            render: (_, l) => (l.kind === 'note' ? null : editable
                ? <QtyInput className="!w-[120px]" value={l.qty} aria-label={t('lines.qty')} onChange={v => onPatch(l.ck, { qty: v ?? 0 })} />
                : <span className="tabular-nums">{l.qty}</span>),
        },
        ...(seesMargins ? [
            {
                key: 'costMat', title: t('lines.costMatUnit'), align: 'right' as const,
                render: (_: unknown, l: PricedLine) => (l.kind === 'note' ? null : editable && l.kind === 'custom'
                    ? <MoneyInput className="!w-[110px]" value={l.costMatUnit} aria-label={t('lines.costMatUnit')} onChange={v => onPatch(l.ck, { costMatUnit: v ?? 0 })} />
                    : <MoneyText value={l.costMatUnit} muted />),
            },
            {
                key: 'costLab', title: t('lines.costLabUnit'), align: 'right' as const,
                render: (_: unknown, l: PricedLine) => (l.kind === 'note' ? null : editable && l.kind === 'custom'
                    ? <MoneyInput className="!w-[110px]" value={l.costLabUnit} aria-label={t('lines.costLabUnit')} onChange={v => onPatch(l.ck, { costLabUnit: v ?? 0 })} />
                    : <MoneyText value={l.costLabUnit} muted />),
            },
            {
                key: 'cost', title: t('lines.costAmount'), align: 'right' as const,
                render: (_: unknown, l: PricedLine) => (l.kind === 'note' ? null : <MoneyText value={l.costAmount} muted />),
            },
        ] : []),
        { key: 'sellUnit', title: t('lines.sellUnit'), align: 'right', render: (_, l) => (l.kind === 'note' ? null : <MoneyText value={l.sellUnit} />) },
        { key: 'sell', title: t('lines.sellAmount'), align: 'right', render: (_, l) => (l.kind === 'note' ? null : <MoneyText value={l.sellAmount} className="font-semibold" />) },
        ...(editable ? [{
            key: 'actions', title: '', width: 48,
            render: (_: unknown, l: PricedLine) => (
                <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('lines.remove')} title={t('lines.remove')} onClick={() => onRemove(l.ck)} />
            ),
        }] : []),
    ];

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Table<PricedLine> size="small" rowKey="ck" columns={columns} dataSource={[...lines]} pagination={false}
                scroll={{ x: 'max-content' }} locale={{ emptyText: t('lines.empty') }}
                rowClassName={l => (l.kind === 'boq' ? '' : 'bg-gray-50')} />
            {editable && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="small" icon={<PlusOutlined />} onClick={() => onAdd('custom')}>{t('lines.addCustom')}</Button>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => onAdd('note')}>{t('lines.addNote')}</Button>
                    <Tag className="!m-0">{t('lines.count', { count: lines.length })}</Tag>
                </div>
            )}
        </div>
    );
}
