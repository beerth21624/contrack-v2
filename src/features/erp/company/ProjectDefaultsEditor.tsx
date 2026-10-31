'use client';

// ─── Table of the commercial defaults per project type: built-in values, editable overrides, milestone templates ───
import { useState } from 'react';
import { Button, Input, InputNumber, Modal, Select, Switch, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    BILLING_MODES, DETAIL_LEVELS, DOC_LANGUAGES, MILESTONE_TRIGGERS, PRICE_SOURCES, PROJECT_TYPES, QUOTATION_FORMATS,
    type CompanyDefaults, type MilestoneTemplateItem, type ProjectCommercialSettings, type ProjectSettingsOverride, type ProjectType,
} from '@/shared/contract';
import { PROJECT_TYPE_DEFAULTS, resolveSettings } from '@/domain/erp/profiles';

type Key = keyof ProjectCommercialSettings;

/** Fractions edited as percent; the rounding keeps 0.001 and 0.125 exact. */
const PERCENT_KEYS: readonly Key[] = ['advancePct', 'retentionPct', 'customerWhtRate', 'penaltyRatePerDay', 'guaranteePct'];
const toFraction = (percent: number): number => Math.round(percent * 1e4) / 1e6;
const toPercent = (fraction: number): number => Math.round(fraction * 1e6) / 1e4;

