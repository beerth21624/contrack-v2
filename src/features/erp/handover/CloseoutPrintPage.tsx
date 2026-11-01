'use client';

// ─── /print/closeout/[projectId]: the closeout summary on paper (internal report, in the UI language) ───
import { useMemo } from 'react';
import { Alert, Skeleton } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import type { CloseoutDto, DocLanguage } from '@/shared/contract';
import { documentTranslator } from '@/i18n/document-translator';
import { formatMoney, formatPercent } from '@/i18n/format';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow } from '../billing/DocParts';
import { useCompanyProfile } from '../company/hooks';
import { useHubProject } from '../hub/hooks';
import { companyFromProfile, type PrintCompany } from '../quotations/print-model';
import { PrintFrame } from '../shared/PrintFrame';
import { useSectionTitles } from './CloseoutPanel';
import { useCloseout } from './hooks';

function CloseoutDocument({ dto, company, projectName, titles, lang }: {
    dto: CloseoutDto; company: PrintCompany; projectName: string; titles: ReadonlyMap<number, string>; lang: DocLanguage;
}) {
    const t = useMemo(() => documentTranslator(lang), [lang]);
    const s = dto.summary;
    const m = (v: number | null): string => (v === null ? '–' : formatMoney(v, lang));
    const pct = (v: number | null): string => (v === null ? '–' : formatPercent(v, lang, 1));
    const sectionLabel = (no: number | null): string => {
        if (no === null) return t('closeout.unassigned');
        const title = titles.get(no);
        return `${String(no)}${title !== undefined && title !== '' ? ` ${title}` : ''}`;
    };
    const fin: [string, string][] = [
        [t('closeout.revenue'), m(s.revenue)],
        [t('closeout.originalValue'), m(s.originalValue)],
        [t('closeout.estimate'), m(s.totals.estimate)],
        [t('closeout.budget'), m(s.totals.budget)],
        [t('closeout.actual'), m(s.totals.actual.total)],
        [t('closeout.profit'), m(s.profit)],
        [t('closeout.margin'), pct(s.marginPct)],
        ...(s.quotedMarginPct !== null ? [[t('closeout.quotedMargin'), pct(s.quotedMarginPct)] as [string, string]] : []),
        ...(s.billing !== null ? [
            [t('closeout.billed'), m(s.billing.billed)],
            [t('closeout.received'), m(s.billing.received)],
            [t('closeout.outstanding'), m(s.billing.outstanding)],
            [t('closeout.retentionHeld'), m(s.billing.retentionHeld)],
        ] as [string, string][] : []),
    ];
    const other = (a: CloseoutDto['summary']['totals']['actual']): number => a.equipment + a.other;
    return (
        <div className="bpd" lang={lang} style={brandVars(company.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead company={company} title={t('closeout.title')} t={t} rows={(
                <>
                    <MetaRow label={t('closeout.project')}>{projectName}</MetaRow>
                    <MetaRow label={t('closeout.asOf')}>{dateText(dto.asOf, lang, company.yearStyle)}</MetaRow>
                    <MetaRow label={t('closeout.status')}>{dto.status === 'final' ? t('closeout.final') : t('closeout.draft')}</MetaRow>
                </>
            )} />
            <div className="bpd-h">{t('closeout.financial')}</div>
            <table className="bpd-grid">
                <tbody>
                    {fin.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v}</td></tr>)}
                </tbody>
            </table>
            <div className="bpd-h">{t('closeout.sections')}</div>
            <div className="bpd-scroll">
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th>{t('closeout.section')}</th>
                            <th>{t('closeout.estimate')}</th>
                            <th>{t('closeout.budget')}</th>
                            <th>{t('closeout.material')}</th>
                            <th>{t('closeout.labour')}</th>
                            <th>{t('closeout.subcontract')}</th>
                            <th>{t('closeout.otherCost')}</th>
                            <th>{t('closeout.actual')}</th>
                            <th>{t('closeout.variance')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {s.sections.map(r => (
                            <tr key={r.sectionNo ?? 'u'}>
                                <td>{sectionLabel(r.sectionNo)}</td>
                                <td className="num">{m(r.estimate)}</td>
                                <td className="num">{m(r.budget)}</td>
                                <td className="num">{m(r.actual.material)}</td>
                                <td className="num">{m(r.actual.labour)}</td>
                                <td className="num">{m(r.actual.subcontract)}</td>
                                <td className="num">{m(other(r.actual))}</td>
                                <td className="num">{m(r.actual.total)}</td>
                                <td className="num">{m(r.variance)}</td>
                            </tr>
                        ))}
                        <tr className="bpd-strong">
                            <td>{t('closeout.total')}</td>
                            <td className="num">{m(s.totals.estimate)}</td>
                            <td className="num">{m(s.totals.budget)}</td>
                            <td className="num">{m(s.totals.actual.material)}</td>
                            <td className="num">{m(s.totals.actual.labour)}</td>
                            <td className="num">{m(s.totals.actual.subcontract)}</td>
                            <td className="num">{m(other(s.totals.actual))}</td>
                            <td className="num">{m(s.totals.actual.total)}</td>
                            <td className="num">{m(s.totals.variance)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {dto.lessons.trim() !== '' && (
                <>
                    <div className="bpd-h">{t('closeout.lessons')}</div>
                    <div className="bpd-box bpd-pre">{dto.lessons}</div>
                </>
            )}
            <div className="bpd-sign">
                {(['preparedBy', 'approvedBy'] as const).map(k => (
                    <div key={k}>
                        <div className="bpd-line" />
                        <div>{t(`closeout.${k}`)}</div>
                        <div>{t('common.date')} ______ / ______ / ______</div>
                    </div>
                ))}
            </div>
            <Footer text={company.footer} />
        </div>
    );
}

export function CloseoutPrintPage({ projectId }: { projectId: string }) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const lang: DocLanguage = useLocale() === 'en' ? 'en' : 'th';
    const q = useCloseout(projectId);
    const hub = useHubProject(projectId);
    const company = useCompanyProfile(hub.data?.project.workspaceId);
    const titles = useSectionTitles(projectId);
    const err: unknown = q.error ?? hub.error ?? company.error;
    if (err !== null && err !== undefined) {
        return <div className="p-4"><Alert type="error" showIcon title={t('closeout.print.notFound')} description={toText(err)} /></div>;
    }
    if (q.data === undefined || hub.data === undefined || company.data === undefined) return <div className="p-6"><Skeleton active /></div>;
    return (
        <PrintFrame language={lang} watermark={q.data.status === 'final' ? null : 'draft'} title={`${t('closeout.title')} ${hub.data.project.name}`} ready>
            <CloseoutDocument dto={q.data} company={companyFromProfile(company.data, lang)} projectName={hub.data.project.name} titles={titles} lang={lang} />
        </PrintFrame>
    );
}
