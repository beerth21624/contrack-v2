'use client';

// ─── VO lines: calculator lines (from the sandbox, read-only here) + manual lines (edited here, saved as a whole) ───
// Sell prices are always the server's; costs show only for `variations.manage` (the DTO leaves them out otherwise).
import { useMemo, useState } from 'react';
import { App, Button, Input, InputNumber, Table, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { round2 } from '@/domain/money';
import type { VariationOrderDto, VariationOrderLineDto, VariationOrderLineInput } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { CostCodePicker } from '../shared/CostCodePicker';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyInput } from '../shared/QtyInput';
import { QtyText } from '../shared/QtyText';
import { usePutVariationLines } from './hooks';

interface ManualRow {
    key: string;
    costCodeId: string | null;
    costCode: string | null;
    sectionNo: number;
    descTh: string;
    descEn: string;
    unit: string;
    qtyDelta: number;
    costMatUnit: number;
    costLabUnit: number;
}

let rowSeq = 0;
const newKey = (): string => { rowSeq += 1; return `new-${String(rowSeq)}`; };

function rowsFromDto(lines: readonly VariationOrderLineDto[]): ManualRow[] {
    return lines.filter(l => l.source === 'manual').sort((a, b) => a.sort - b.sort).map(l => ({
        key: l.id, costCodeId: l.costCodeId, costCode: l.costCode, sectionNo: l.sectionNo, descTh: l.descTh, descEn: l.descEn, unit: l.unit,
        qtyDelta: l.qtyDelta, costMatUnit: l.costMatUnit ?? 0, costLabUnit: l.costLabUnit ?? 0,
    }));
}

function toInput(r: ManualRow): VariationOrderLineInput {
    if (r.costCodeId !== null) return { costCodeId: r.costCodeId, qtyDelta: r.qtyDelta, costMatUnit: r.costMatUnit, costLabUnit: r.costLabUnit };
    return {
        costCodeId: null, sectionNo: r.sectionNo, descTh: r.descTh.trim(), descEn: r.descEn.trim(), unit: r.unit.trim(),
        qtyDelta: r.qtyDelta, costMatUnit: r.costMatUnit, costLabUnit: r.costLabUnit,
    };
}

const rowProblem = (r: ManualRow): boolean => r.costCodeId === null && r.descTh.trim() === '';

/** All lines, read-only (calculator and manual, BOQ order as the server sorted them). */
function LinesView({ dto }: { dto: VariationOrderDto }) {
    const t = useTranslations('variations');
    const seesCost = dto.costTotal !== undefined;
    const lines = useMemo(() => [...dto.lines].sort((a, b) => a.sort - b.sort), [dto.lines]);
    const columns: ColumnsType<VariationOrderLineDto> = [
        { key: 'code', title: t('lines.columns.code'), render: (_, l) => <span className="tabular-nums whitespace-nowrap">{l.costCode ?? t('lines.newItem')}</span> },
        {
            key: 'desc', title: t('lines.columns.desc'),
            render: (_, l) => (
                <span className="flex flex-wrap items-center gap-1 break-words">
                    {l.descTh}
                    <Tag className="!m-0" color={l.source === 'calculator' ? 'blue' : 'default'}>{t(`lines.source.${l.source}`)}</Tag>
                </span>
            ),
        },
        { key: 'qty', title: t('lines.columns.qtyDelta'), align: 'right', render: (_, l) => <QtyText value={l.qtyDelta} unit={l.unit} /> },
        ...(seesCost ? [
            { key: 'mat', title: t('lines.columns.costMatUnit'), align: 'right' as const, render: (_: unknown, l: VariationOrderLineDto) => <MoneyText value={l.costMatUnit} muted /> },
            { key: 'lab', title: t('lines.columns.costLabUnit'), align: 'right' as const, render: (_: unknown, l: VariationOrderLineDto) => <MoneyText value={l.costLabUnit} muted /> },
            { key: 'cost', title: t('lines.columns.costAmount'), align: 'right' as const, render: (_: unknown, l: VariationOrderLineDto) => <MoneyText value={l.costAmount} muted /> },
        ] : []),
        { key: 'sellUnit', title: t('lines.columns.sellUnit'), align: 'right', render: (_, l) => <MoneyText value={l.sellUnit} /> },
        { key: 'sell', title: t('lines.columns.sellAmount'), align: 'right', render: (_, l) => <MoneyText value={l.sellAmount} className="font-semibold" /> },
    ];
    return (
        <Table<VariationOrderLineDto> size="small" rowKey="id" columns={columns} dataSource={lines} pagination={false} scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('lines.empty') }} />
    );
}