const ROWS: readonly Key[] = [
    'priceSource', 'quotationFormat', 'detailLevel', 'billingMode', 'milestoneTemplate', 'advancePct', 'retentionPct', 'customerWhtRate',
    'escalation', 'penaltyRatePerDay', 'guaranteePct', 'warrantyMonths', 'paymentTermDays', 'documentLanguage',
];

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function ProjectDefaultsEditor({ value, onChange, disabled = false }: {
    value: CompanyDefaults;
    onChange: (next: CompanyDefaults) => void;
    disabled?: boolean;
}) {
    const t = useTranslations('company');
    const tEnums = useTranslations('enums');
    const [editingTemplate, setEditingTemplate] = useState<ProjectType | null>(null);

    /** Set one field of a type; a value equal to the built-in one removes the override. */
    const setField = <K extends Key>(type: ProjectType, key: K, v: ProjectCommercialSettings[K]) => {
        const next = Object.fromEntries(Object.entries(value[type] ?? {}).filter(([k]) => k !== key)) as ProjectSettingsOverride;
        if (!sameValue(v, PROJECT_TYPE_DEFAULTS[type][key])) (next as Record<string, unknown>)[key] = v;
        const rest = Object.fromEntries(Object.entries(value).filter(([k]) => k !== type)) as CompanyDefaults;
        onChange(Object.keys(next).length === 0 ? rest : { ...rest, [type]: next });
    };
    const resetColumn = (type: ProjectType) => {
        onChange(Object.fromEntries(Object.entries(value).filter(([k]) => k !== type)) as CompanyDefaults);
    };

    const cell = (type: ProjectType, key: Key) => {
        const eff = resolveSettings(type, value, {});
        const custom = value[type]?.[key] !== undefined;
        let control: React.ReactNode;
        if (key === 'priceSource') {
            control = <Select size="small" disabled={disabled} className="w-full min-w-36" value={eff.priceSource} onChange={v => setField(type, key, v)}
                options={PRICE_SOURCES.map(v => ({ value: v, label: tEnums(`priceSource.${v}`) }))} />;
        } else if (key === 'quotationFormat') {
            control = <Select size="small" disabled={disabled} className="w-full min-w-36" value={eff.quotationFormat} onChange={v => setField(type, key, v)}
                options={QUOTATION_FORMATS.map(v => ({ value: v, label: tEnums(`quotationFormat.${v}`) }))} />;
        } else if (key === 'detailLevel') {
            control = <Select size="small" disabled={disabled} className="w-full min-w-36" value={eff.detailLevel} onChange={v => setField(type, key, v)}
                options={DETAIL_LEVELS.map(v => ({ value: v, label: tEnums(`detailLevel.${v}`) }))} />;
        } else if (key === 'billingMode') {
            control = <Select size="small" disabled={disabled} className="w-full min-w-36" value={eff.billingMode} onChange={v => setField(type, key, v)}
                options={BILLING_MODES.map(v => ({ value: v, label: tEnums(`billingMode.${v}`) }))} />;
        } else if (key === 'documentLanguage') {
            control = <Select size="small" disabled={disabled} className="w-full min-w-24" value={eff.documentLanguage} onChange={v => setField(type, key, v)}
                options={DOC_LANGUAGES.map(v => ({ value: v, label: t(`languages.${v}`) }))} />;
        } else if (key === 'escalation') {
            control = <Switch size="small" disabled={disabled} checked={eff.escalation} onChange={v => setField(type, key, v)} />;
        } else if (key === 'milestoneTemplate') {
            control = (
                <span className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                        {eff.milestoneTemplate.length === 0 ? t('milestones.none') : t('milestones.summary', { count: eff.milestoneTemplate.length })}
                    </span>
                    <Button size="small" onClick={() => setEditingTemplate(type)}>{t('milestones.edit')}</Button>
                </span>
            );
        } else if (PERCENT_KEYS.includes(key)) {
            control = <InputNumber size="small" disabled={disabled} className="w-28" min={0} max={100} step={0.5} precision={4} controls={false}
                value={toPercent(eff[key])}
                onChange={v => { if (typeof v === 'number') setField(type, key, toFraction(v) as never); }} />;
        } else {
            control = <InputNumber size="small" disabled={disabled} className="w-28" min={0} max={key === 'warrantyMonths' ? 240 : 365} step={1} precision={0}
                value={eff[key]}
                onChange={v => { if (typeof v === 'number') setField(type, key, v as never); }} />;
        }
        return (
            <span className="flex items-center gap-2">
                {control}
                {custom && key !== 'milestoneTemplate' && !disabled && (
                    <Tooltip title={t('defaults.resetCell')}>
                        <Button size="small" type="text" icon={<UndoOutlined />} aria-label={t('defaults.resetCell')} onClick={() => setField(type, key, PROJECT_TYPE_DEFAULTS[type][key] as never)} />
                    </Tooltip>
                )}
                {custom && <Tag color="orange" className="!m-0">{t('defaults.custom')}</Tag>}
            </span>
        );
    };

    const columns: ColumnsType<{ key: Key }> = [
        { title: t('defaults.field'), key: 'field', fixed: 'left', width: 200, render: (_, r) => t(`defaults.${r.key}`) },
        ...PROJECT_TYPES.map(type => ({
            title: (
                <span className="flex items-center justify-between gap-2">
                    {tEnums(`projectType.${type}`)}
                    {value[type] !== undefined && !disabled && (
                        <Button size="small" type="link" onClick={() => resetColumn(type)}>{t('defaults.resetColumn')}</Button>
                    )}
                </span>
            ),
            key: type,
            width: 230,
            render: (_: unknown, r: { key: Key }) => cell(type, r.key),
        })),
    ];

    return (
        <div className="flex flex-col gap-3">
            <p className="m-0 text-gray-500">{t('defaults.hint')}</p>
            <Table size="small" pagination={false} rowKey="key" dataSource={ROWS.map(key => ({ key }))} columns={columns} scroll={{ x: 'max-content' }} />
            {editingTemplate !== null && (
                <MilestoneTemplateModal
                    type={editingTemplate}
                    initial={resolveSettings(editingTemplate, value, {}).milestoneTemplate}
                    onCancel={() => setEditingTemplate(null)}
                    onOk={template => { setField(editingTemplate, 'milestoneTemplate', template); setEditingTemplate(null); }}
                />
            )}
        </div>
    );
}

