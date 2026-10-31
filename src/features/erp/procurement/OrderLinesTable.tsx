'use client';

// ─── The lines of a purchase order: editable cards while it is a draft, a table (with received / billed) afterwards ───
import { Button, Input, Table } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { orderLineAmount } from '@/domain/procurement/order-totals';
import type { CostCodeDto, PurchaseOrderLineDto, PurchaseOrderLineInput } from '@/shared/contract';
import { CostCodePicker } from '../shared/CostCodePicker';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyInput } from '../shared/QtyInput';
import { QtyText } from '../shared/QtyText';

export interface OrderLineForm {
    key: string;
    requestLineId: string | null;
    costCodeId: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number | null;
    unitPrice: number;
}

let lineSeq = 0;
export const blankOrderLine = (): OrderLineForm => ({
    key: `n${++lineSeq}`, requestLineId: null, costCodeId: null, descTh: '', descEn: '', unit: '', qty: null, unitPrice: 0,
});

export const orderLineForms = (lines: readonly PurchaseOrderLineDto[]): OrderLineForm[] =>
    lines.map(l => ({
        key: l.id, requestLineId: l.requestLineId, costCodeId: l.costCodeId, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice,
    }));

export const orderLineValid = (l: OrderLineForm): boolean =>
    (l.qty ?? 0) > 0 && (l.requestLineId !== null || l.costCodeId !== null || l.descTh.trim() !== '' || l.descEn.trim() !== '');

export const toOrderLineInputs = (lines: readonly OrderLineForm[]): PurchaseOrderLineInput[] =>
    lines.map(l => ({
        requestLineId: l.requestLineId,
        costCodeId: l.costCodeId,
        descTh: l.descTh.trim(),
        descEn: l.descEn.trim(),
        unit: l.unit.trim(),
        qty: l.qty ?? 0,
        unitPrice: l.unitPrice,
    }));

function LineEditor({ projectId, line, onChange, onRemove }: {
    projectId: string;
    line: OrderLineForm;
    onChange: (p: Partial<OrderLineForm>) => void;
    onRemove: () => void;
}) {
    const t = useTranslations('procurement.order.lines');
    const fromCode = (id: string | null, code: CostCodeDto | undefined) => {
        if (id === null || code === undefined) { onChange({ costCodeId: null }); return; }
        onChange({
            costCodeId: id,
            ...(line.descTh.trim() === '' ? { descTh: code.descTh, descEn: code.descEn } : {}),
            ...(line.unit.trim() === '' ? { unit: code.unit } : {}),
            ...(line.unitPrice === 0 && code.baselineMatUnit !== null ? { unitPrice: code.baselineMatUnit } : {}),
        });
    };
    const amount = orderLineAmount(line.qty ?? 0, line.unitPrice);
    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 p-3">
            <div className="flex items-start gap-2">
                <Input value={line.descTh} maxLength={500} placeholder={t('descPlaceholder')} aria-label={t('desc')}
                    status={!orderLineValid({ ...line, qty: 1 }) ? 'error' : undefined} onChange={e => onChange({ descTh: e.target.value })} />
                <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('remove')} onClick={onRemove} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('qty')}
                    <QtyInput value={line.qty} status={(line.qty ?? 0) > 0 ? undefined : 'error'} onChange={v => onChange({ qty: v })} />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('unit')}
                    <Input value={line.unit} maxLength={40} onChange={e => onChange({ unit: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('unitPrice')}
                    <MoneyInput value={line.unitPrice} onChange={v => onChange({ unitPrice: v ?? 0 })} />
                </label>
                <div className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('amount')}
                    <MoneyText value={amount} className="py-1 text-[14px] font-semibold text-gray-900" />
                </div>
            </div>
            <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                {t('costCode')}
                <CostCodePicker projectId={projectId} value={line.costCodeId} onChange={fromCode} />
            </label>
        </div>
    );
}

/** Draft: edit the lines (price and quantity of each, add a typed line, remove). */
export function OrderLinesEditor({ projectId, lines, onChange }: {
    projectId: string;
    lines: readonly OrderLineForm[];
    onChange: (lines: OrderLineForm[]) => void;
}) {
    const t = useTranslations('procurement.order.lines');
    const set = (key: string, p: Partial<OrderLineForm>) => onChange(lines.map(l => (l.key === key ? { ...l, ...p } : l)));
    return (
        <div className="flex min-w-0 flex-col gap-2">
            {lines.map(l => (
                <LineEditor key={l.key} projectId={projectId} line={l} onChange={p => set(l.key, p)} onRemove={() => onChange(lines.filter(x => x.key !== l.key))} />
            ))}
            <div><Button icon={<PlusOutlined />} onClick={() => onChange([...lines, blankOrderLine()])}>{t('add')}</Button></div>
        </div>
    );
}

/** After the PO is issued: what was ordered, received and billed per line. */
export function OrderLinesTable({ lines }: { lines: readonly PurchaseOrderLineDto[] }) {
    const t = useTranslations('procurement.order.lines');
    const columns: ColumnsType<PurchaseOrderLineDto> = [
        { key: 'code', title: t('costCode'), render: (_, l) => l.costCode ?? '–' },
        { key: 'desc', title: t('desc'), render: (_, l) => <span className="break-words">{l.descTh !== '' ? l.descTh : l.descEn}</span> },
        { key: 'qty', title: t('qty'), align: 'right', render: (_, l) => <QtyText value={l.qty} unit={l.unit} /> },
        { key: 'price', title: t('unitPrice'), align: 'right', render: (_, l) => <MoneyText value={l.unitPrice} /> },
        { key: 'amount', title: t('amount'), align: 'right', render: (_, l) => <MoneyText value={l.amount} className="font-semibold" /> },
        {
            key: 'received', title: t('received'), align: 'right',
            render: (_, l) => <QtyText value={l.receivedQty} className={l.receivedQty >= l.qty ? 'text-green-700' : l.receivedQty > 0 ? 'text-orange-600' : 'text-gray-500'} />,
        },
        { key: 'billed', title: t('billed'), align: 'right', render: (_, l) => <QtyText value={l.billedQty} className="text-gray-500" /> },
    ];
    return <Table<PurchaseOrderLineDto> size="small" rowKey="id" columns={columns} dataSource={[...lines]} pagination={false} scroll={{ x: 'max-content' }} />;
}
