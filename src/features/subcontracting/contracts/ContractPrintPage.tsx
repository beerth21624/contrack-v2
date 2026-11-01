'use client';

// ─── /subcontracting/contracts/[id]/print: the contract on A4 for the browser's print dialog ("Save as PDF") ───
// Same approach as the BOQ print (src/features/export/BoqPrintDocument.tsx): Sarabun from the app's next/font, a
// document portalled into <body>, print CSS hiding everything else. On screen it covers the app as a full-screen sheet
// preview with a small toolbar, so the page has no app chrome.
// Layout: header (no., version) → contract text (server-sanitised HTML) → annex: lines with the total in Thai words,
// installments → signature blocks (employer, contractor, two witnesses). The annex follows the UI language at print time;
// the contract text itself is the server's (Thai standard template or the company's own).
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import type { ContractDocumentDto, SubcontractDto } from '@/shared/contract';
import { amountInWords } from '@/i18n/format';
import { spinner } from '@/features/cloud/ui/common';
import { useContractDocument, useSubcontract } from './api';
import { fmtDate, fmtMoney, fmtPct, fmtQty } from './logic';
import { LoadError } from './ui';

const R = 'scp-root';
const RULE = '0.5pt solid #000';

const CSS = `
.${R} { position: fixed; inset: 0; z-index: 2000; overflow: auto; background: #e5e7eb; }
.scp-toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; align-items: center; justify-content: center;
  padding: 10px 16px; background: #fff; border-bottom: 1px solid #e5e7eb; font-family: var(--font-plex-thai), system-ui, sans-serif; }
.scp-sheet { width: 210mm; min-height: 297mm; margin: 16px auto; padding: 20mm; background: #fff;
  box-shadow: 0 1px 3px rgb(16 24 40 / .12); }
.scp-doc {
  font-family: var(--font-sarabun, 'Sarabun'), 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
  color: #000; font-size: 12pt; line-height: 1.5; font-variant-numeric: tabular-nums lining-nums;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.scp-doc *, .scp-doc *::before, .scp-doc *::after { box-sizing: border-box; }
.scp-meta { display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 4mm; }
.scp-body h1, .scp-body h2 { text-align: center; font-size: 15pt; font-weight: 700; margin: 2mm 0 4mm; }
.scp-body h3 { font-size: 13pt; font-weight: 700; margin: 4mm 0 2mm; }
.scp-body p { margin: 0 0 2mm; text-indent: 0; }
.scp-body table { width: 100%; border-collapse: collapse; margin: 2mm 0; }
.scp-body td, .scp-body th { border: ${RULE}; padding: 0.8mm 1.5mm; vertical-align: top; }
.scp-annex { break-before: page; page-break-before: always; }
.scp-annex h2 { text-align: center; font-size: 14pt; font-weight: 700; margin: 0 0 4mm; }
.scp-annex h3 { font-size: 12.5pt; font-weight: 700; margin: 5mm 0 2mm; }
.scp-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5pt; line-height: 1.3; }
.scp-table thead { display: table-header-group; }
.scp-table tr { break-inside: avoid; page-break-inside: avoid; }
.scp-table th, .scp-table td { border: ${RULE}; padding: 0.8mm 1.5mm; vertical-align: top; overflow-wrap: break-word; }
.scp-table th { background: #e6e6e6; font-weight: 700; text-align: center; }
.scp-num { text-align: right; white-space: nowrap; }
.scp-c { text-align: center; }
.scp-total td { font-weight: 700; background: #f2f2f2; }
.scp-words td { text-align: center; font-weight: 700; }
.scp-signs { display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 16mm; row-gap: 10mm; margin-top: 14mm;
  break-inside: avoid; page-break-inside: avoid; font-size: 11.5pt; }
.scp-sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 3mm; white-space: nowrap; }
.scp-fill { flex: 1 1 auto; min-width: 0; min-height: 1.4em; border-bottom: 0.5pt dotted #000; text-align: center; white-space: normal; }
@media print {
  @page { size: A4 portrait; margin: 20mm; }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.${R}) { display: none !important; }
  .${R} { position: static; overflow: visible; background: #fff; }
  .scp-toolbar { display: none !important; }
  .scp-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
}
`;

const subscribe = () => () => undefined;
const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false);

export function ContractPrintPage({ id }: { id: string }) {
    const t = useTranslations('subcontracting');
    const sc = useSubcontract(id);
    const doc = useContractDocument(id);
    const mounted = useMounted();
    if (sc.isLoading || doc.isLoading) return spinner;
    if (sc.isError) return <LoadError error={sc.error} />;
    if (doc.isError) return <LoadError error={doc.error} />;
    if (sc.data === undefined || doc.data === undefined || !mounted) return spinner;
    // Buyer-only route (behind the workspace ModuleGate, which a crew workspace never passes).
    const back = `/subcontracting/contracts/${id}`;
    return createPortal(
        <div className={R}>
            <style>{CSS}</style>
            <div className="scp-toolbar">
                <Link href={back}><Button>{t('contracts.print.back')}</Button></Link>
                <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>{t('contracts.print.printPdf')}</Button>
            </div>
            <div className="scp-sheet">
                <ContractDocument sc={sc.data} doc={doc.data} />
            </div>
        </div>,
        document.body,
    );
}

