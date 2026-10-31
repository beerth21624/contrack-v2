'use client';

// ─── One day's site report: weather, people, work done (%), photos, problems — save as a draft, then submit ───
// Submitting sets the cost codes' reported progress; a submitted report is edited by reopening it first.
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, Skeleton } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useCrews } from '@/features/cloud/api/workforce';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { IssuesPanel } from './IssuesPanel';
import { ManpowerTable } from './ManpowerTable';
import { PhotoGrid } from './PhotoGrid';
import { WeatherPicker } from './WeatherPicker';
import { WorkItemsTable } from './WorkItemsTable';
import { type DiaryForm, addDays, bangkokToday, diaryHref, formFromReport, isBusinessDate, requestFromForm } from './form';
import { useReopenSiteReport, useSaveSiteReport, useSiteReport, useSubmitSiteReport } from './hooks';

export function DailyReportPage({ projectId, date }: { projectId: string; date: string }) {
    const t = useTranslations('siteDiary');
    const toText = useErrorMessage();
    const router = useRouter();
    const { message, modal } = App.useApp();
    const ws = useErpWorkspace();
    const today = bangkokToday();
    const valid = isBusinessDate(date) && date <= today;
    const report = useSiteReport(projectId, valid ? date : undefined);
    const crews = useCrews(ws.workspaceId);
    const save = useSaveSiteReport(projectId, date);
    const submit = useSubmitSiteReport(projectId, date);
    const reopen = useReopenSiteReport(projectId, date);
    // `local` is the copy being edited; until the first edit (or save) the form shows the server's report.
    const [local, setLocal] = useState<DiaryForm | null>(null);
    const [dirty, setDirty] = useState(false);
    const fromServer = useMemo(() => (report.data === undefined ? null : formFromReport(report.data)), [report.data]);
    const form = local ?? fromServer;
    const setForm = (f: DiaryForm) => setLocal(f);

    const crumbs = [{ label: t('title'), href: diaryHref(projectId) }, { label: <DateText value={date} style="long" /> }];

    if (!valid) {
        return (
            <ErpPage title={t('report.title')} breadcrumb={crumbs}>
                <Alert type="warning" showIcon title={t('report.future')} action={<Button onClick={() => router.push(diaryHref(projectId, today))}>{t('today')}</Button>} />
            </ErpPage>
        );
    }
    if (report.isError) {
        return (
            <ErpPage title={t('report.title')} breadcrumb={crumbs}>
                <Alert type="error" showIcon title={toText(report.error)} action={<Button onClick={() => { void report.refetch(); }}>{t('retry')}</Button>} />
            </ErpPage>
        );
    }
    if (report.data === undefined || form === null) {
        return <ErpPage breadcrumb={crumbs}><Skeleton active /></ErpPage>;
    }

    const dto = report.data;
    const editable = dto.canEdit;
    const busy = save.isPending || submit.isPending || reopen.isPending;
    const patch = (p: Partial<DiaryForm>) => {
        setLocal({ ...form, ...p });
        setDirty(true);
    };

    const saveDraft = async (): Promise<boolean> => {
        try {
            const saved = await save.mutateAsync(requestFromForm(form));
            setForm(formFromReport(saved));
            setDirty(false);
            return true;
        } catch (e) {
            void message.error(toText(e));
            return false;
        }
    };

    const onSave = async () => {
        if (await saveDraft()) void message.success(t('report.saved'));
    };

    const doSubmit = async () => {
        if (!(await saveDraft())) return;
        try {
            const done = await submit.mutateAsync();
            setForm(formFromReport(done));
            setDirty(false);
            void message.success(t('report.submitted'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const onSubmit = () => {
        modal.confirm({
            title: t('report.submitConfirm'),
            content: t('report.submitHint'),
            okText: t('report.submit'),
            cancelText: t('cancel'),
            onOk: doSubmit,
        });
    };

    const onReopen = () => {
        modal.confirm({
            title: t('report.reopenConfirm'),
            content: t('report.reopenHint'),
            okText: t('report.reopen'),
            cancelText: t('cancel'),
            onOk: async () => {
                try {
                    const r = await reopen.mutateAsync();
                    setForm(formFromReport(r));
                    setDirty(false);
                    void message.success(t('report.reopened'));
                } catch (e) {
                    void message.error(toText(e));
                }
            },
        });
    };

    const actions = (
        <div className="flex flex-wrap gap-2">
            {editable && <Button loading={save.isPending} disabled={busy} onClick={() => { void onSave(); }}>{t('report.saveDraft')}</Button>}
            {editable && <Button type="primary" loading={submit.isPending} disabled={busy} onClick={onSubmit}>{t('report.submit')}</Button>}
            {dto.canReopen && <Button loading={reopen.isPending} disabled={busy} onClick={onReopen}>{t('report.reopen')}</Button>}
        </div>
    );

    const activeCrews = (crews.data ?? []).filter(c => c.archivedAt === null);

    return (
        <ErpPage
            title={<span className="flex flex-wrap items-center gap-2"><DateText value={date} style="long" /><StatusTag enumName="siteReportStatus" value={dto.status} /></span>}
            subtitle={t('report.subtitle')}
            breadcrumb={crumbs}
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <Button icon={<LeftOutlined />} aria-label={t('report.prev')} onClick={() => router.push(diaryHref(projectId, addDays(date, -1)))} />
                    <Button icon={<RightOutlined />} aria-label={t('report.next')} disabled={date >= today} onClick={() => router.push(diaryHref(projectId, addDays(date, 1)))} />
                </div>
            )}
        >
            {!editable && dto.status === 'submitted' && <Alert type="info" showIcon title={t('report.locked')} />}
            {!editable && dto.status === 'draft' && <Alert type="info" showIcon title={t('report.notAllowed')} />}
            {dirty && editable && <Alert type="warning" showIcon title={t('report.unsaved')} />}

            <SectionCard title={t('weather.title')}>
                <WeatherPicker morning={form.weatherMorning} afternoon={form.weatherAfternoon} rainHours={form.rainHours} disabled={!editable} onChange={patch} />
            </SectionCard>
            <SectionCard title={t('summary.title')}>
                <Input.TextArea autoSize={{ minRows: 3, maxRows: 10 }} maxLength={5000} value={form.summary} disabled={!editable} placeholder={t('summary.placeholder')}
                    onChange={e => patch({ summary: e.target.value })} />
            </SectionCard>
            <SectionCard title={t('manpower.title')}>
                <ManpowerTable projectId={projectId} rows={form.manpower} crews={activeCrews} disabled={!editable} onChange={manpower => patch({ manpower })} />
            </SectionCard>
            <SectionCard title={t('work.title')}>
                <WorkItemsTable projectId={projectId} rows={form.workItems} disabled={!editable} onChange={workItems => patch({ workItems })} />
            </SectionCard>
            <SectionCard title={t('photos.title')}>
                <PhotoGrid rows={form.photos} workspaceId={ws.workspaceId} disabled={!editable} onChange={photos => patch({ photos })} />
            </SectionCard>
            <SectionCard title={t('issuesForm.title')}>
                <IssuesPanel rows={form.issues} disabled={!editable} onChange={issues => patch({ issues })} />
            </SectionCard>

            <div className="sticky bottom-0 z-10 -mx-1 border-t border-gray-200 bg-white/95 px-1 py-3 backdrop-blur">{actions}</div>
        </ErpPage>
    );
}
