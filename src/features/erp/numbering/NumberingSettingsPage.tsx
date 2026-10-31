'use client';

// ─── Document numbering settings: per document type, prefix / pattern / reset / year style and the next number ───
import { useMemo, useState } from 'react';
import { Alert, App, Button, Input, Modal, Result, Select, Skeleton, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    NUMBER_PATTERN_TOKENS, NUMBER_RESETS, type NumberReset, type NumberingSeriesDto, YEAR_STYLES, type YearStyle, can,
} from '@/shared/contract';
import { bangkokToday } from '@/domain/dates/business-date';
import { formatDocNumber, validatePattern } from '@/domain/erp/numbering';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { AuditTimeline } from '../shared/AuditTimeline';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useNumberingSeries, usePutNumberingSeries } from './hooks';

export function NumberingSettingsPage() {
    const t = useTranslations('numbering');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const mayEdit = can(ws.role, 'company.manage');
    const wsId = ws.workspaceId;
    const q = useNumberingSeries(wsId);
    const [editing, setEditing] = useState<NumberingSeriesDto | null>(null);

    const columns: ColumnsType<NumberingSeriesDto> = [
        {
            title: t('columns.docType'),
            key: 'docType',
            render: (_, s) => (
                <span className="flex flex-wrap items-center gap-2">
                    {tEnums(`docType.${s.docType}`)}
                    {s.isDefault && <Tag className="!m-0">{t('isDefault')}</Tag>}
                </span>
            ),
        },
        { title: t('columns.prefix'), dataIndex: 'prefix', key: 'prefix', render: (v: string) => <span className="font-mono">{v}</span> },
        { title: t('columns.pattern'), dataIndex: 'pattern', key: 'pattern', render: (v: string) => <span className="font-mono">{v}</span> },
        { title: t('columns.reset'), key: 'reset', render: (_, s) => t(`reset.${s.reset}`) },
        { title: t('columns.yearStyle'), key: 'yearStyle', render: (_, s) => t(`yearStyle.${s.yearStyle}`) },
        { title: t('columns.next'), key: 'next', render: (_, s) => <DocumentNumberTag number={s.nextNumber} /> },
        {
            title: t('columns.issued'),
            key: 'issued',
            align: 'right',
            render: (_, s) => (
                <Tooltip title={t('periodHint', { period: s.periodKey })}>
                    <span className="tabular-nums">{s.issuedInPeriod}</span>
                </Tooltip>
            ),
        },
        ...(mayEdit ? [{
            title: '',
            key: 'actions',
            align: 'right' as const,
            render: (_: unknown, s: NumberingSeriesDto) => (s.issuedInPeriod > 0 ? (
                <Tooltip title={t('lockedHint')}>
                    <Tag icon={<LockOutlined />} className="!m-0">{t('locked')}</Tag>
                </Tooltip>
            ) : (
                <Button size="small" onClick={() => setEditing(s)}>{t('edit')}</Button>
            )),
        }] : []),
    ];

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')}>
            {q.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)}
                    extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : q.data === undefined || wsId === undefined ? (
                <Skeleton active />
            ) : (
                <div className="flex flex-col gap-4">
                    {!mayEdit && <div className="text-gray-600">{t('readOnly')}</div>}
                    <SectionCard title={t('series')}>
                        <div className="text-secondary text-gray-500 mb-3">{t('previewHint')}</div>
                        <Table<NumberingSeriesDto>
                            rowKey="docType"
                            size="small"
                            columns={columns}
                            dataSource={q.data}
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                        />
                    </SectionCard>
                </div>
            )}
            {editing !== null && wsId !== undefined && (
                <EditSeriesModal key={editing.docType} workspaceId={wsId} series={editing} onClose={() => setEditing(null)} />
            )}
            <AuditTimeline entityType="numbering_series" title={t('history')} />
        </ErpPage>
    );
}

function EditSeriesModal({ workspaceId, series, onClose }: { workspaceId: string; series: NumberingSeriesDto; onClose: () => void }) {
    const t = useTranslations('numbering');
    const tEnums = useTranslations('enums');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const put = usePutNumberingSeries(workspaceId);
    const [prefix, setPrefix] = useState(series.prefix);
    const [pattern, setPattern] = useState(series.pattern);
    const [reset, setReset] = useState<NumberReset>(series.reset);
    const [yearStyle, setYearStyle] = useState<YearStyle>(series.yearStyle);

    const problems = useMemo(() => validatePattern(pattern.trim(), reset), [pattern, reset]);
    const prefixOk = /^[A-Za-z0-9._/-]{0,12}$/.test(prefix.trim());
    const sample = problems.length === 0
        ? formatDocNumber(pattern.trim(), { prefix: prefix.trim(), issueDate: bangkokToday(new Date()), yearStyle, seq: 1 })
        : null;

    const save = async () => {
        try {
            await put.mutateAsync({ docType: series.docType, body: { prefix: prefix.trim(), pattern: pattern.trim(), reset, yearStyle } });
            void message.success(t('messages.saved'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal
            open
            title={t('editTitle', { docType: tEnums(`docType.${series.docType}`) })}
            okText={t('save')}
            cancelText={t('cancel')}
            onOk={() => void save()}
            onCancel={onClose}
            okButtonProps={{ disabled: problems.length > 0 || !prefixOk, loading: put.isPending }}
        >
            <div className="flex flex-col gap-4">
                <div>
                    <div className="mb-1 text-gray-700">{t('columns.prefix')}</div>
                    <Input value={prefix} onChange={e => setPrefix(e.target.value)} maxLength={12} status={prefixOk ? undefined : 'error'}
                        aria-label={t('columns.prefix')} />
                    <div className="text-secondary text-gray-500 mt-1">{t('prefixHint')}</div>
                </div>
                <div>
                    <div className="mb-1 text-gray-700">{t('columns.pattern')}</div>
                    <Input value={pattern} onChange={e => setPattern(e.target.value)} maxLength={64} className="font-mono"
                        status={problems.length > 0 ? 'error' : undefined} aria-label={t('columns.pattern')} />
                    <div className="mt-2 flex flex-wrap gap-1">
                        {NUMBER_PATTERN_TOKENS.map(token => (
                            <Tag key={token} className="!m-0 cursor-pointer font-mono" onClick={() => setPattern(p => `${p}${token}`)}>{token}</Tag>
                        ))}
                    </div>
                    <div className="text-secondary text-gray-500 mt-1">{t('patternHint')}</div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <div className="mb-1 text-gray-700">{t('columns.reset')}</div>
                        <Select<NumberReset> value={reset} onChange={setReset} className="w-full" aria-label={t('columns.reset')}
                            options={NUMBER_RESETS.map(r => ({ value: r, label: t(`reset.${r}`) }))} />
                    </div>
                    <div>
                        <div className="mb-1 text-gray-700">{t('columns.yearStyle')}</div>
                        <Select<YearStyle> value={yearStyle} onChange={setYearStyle} className="w-full" aria-label={t('columns.yearStyle')}
                            options={YEAR_STYLES.map(y => ({ value: y, label: t(`yearStyle.${y}`) }))} />
                    </div>
                </div>
                {problems.length > 0 ? (
                    <Alert type="error" showIcon title={t('invalid')}
                        description={<ul className="m-0 pl-4">{problems.map(p => <li key={p}>{t(`problems.${p}`)}</li>)}</ul>} />
                ) : (
                    <Alert type="info" showIcon title={t('sample')} description={<DocumentNumberTag number={sample} />} />
                )}
            </div>
        </Modal>
    );
}
