'use client';

// ─── Problems found today (the report form) and the open problems of the whole project (resolve them) ───
import Link from 'next/link';
import { App, Button, Input, Select } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { SITE_ISSUE_KINDS, SITE_ISSUE_SEVERITIES, type SiteIssueDto, type SiteIssueKind, type SiteIssueSeverity } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { StatusTag, type StatusTone } from '../shared/StatusTag';
import { type IssueRow, diaryHref, nextKey } from './form';
import { usePatchSiteIssue } from './hooks';

export const SEVERITY_TONES: Partial<Record<string, StatusTone>> = { low: 'default', medium: 'warning', high: 'error' };

export function IssuesPanel({ rows, disabled, onChange }: {
    rows: readonly IssueRow[];
    disabled: boolean;
    onChange: (rows: IssueRow[]) => void;
}) {
    const t = useTranslations('siteDiary.issuesForm');
    const tk = useTranslations('enums.siteIssueKind');
    const ts = useTranslations('enums.siteIssueSeverity');
    const set = (key: string, patch: Partial<IssueRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));
    return (
        <div className="flex flex-col gap-3">
            {rows.length === 0 && <div className="text-[13px] text-gray-500">{t('empty')}</div>}
            {rows.map(r => (
                <div key={r.key} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 sm:grid-cols-6">
                    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('kind')}
                        <Select<SiteIssueKind> value={r.kind} disabled={disabled} options={SITE_ISSUE_KINDS.map(k => ({ value: k, label: tk(k) }))}
                            onChange={v => set(r.key, { kind: v })} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('severity')}
                        <Select<SiteIssueSeverity> value={r.severity} disabled={disabled} options={SITE_ISSUE_SEVERITIES.map(k => ({ value: k, label: ts(k) }))}
                            onChange={v => set(r.key, { severity: v })} />
                    </label>
                    <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-2">
                        {r.status === 'resolved' ? <StatusTag enumName="siteIssueStatus" value="resolved" /> : <span />}
                        <Button danger type="text" icon={<DeleteOutlined />} disabled={disabled} aria-label={t('remove')}
                            onClick={() => onChange(rows.filter(x => x.key !== r.key))}>{t('remove')}</Button>
                    </div>
                    <label className="col-span-2 flex min-w-0 flex-col gap-1 text-[13px] text-gray-600 sm:col-span-6">
                        {t('description')}
                        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} maxLength={2000} value={r.description} disabled={disabled}
                            onChange={e => set(r.key, { description: e.target.value })} />
                    </label>
                </div>
            ))}
            <div>
                <Button icon={<PlusOutlined />} disabled={disabled}
                    onClick={() => onChange([...rows, { key: nextKey(), id: undefined, kind: 'other', severity: 'medium', description: '', status: 'open' }])}>
                    {t('add')}
                </Button>
            </div>
        </div>
    );
}

/** Open problems across days: resolve with one tap. */
export function OpenIssuesList({ projectId, issues, canResolve }: { projectId: string; issues: readonly SiteIssueDto[]; canResolve: boolean }) {
    const t = useTranslations('siteDiary.issues');
    const tk = useTranslations('enums.siteIssueKind');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchSiteIssue(projectId);
    if (issues.length === 0) return <div className="text-[13px] text-gray-500">{t('empty')}</div>;
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {issues.map(i => (
                <li key={i.id} className="flex min-w-0 flex-col gap-2 rounded-lg border border-gray-200 p-3 sm:flex-row sm:items-start">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <StatusTag enumName="siteIssueSeverity" value={i.severity} tones={SEVERITY_TONES} />
                            <span className="font-medium">{tk(i.kind)}</span>
                            <Link href={diaryHref(projectId, i.reportDate)}><DateText value={i.reportDate} /></Link>
                        </div>
                        <div className="whitespace-pre-wrap break-words text-[14px]">{i.description}</div>
                    </div>
                    {canResolve && (
                        <Button loading={patch.isPending && patch.variables.issueId === i.id}
                            onClick={() => {
                                patch.mutateAsync({ issueId: i.id, body: { status: 'resolved' } })
                                    .then(() => { void message.success(t('resolved')); })
                                    .catch((e: unknown) => { void message.error(toText(e)); });
                            }}>
                            {t('resolve')}
                        </Button>
                    )}
                </li>
            ))}
        </ul>
    );
}
