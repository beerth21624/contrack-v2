'use client';

// ─── The history of one entity (or the workspace) from the audit log; hidden without `audit.read` ───
// <AuditTimeline entityType="quotation" entityId={q.id} /> — newest first, "load older" pages by cursor.
import { Alert, Button, Skeleton, Timeline } from 'antd';
import { useTranslations } from 'next-intl';
import { type AuditEventDto, can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useAuditEvents } from '../approvals/hooks';
import { DateText } from './DateText';
import { EmptyState } from './EmptyState';
import { SectionCard } from './SectionCard';
import { useErpWorkspace } from './useErpWorkspace';

type AuditTranslator = ReturnType<typeof useTranslations<'audit'>>;
type AuditKey = Parameters<AuditTranslator>[0];

function show(v: unknown): string {
    if (v === null || v === undefined) return '–';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    return JSON.stringify(v);
}

/** `field: before → after` for `{field: [before, after]}`, else `field: value`. */
function changeLines(data: AuditEventDto['data'], arrow: string): string[] {
    return Object.entries(data).map(([field, v]) =>
        Array.isArray(v) && v.length === 2 ? `${field}: ${show(v[0])} ${arrow} ${show(v[1])}` : `${field}: ${show(v)}`);
}

export function AuditTimeline({ entityType, entityId, workspaceId, title, hideTitle = false }: {
    entityType?: string;
    entityId?: string;
    /** Default: the current workspace. */
    workspaceId?: string;
    title?: string;
    hideTitle?: boolean;
}) {
    const t = useTranslations('audit');
    const toText = useErrorMessage();
    const ws = useErpWorkspace(workspaceId);
    const allowed = can(ws.role, 'audit.read');
    const q = useAuditEvents(ws.workspaceId, { entityType, entityId }, allowed);
    if (!allowed) return null;

    const events = q.data?.pages.flatMap(p => p.items) ?? [];
    const label = (group: 'actions' | 'entities', value: string): string => {
        const key = `${group}.${value}` as AuditKey;
        return t.has(key) ? t(key) : value;
    };

    return (
        <SectionCard title={hideTitle ? undefined : (title ?? t('title'))}>
            {q.isLoading ? <Skeleton active paragraph={{ rows: 3 }} /> : q.isError ? (
                <Alert type="warning" showIcon title={t('loadFailed')} description={toText(q.error)}
                    action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : events.length === 0 ? <EmptyState title={t('empty')} /> : (
                <>
                    <Timeline
                        items={events.map(e => ({
                            key: e.id,
                            children: (
                                <div className="min-w-0">
                                    <div className="text-gray-900 break-words">
                                        <span className="font-medium">{label('actions', e.action)}</span>
                                        {entityType === undefined && <span className="text-gray-500"> · {label('entities', e.entityType)}</span>}
                                    </div>
                                    <div className="text-secondary text-gray-500">
                                        {e.actorName ?? t('system')} · <DateText value={e.at} style="dateTime" />
                                    </div>
                                    {Object.keys(e.data).length > 0 && (
                                        <ul className="m-0 mt-1 pl-4 text-secondary text-gray-600 break-words">
                                            {changeLines(e.data, t('arrow')).map(l => <li key={l}>{l}</li>)}
                                        </ul>
                                    )}
                                </div>
                            ),
                        }))}
                    />
                    {q.hasNextPage && (
                        <Button loading={q.isFetchingNextPage} onClick={() => { void q.fetchNextPage(); }}>{t('loadOlder')}</Button>
                    )}
                </>
            )}
        </SectionCard>
    );
}