export function ContractDocument({ sc, doc }: { sc: SubcontractDto; doc: ContractDocumentDto }) {
    const t = useTranslations('subcontracting');
    const locale = useLocale();
    const hasMat = sc.lines.some(l => l.matUnitPrice !== null);
    const cols = hasMat ? 7 : 6;
    return (
        <article className="scp-doc">
            <div className="scp-meta">
                <span>{t('contracts.print.contractNo', { no: sc.contractNo })}</span>
                <span>{t('contracts.print.version', { version: String(doc.version) })}</span>
            </div>
            {/* The server sanitises the contract HTML (GET …/document). */}
            <div className="scp-body" dangerouslySetInnerHTML={{ __html: doc.html }} />

            <section className="scp-annex">
                <h2>{t('contracts.print.annexTitle', { no: sc.contractNo })}</h2>
                <h3>{t('contracts.print.linesHeading')}</h3>
                <table className="scp-table">
                    <colgroup>
                        <col style={{ width: '7%' }} />
                        <col />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '9%' }} />
                        {hasMat && <col style={{ width: '13%' }} />}
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '16%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>{t('contracts.print.colNo')}</th><th>{t('contracts.print.colItem')}</th><th>{t('contracts.print.colQty')}</th><th>{t('contracts.print.colUnit')}</th>
                            {hasMat && <th>{t('contracts.print.colMaterialPerUnit')}</th>}
                            <th>{t('contracts.print.colLabourPerUnit')}</th><th>{t('contracts.print.colAmountBaht')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sc.lines.length === 0 && (
                            <tr><td colSpan={cols} className="scp-c">{t('contracts.print.lumpSum', { title: sc.title })}</td></tr>
                        )}
                        {sc.lines.map(l => (
                            <tr key={l.idx}>
                                <td className="scp-c">{l.idx}</td>
                                <td>{l.desc}</td>
                                <td className="scp-num">{fmtQty(l.qty)}</td>
                                <td className="scp-c">{l.unit}</td>
                                {hasMat && <td className="scp-num">{l.matUnitPrice === null ? '' : fmtMoney(l.matUnitPrice)}</td>}
                                <td className="scp-num">{l.unitPrice === null ? '' : fmtMoney(l.unitPrice)}</td>
                                <td className="scp-num">{fmtMoney(l.total)}</td>
                            </tr>
                        ))}
                        {sc.variationsTotal !== 0 && (
                            <tr>
                                <td colSpan={cols - 1} className="scp-num">{t('contracts.print.agreedVariations')}</td>
                                <td className="scp-num">{fmtMoney(sc.variationsTotal)}</td>
                            </tr>
                        )}
                        <tr className="scp-total">
                            <td colSpan={cols - 1} className="scp-c">{t('contracts.print.contractTotal')}</td>
                            <td className="scp-num">{fmtMoney(sc.total)}</td>
                        </tr>
                        <tr className="scp-words"><td colSpan={cols}>({amountInWords(sc.total, locale)})</td></tr>
                    </tbody>
                </table>

                <h3>{t('contracts.print.installmentsHeading')}</h3>
                <table className="scp-table">
                    <colgroup>
                        <col style={{ width: '9%' }} />
                        <col />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '18%' }} />
                    </colgroup>
                    <thead><tr><th>{t('contracts.print.colInstallmentNo')}</th><th>{t('contracts.print.colCondition')}</th><th>{t('contracts.print.colPercent')}</th><th>{t('contracts.print.colAmountBaht')}</th></tr></thead>
                    <tbody>
                        {sc.installments.map(i => (
                            <tr key={i.no}>
                                <td className="scp-c">{i.no}</td>
                                <td>{i.condition}</td>
                                <td className="scp-num">{fmtPct(i.pct)}</td>
                                <td className="scp-num">{fmtMoney(i.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p style={{ marginTop: '3mm', fontSize: '11pt' }}>
                    {t('contracts.print.retentionLine', { pct: fmtPct(sc.terms.retentionPct).replace('%', ''), months: String(sc.terms.warrantyMonths) })}
                    {sc.schedule.start !== null ? t('contracts.print.startedOn', { date: fmtDate(sc.schedule.start, true) }) : ''}
                    {sc.schedule.finish !== null ? t('contracts.print.finishedOn', { date: fmtDate(sc.schedule.finish, true) }) : ''}
                </p>

                <div className="scp-signs">
                    <Signature role={t('contracts.print.employer')} name={sc.buyerName} />
                    <Signature role={t('contracts.print.contractor')} name={sc.vendorName} />
                    <Signature role={t('contracts.print.witness')} name="" />
                    <Signature role={t('contracts.print.witness')} name="" />
                </div>
            </section>
        </article>
    );
}

function Signature({ role, name }: { role: string; name: string }) {
    const t = useTranslations('subcontracting');
    return (
        <div>
            <div className="scp-sign-line"><span>{t('contracts.print.signed')}</span><span className="scp-fill" /><span>{role}</span></div>
            <div className="scp-sign-line"><span>(</span><span className="scp-fill">{name}</span><span>)</span></div>
            <div className="scp-sign-line"><span>{t('contracts.print.dated')}</span><span className="scp-fill" /></div>
        </div>
    );
}