function MilestoneTemplateModal({ type, initial, onOk, onCancel }: {
    type: ProjectType;
    initial: readonly MilestoneTemplateItem[];
    onOk: (template: MilestoneTemplateItem[]) => void;
    onCancel: () => void;
}) {
    const t = useTranslations('company');
    const tEnums = useTranslations('enums');
    const [items, setItems] = useState<MilestoneTemplateItem[]>(() => initial.map(m => ({ ...m })));
    const sum = Math.round(items.reduce((s, m) => s + m.pct, 0) * 1e6) / 1e4;
    const sumOk = items.length === 0 || Math.abs(sum - 100) < 0.01;
    const labelsOk = items.every(m => m.labelTh.trim() !== '' && m.labelEn.trim() !== '' && m.pct > 0);

    const patch = (i: number, p: Partial<MilestoneTemplateItem>) => setItems(list => list.map((m, j) => (j === i ? { ...m, ...p } : m)));

    return (
        <Modal open width={880} title={t('milestones.title', { type: tEnums(`projectType.${type}`) })} onCancel={onCancel}
            okText={t('milestones.ok')} cancelText={t('milestones.cancel')} okButtonProps={{ disabled: !sumOk || !labelsOk }}
            onOk={() => onOk(items.map(m => {
                const { progressAt, ...rest } = m;
                return m.trigger === 'progress' && progressAt !== undefined ? { ...rest, progressAt } : rest;
            }))}>
            <div className="flex flex-col gap-2">
                {items.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 items-center gap-2">
                        <Input className="col-span-3" aria-label={t('milestones.labelTh')} placeholder={t('milestones.labelTh')}
                            value={m.labelTh} onChange={e => patch(i, { labelTh: e.target.value })} maxLength={120} />
                        <Input className="col-span-3" aria-label={t('milestones.labelEn')} placeholder={t('milestones.labelEn')}
                            value={m.labelEn} onChange={e => patch(i, { labelEn: e.target.value })} maxLength={120} />
                        <InputNumber className="col-span-2" aria-label={t('milestones.pct')} min={0} max={100} step={0.5} precision={2} controls={false}
                            value={toPercent(m.pct)} onChange={v => patch(i, { pct: typeof v === 'number' ? toFraction(v) : 0 })} />
                        <Select className="col-span-2" aria-label={t('milestones.trigger')} value={m.trigger}
                            onChange={v => patch(i, { trigger: v, ...(v === 'progress' ? { progressAt: m.progressAt ?? 0.5 } : {}) })}
                            options={MILESTONE_TRIGGERS.map(v => ({ value: v, label: tEnums(`milestoneTrigger.${v}`) }))} />
                        {m.trigger === 'progress' ? (
                            <InputNumber className="col-span-1" aria-label={t('milestones.progressAt')} min={0} max={100} step={0.5} precision={2} controls={false}
                                value={toPercent(m.progressAt ?? 0)} onChange={v => patch(i, { progressAt: typeof v === 'number' ? toFraction(v) : undefined })} />
                        ) : <span className="col-span-1" />}
                        <Button className="col-span-1" type="text" danger icon={<DeleteOutlined />} aria-label={t('milestones.remove')}
                            onClick={() => setItems(list => list.filter((_, j) => j !== i))} />
                    </div>
                ))}
                <div className="flex items-center justify-between">
                    <Button icon={<PlusOutlined />} onClick={() => setItems(list => [...list, { labelTh: '', labelEn: '', pct: 0.1, trigger: 'manual' }])}>
                        {t('milestones.add')}
                    </Button>
                    <span className={sumOk && labelsOk ? 'text-gray-600' : 'text-red-600'}>
                        {t('milestones.sum', { pct: sum })}{!sumOk && ` · ${t('milestones.sumInvalid')}`}{sumOk && !labelsOk && ` · ${t('milestones.labelRequired')}`}
                    </span>
                </div>
            </div>
        </Modal>
    );
}
