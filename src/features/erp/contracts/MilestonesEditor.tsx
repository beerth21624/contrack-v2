'use client';

// ─── The payment milestones of a draft contract: shares, triggers, amounts from allocate() ───
// The advance milestone follows terms.advancePct (the server keeps it); the rest is edited here and saved as a whole.
import { useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Input, Select, Table, Tag } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
    CONTRACT_MILESTONE_TRIGGERS, MILESTONE_PCT_TOLERANCE, type ContractMilestoneInput, type MainContractDto,
} from '@/shared/contract';
import { allocate } from '@/domain/money';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { PercentInput } from '../quotations/PercentInput';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { usePutContractMilestones } from './hooks';

interface Row {
    key: number;
    labelTh: string;
    labelEn: string;
    kind: 'work' | 'final';
    pct: number;
    trigger: ContractMilestoneInput['trigger'];
    triggerProgress: number | null;
    dueDate: string | null;
}

export function MilestonesEditor({ contract, disabled, onSaved }: {
    contract: MainContractDto;
    disabled: boolean;
    onSaved?: () => void;
}) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const fmt = useFormat();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutContractMilestones(contract.id);
    // Keys of the loaded rows are 0…n-1; new rows count up from here (read in handlers only).
    const next = useRef(1000);
    const [rows, setRows] = useState<Row[]>(() => contract.milestones
        .filter(m => m.kind !== 'advance' && m.source === 'contract')
        .sort((a, b) => a.no - b.no)
        .map((m, i) => ({
            key: i, labelTh: m.labelTh, labelEn: m.labelEn, kind: m.kind === 'final' ? 'final' : 'work', pct: m.pct,
            trigger: m.trigger, triggerProgress: m.triggerProgress, dueDate: m.dueDate,
        })));
    const advance = contract.milestones.find(m => m.kind === 'advance');

    const amounts = useMemo(() => allocate(contract.originalValue, rows.map(r => Math.max(0, r.pct))), [contract.originalValue, rows]);
    const total = rows.reduce((s, r) => s + r.pct, 0);
    const empty = rows.length === 0;
    const sumOk = empty || Math.abs(total - 1) <= MILESTONE_PCT_TOLERANCE;
    const rowProblem = rows.some(r =>
        r.labelTh.trim() === '' || r.pct <= 0
        || (r.trigger === 'progress' && (r.triggerProgress === null || r.triggerProgress <= 0))
        || (r.trigger === 'date' && (r.dueDate === null || r.dueDate === '')));

    const update = (key: number, patch: Partial<Row>) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
    const move = (i: number, d: -1 | 1) => setRows(rs => {
        const j = i + d;
        if (j < 0 || j >= rs.length) return rs;
        const copy = [...rs];
        const a = copy[i];
        const b = copy[j];
        if (a === undefined || b === undefined) return rs;
        copy[i] = b;
        copy[j] = a;
        return copy;
    });
    const add = () => setRows(rs => [...rs, {
        key: next.current++, labelTh: '', labelEn: '', kind: 'work', pct: Math.max(0, Math.round((1 - total) * 1e6) / 1e6), trigger: 'manual', triggerProgress: null, dueDate: null,
    }]);

    const save = async () => {
        try {
            await put.mutateAsync({
                milestones: rows.map((r, i): ContractMilestoneInput => ({
                    labelTh: r.labelTh.trim(),
                    labelEn: r.labelEn.trim(),
                    // The last milestone closes the contract.
                    kind: i === rows.length - 1 ? 'final' : r.kind === 'final' ? 'work' : r.kind,
                    pct: r.pct,
                    trigger: r.trigger,
                    triggerProgress: r.trigger === 'progress' ? r.triggerProgress : null,
                    dueDate: r.trigger === 'date' ? r.dueDate : null,
                })),
            });
            void message.success(t('milestones.saved'));
            onSaved?.();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const columns: ColumnsType<Row> = [
        { key: 'no', title: t('milestones.no'), width: 56, render: (_, __, i) => i + 1 },
        {
            key: 'label', title: t('milestones.label'), width: 260,
            render: (_, r) => (
                <div className="flex flex-col gap-1">
                    <Input value={r.labelTh} disabled={disabled} maxLength={200} placeholder={t('milestones.labelTh')} onChange={e => update(r.key, { labelTh: e.target.value })} />
                    <Input value={r.labelEn} disabled={disabled} maxLength={200} placeholder={t('milestones.labelEn')} onChange={e => update(r.key, { labelEn: e.target.value })} />
                </div>
            ),
        },
        {
            key: 'trigger', title: t('milestones.trigger'), width: 230,
            render: (_, r) => (
                <div className="flex flex-col gap-1">
                    <Select<ContractMilestoneInput['trigger']> value={r.trigger} disabled={disabled} onChange={v => update(r.key, { trigger: v })}
                        options={CONTRACT_MILESTONE_TRIGGERS.map(v => ({ value: v, label: te(`milestoneTrigger.${v}`) }))} />
                    {r.trigger === 'progress' && (
                        <PercentInput value={r.triggerProgress} allowEmpty max={100} disabled={disabled} className="!w-full" aria-label={t('milestones.triggerProgress')}
                            onChange={v => update(r.key, { triggerProgress: v })} />
                    )}
                    {r.trigger === 'date' && (
                        <Input type="date" value={r.dueDate ?? ''} disabled={disabled} onChange={e => update(r.key, { dueDate: e.target.value === '' ? null : e.target.value })} />
                    )}
                </div>
            ),
        },
        {
            key: 'pct', title: t('milestones.pct'), width: 110,
            render: (_, r) => <PercentInput value={r.pct} max={100} disabled={disabled} className="!w-[96px]" onChange={v => update(r.key, { pct: v ?? 0 })} />,
        },
        { key: 'amount', title: t('milestones.amount'), width: 130, align: 'right', render: (_, __, i) => <MoneyText value={amounts[i] ?? 0} /> },
        {
            key: 'actions', title: '', width: 120,
            render: (_, r, i) => !disabled && (
                <div className="flex gap-1">
                    <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} aria-label={t('actions.up')} onClick={() => move(i, -1)} />
                    <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === rows.length - 1} aria-label={t('actions.down')} onClick={() => move(i, 1)} />
                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('actions.remove')} onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))} />
                </div>
            ),
        },
    ];

    return (
        <div className="flex flex-col gap-3">
            {advance !== undefined && (
                <div className="flex flex-wrap items-center gap-2 rounded-card border border-gray-200 bg-gray-50 px-3 py-2 text-[13px]">
                    <Tag className="!m-0">{te('milestoneKind.advance')}</Tag>
                    <span>{fmt.percent(advance.pct)}</span>
                    <MoneyText value={advance.amount} currency />
                    <span className="text-gray-500">{t('milestones.advanceNote')}</span>
                </div>
            )}
            {empty && contract.billingMode === 'milestone' && <Alert type="warning" showIcon title={t('milestones.emptyMilestone')} />}
            {empty && contract.billingMode === 'progress' && <Alert type="info" showIcon title={t('milestones.emptyProgress')} />}
            <Table<Row> size="small" rowKey="key" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />
            <div className="flex flex-wrap items-center gap-3">
                {!disabled && <Button icon={<PlusOutlined />} onClick={add}>{t('milestones.add')}</Button>}
                <span className="tabular-nums">{t('milestones.sum')} {fmt.percent(total)}</span>
                {!sumOk && <span className="text-[13px] text-red-600">{t('milestones.sumWarning', { remaining: fmt.percent(1 - total) })}</span>}
                {sumOk && !empty && <Tag color="success" className="!m-0">{t('milestones.sumOk')}</Tag>}
                <div className="flex-1" />
                {!disabled && (
                    <Button type="primary" loading={put.isPending} disabled={!sumOk || rowProblem}
                        onClick={() => { void save(); }}>
                        {onSaved !== undefined ? t('actions.saveContinue') : t('actions.save')}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function MilestonesReadOnly({ contract }: { contract: MainContractDto }) {
    const t = useTranslations('contracts');
    const te = useTranslations('enums');
    const fmt = useFormat();
    const lang = fmt.locale;
    const rows = [...contract.milestones].sort((a, b) => a.no - b.no);
    const columns: ColumnsType<(typeof rows)[number]> = [
        { key: 'no', title: t('milestones.no'), width: 56, render: (_, m) => (m.kind === 'advance' ? '-' : m.no) },
        { key: 'label', title: t('milestones.label'), render: (_, m) => (lang === 'en' && m.labelEn !== '' ? m.labelEn : m.labelTh) },
        {
            key: 'trigger', title: t('milestones.trigger'),
            render: (_, m) => (
                <span>
                    {te(`milestoneTrigger.${m.trigger}`)}
                    {m.trigger === 'progress' && m.triggerProgress !== null ? ` ${fmt.percent(m.triggerProgress)}` : ''}
                    {m.trigger === 'date' && m.dueDate !== null ? ` ${fmt.date(m.dueDate)}` : ''}
                </span>
            ),
        },
        { key: 'pct', title: t('milestones.pct'), align: 'right', render: (_, m) => (m.source === 'variation' ? '-' : fmt.percent(m.pct)) },
        { key: 'amount', title: t('milestones.amount'), align: 'right', render: (_, m) => <MoneyText value={m.amount} /> },
        { key: 'status', title: t('milestones.status'), render: (_, m) => <StatusTag enumName="milestoneStatus" value={m.status} tones={{ claimable: 'warning', claimed: 'processing', invoiced: 'processing' }} /> },
    ];
    return <Table size="small" rowKey="id" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />;
}
