'use client';

// ─── The handover note on paper: parties, dates, attendees, checklist result, defects, warranty term, documents, signatures ───
import { useMemo } from 'react';
import { documentTranslator } from '@/i18n/document-translator';
import { brandVars, DOC_CSS, dateText, Footer, Letterhead, MetaRow, PartyBox, SignBlock } from '../billing/DocParts';
import type { HandoverPrintModel } from './print-model';

export function HandoverPrintDocument({ model }: { model: HandoverPrintModel }) {
    const t = useMemo(() => documentTranslator(model.language), [model.language]);
    const lang = model.language;
    const c = model.company;
    const d = (v: string): string => dateText(v, lang, c.yearStyle);
    return (
        <div className="bpd" lang={lang} style={brandVars(c.brandColor)}>
            <style>{DOC_CSS}</style>
            <Letterhead
                company={c}
                title={t('handover.title')}
                t={t}
                rows={(
                    <>
                        {model.number !== null && <MetaRow label={t('common.number')}>{model.number}</MetaRow>}
                        {model.handoverDate !== null && <MetaRow label={t('handover.handoverDate')}>{d(model.handoverDate)}</MetaRow>}
                        {model.contractNumber !== null && <MetaRow label={t('handover.contractNo')}>{model.contractNumber}</MetaRow>}
                    </>
                )}
            />
            <PartyBox
                label={t('handover.client')}
                customer={model.customer}
                t={t}
                extra={(
                    <div style={{ marginTop: model.customer !== null ? 6 : 0 }}>
                        <div><b>{t('handover.project')}</b> {model.projectName}</div>
                        {model.scheduledDate !== null && <div><b>{t('handover.scheduledDate')}</b> {d(model.scheduledDate)}</div>}
                        {model.inspectionDate !== null && <div><b>{t('handover.inspectionDate')}</b> {d(model.inspectionDate)}</div>}
                    </div>
                )}
            />
            {model.attendees.length > 0 && (
                <>
                    <div className="bpd-h">{t('handover.attendees')}</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {model.attendees.map((a, i) => <li key={`${a.name}-${String(i)}`}>{a.name}{a.role !== '' && ` (${a.role})`}</li>)}
                    </ul>
                </>
            )}
            <div className="bpd-h">{t('handover.checklist')}</div>
            <div className="bpd-scroll">
                <table className="bpd-grid">
                    <thead>
                        <tr>
                            <th style={{ width: 28 }}>#</th>
                            <th>{t('handover.item')}</th>
                            <th style={{ width: 80 }}>{t('handover.result')}</th>
                            <th style={{ width: '30%' }}>{t('handover.note')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {model.items.length === 0 && <tr><td colSpan={4} className="ctr">{t('handover.noItems')}</td></tr>}
                        {model.items.map((it, i) => (
                            <tr key={i}>
                                <td className="ctr">{i + 1}</td>
                                <td className="bpd-pre">{it.text}</td>
                                <td className="ctr">{t(`handover.results.${it.status}`)}</td>
                                <td className="bpd-pre">{it.note}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {model.defectsNote.trim() !== '' && (
                <div className="bpd-box" style={{ marginTop: 12 }}>
                    <b>{t('handover.defects')}</b>
                    <div className="bpd-pre">{model.defectsNote}</div>
                </div>
            )}
            {model.documents.length > 0 && (
                <>
                    <div className="bpd-h">{t('handover.documents')}</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {model.documents.map((x, i) => <li key={i}>{t(`handover.kinds.${x.kind}`)}{x.title !== '' && `: ${x.title}`}</li>)}
                    </ul>
                </>
            )}
            <div className="bpd-box" style={{ marginTop: 12 }}>
                <div>{t('handover.warrantyTerm', { months: model.warrantyMonths })}</div>
                {model.accepted && model.acceptedByName !== '' && (
                    <div><b>{t('handover.acceptedBy')}</b> {model.acceptedByName}{model.handoverDate !== null && <> · {d(model.handoverDate)}</>}</div>
                )}
            </div>
            <SignBlock left={t('handover.receivedBy')} company={c} rightLabel={t('handover.handedBy')} t={t} />
            <Footer text={c.footer} />
        </div>
    );
}