/** The manual lines of a draft, edited as a list and saved with PUT lines. */
function ManualEditor({ dto }: { dto: VariationOrderDto }) {
    const t = useTranslations('variations');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutVariationLines(dto.id);
    const initial = useMemo(() => rowsFromDto(dto.lines), [dto.lines]);
    const initialKey = JSON.stringify(initial);
    const [rows, setRows] = useState<ManualRow[]>(initial);
    const [base, setBase] = useState(initialKey);
    // The server's manual lines changed (saved here, or by someone else): start again from them.
    if (base !== initialKey) {
        setBase(initialKey);
        setRows(initial);
    }
    const dirty = JSON.stringify(rows.map(toInput)) !== JSON.stringify(initial.map(toInput));
    const invalid = rows.some(rowProblem);

    const patch = (key: string, p: Partial<ManualRow>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...p } : r)));
    const add = () => setRows(rs => [...rs, {
        key: newKey(), costCodeId: null, costCode: null, sectionNo: 1, descTh: '', descEn: '', unit: '', qtyDelta: 1, costMatUnit: 0, costLabUnit: 0,
    }]);
    const save = async () => {
        try {
            await put.mutateAsync({ lines: rows.map(toInput) });
            void message.success(t('lines.saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const columns: ColumnsType<ManualRow> = [
        {
            key: 'code', title: t('lines.columns.costCode'), width: 240,
            render: (_, r) => (
                <CostCodePicker projectId={dto.projectId} value={r.costCodeId} allowClear placeholder={t('lines.newItem')} className="!w-[220px]"
                    onChange={(id, code) => {
                        if (id === null || code === undefined) { patch(r.key, { costCodeId: null, costCode: null }); return; }
                        patch(r.key, {
                            costCodeId: id, costCode: code.code, sectionNo: code.sectionNo, descTh: code.descTh, descEn: code.descEn, unit: code.unit,
                            costMatUnit: code.baselineMatUnit ?? r.costMatUnit, costLabUnit: code.baselineLabUnit ?? r.costLabUnit,
                        });
                    }} />
            ),
        },
        {
            key: 'desc', title: t('lines.columns.desc'), width: 260,
            render: (_, r) => (r.costCodeId !== null ? <span className="break-words">{r.descTh}</span> : (
                <div className="flex flex-col gap-1">
                    <Input size="small" value={r.descTh} maxLength={500} status={rowProblem(r) ? 'error' : undefined} placeholder={t('lines.descTh')}
                        onChange={e => patch(r.key, { descTh: e.target.value })} />
                    <Input size="small" value={r.descEn} maxLength={500} placeholder={t('lines.descEn')} onChange={e => patch(r.key, { descEn: e.target.value })} />
                </div>
            )),
        },
        {
            key: 'section', title: t('lines.columns.section'), width: 80,
            render: (_, r) => (r.costCodeId !== null ? <span className="tabular-nums">{r.sectionNo}</span> : (
                <InputNumber<number> size="small" className="!w-[70px]" min={0} max={999} precision={0} value={r.sectionNo}
                    onChange={v => patch(r.key, { sectionNo: v ?? 0 })} />
            )),
        },
        {
            key: 'unit', title: t('lines.columns.unit'), width: 80,
            render: (_, r) => (r.costCodeId !== null ? r.unit : (
                <Input size="small" className="!w-[70px]" value={r.unit} maxLength={40} onChange={e => patch(r.key, { unit: e.target.value })} />
            )),
        },
        {
            key: 'qty', title: t('lines.columns.qtyDelta'), width: 120,
            render: (_, r) => <QtyInput size="small" allowNegative className="!w-[110px]" value={r.qtyDelta} onChange={v => patch(r.key, { qtyDelta: v ?? 0 })} />,
        },
        {
            key: 'mat', title: t('lines.columns.costMatUnit'), width: 120,
            render: (_, r) => <MoneyInput size="small" className="!w-[110px]" value={r.costMatUnit} onChange={v => patch(r.key, { costMatUnit: v ?? 0 })} />,
        },
        {
            key: 'lab', title: t('lines.columns.costLabUnit'), width: 120,
            render: (_, r) => <MoneyInput size="small" className="!w-[110px]" value={r.costLabUnit} onChange={v => patch(r.key, { costLabUnit: v ?? 0 })} />,
        },
        {
            key: 'cost', title: t('lines.columns.costAmount'), align: 'right',
            render: (_, r) => <MoneyText value={round2(r.qtyDelta * (r.costMatUnit + r.costLabUnit))} muted />,
        },
        {
            key: 'remove', width: 40,
            render: (_, r) => (
                <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('lines.remove')} title={t('lines.remove')}
                    onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} />
            ),
        },
    ];

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="text-[13px] text-gray-500">{t('lines.manualHint')}</div>
            <Table<ManualRow> size="small" rowKey="key" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }}
                locale={{ emptyText: t('lines.manualEmpty') }} />
            <div className="flex flex-wrap items-center gap-2">
                <Button icon={<PlusOutlined />} onClick={add}>{t('lines.add')}</Button>
                <Button type="primary" icon={<SaveOutlined />} disabled={!dirty || invalid} loading={put.isPending} onClick={() => { void save(); }}>
                    {t('lines.save')}
                </Button>
                {dirty && <Tag className="!m-0" color="processing">{t('lines.unsaved')}</Tag>}
            </div>
        </div>
    );
}

export function VoLinesTable({ dto, editable }: { dto: VariationOrderDto; editable: boolean }) {
    const t = useTranslations('variations');
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <LinesView dto={dto} />
            {editable && (
                <div className="flex min-w-0 flex-col gap-2 border-t border-gray-100 pt-3">
                    <div className="font-semibold text-gray-900">{t('lines.manualTitle')}</div>
                    <ManualEditor dto={dto} />
                </div>
            )}
        </div>
    );
}
