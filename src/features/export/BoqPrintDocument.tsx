// ─── Printable BOQ for the house owner ───────────────────────────────────────
// Rendered into <body> only while printing (see BoqExportButtons); print CSS hides the app around it.
// Thai renders with the app's Sarabun font (next/font, --font-sarabun) because it prints from the same document.

import { Fragment } from 'react';
import {
    fmtMoney, fmtPercent, fmtQty, PRINT_TEXT as T,
    type BoqPrintModel, type PrintDetailSection, type PrintSummaryLine,
} from './boq-print-model';

export const PRINT_ROOT_CLASS = 'boqp-root';

const CSS = `
@media screen { .${PRINT_ROOT_CLASS} { display: none !important; } }
@media print {
  @page { size: A4 landscape; margin: 10mm 10mm 12mm 10mm; }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.${PRINT_ROOT_CLASS}) { display: none !important; }
  .${PRINT_ROOT_CLASS} { display: block !important; }
}
.${PRINT_ROOT_CLASS} {
  font-family: var(--font-sarabun), 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
  color: #1f1f1f; background: #fff; font-size: 10.5pt; line-height: 1.35;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.${PRINT_ROOT_CLASS} * { box-sizing: border-box; }
.boqp-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  border-bottom: 2px solid #1f3a5f; padding-bottom: 8px; margin-bottom: 10px; }
.boqp-title { font-size: 18pt; font-weight: 700; color: #1f3a5f; margin: 0; }
.boqp-project { font-size: 13pt; font-weight: 600; margin-top: 2px; }
.boqp-fields { display: grid; grid-template-columns: max-content 1fr max-content 1fr; gap: 2px 10px; font-size: 10pt; margin-bottom: 12px; }
.boqp-fields dt { color: #595959; }
.boqp-fields dd { margin: 0; font-weight: 600; }
.boqp-h2 { font-size: 12pt; font-weight: 700; margin: 10px 0 6px; color: #1f3a5f; }
.boqp-table { width: 100%; border-collapse: collapse; }
.boqp-table th, .boqp-table td { border: 1px solid #bfbfbf; padding: 3px 5px; vertical-align: middle; }
.boqp-table thead th { background: #e3ebf9; font-weight: 700; text-align: center; }
.boqp-table thead { display: table-header-group; }
.boqp-table tr { break-inside: avoid; page-break-inside: avoid; }
.boqp-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.boqp-center { text-align: center; }
.boqp-muted { color: #8c8c8c; }
.boqp-sec td { background: #e3ebf9; font-weight: 700; }
.boqp-sub td { font-weight: 700; background: #fafafa; }
.boqp-total td { font-weight: 700; background: #f3f3f3; font-size: 11.5pt; }
.boqp-grand { margin-top: 10px; display: flex; justify-content: flex-end; }
.boqp-grand-box { border: 2px solid #1f3a5f; border-radius: 4px; padding: 6px 14px; text-align: right; min-width: 50%; }
.boqp-grand-label { font-size: 10.5pt; color: #595959; }
.boqp-grand-value { font-size: 17pt; font-weight: 700; color: #1f3a5f; font-variant-numeric: tabular-nums; }
.boqp-grand-words { font-size: 10.5pt; }
.boqp-pre { margin-top: 8px; font-size: 10pt; }
.boqp-pre td { border: none; padding: 1px 6px; }
.boqp-sign { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 36px; break-inside: avoid; page-break-inside: avoid; }
.boqp-sign div { text-align: center; font-size: 10pt; }
.boqp-sign-line { border-bottom: 1px dotted #595959; height: 36px; margin-bottom: 4px; }
.boqp-break { break-before: page; page-break-before: always; }
.boqp-detail { font-size: 9pt; }
.boqp-detail th, .boqp-detail td { padding: 2px 4px; }
`;

function Header({ model }: { model: BoqPrintModel }) {
    return (
        <>
            <div className="boqp-head">
                <div>
                    <h1 className="boqp-title">{model.title}</h1>
                    {model.projectName !== '' && <div className="boqp-project">{model.projectName}</div>}
                </div>
            </div>
            {model.fields.length > 0 && (
                <dl className="boqp-fields">
                    {model.fields.map(f => (
                        <Fragment key={f.label}>
                            <dt>{f.label}</dt>
                            <dd>{f.value}</dd>
                        </Fragment>
                    ))}
                </dl>
            )}
        </>
    );
}

function SummaryRow({ line }: { line: PrintSummaryLine }) {
    return (
        <tr>
            <td className="boqp-center">{line.no}</td>
            <td>{line.title}</td>
            <td className="boqp-num">{fmtMoney(line.matTotal)}</td>
            <td className="boqp-num">{fmtMoney(line.labTotal)}</td>
            <td className="boqp-num">{fmtMoney(line.total)}</td>
            <td className="boqp-num boqp-muted">{fmtPercent(line.share, 1)}</td>
        </tr>
    );
}

function Summary({ model }: { model: BoqPrintModel }) {
    return (
        <section>
            <div className="boqp-h2">{T.summaryTitle}</div>
            <table className="boqp-table">
                <thead>
                    <tr>
                        <th style={{ width: '6%' }}>{T.colNo}</th>
                        <th>{T.colSection}</th>
                        <th style={{ width: '15%' }}>{T.colMat}</th>
                        <th style={{ width: '15%' }}>{T.colLab}</th>
                        <th style={{ width: '16%' }}>{T.colTotal}</th>
                        <th style={{ width: '7%' }}>{T.colShare}</th>
                    </tr>
                </thead>
                <tbody>
                    {model.summary.map(l => <SummaryRow key={l.no} line={l} />)}
                    <tr className="boqp-total">
                        <td colSpan={2} style={{ textAlign: 'right' }}>{T.constructionTotal}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionMat)}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionLab)}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionTotal)}</td>
                        <td className="boqp-num">{model.constructionTotal !== 0 ? '100%' : ''}</td>
                    </tr>
                </tbody>
            </table>
            <div className="boqp-grand">
                <div className="boqp-grand-box">
                    <div className="boqp-grand-label">{T.constructionTotal}</div>
                    <div className="boqp-grand-value">{fmtMoney(model.constructionTotal)} {T.baht}</div>
                    <div className="boqp-grand-words">({model.constructionTotalText})</div>
                </div>
            </div>
            {model.preConstruction.length > 0 && (
                <table className="boqp-pre">
                    <tbody>
                        <tr><td colSpan={3} style={{ fontWeight: 700 }}>{T.preConstruction}</td></tr>
                        {model.preConstruction.map(l => (
                            <tr key={l.no}>
                                <td>{l.no}. {l.title}</td>
                                <td className="boqp-num">{fmtMoney(l.total)}</td>
                                <td>{T.baht}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

function Signatures({ model }: { model: BoqPrintModel }) {
    const prepared = model.preparedBy;
    const owner = model.ownerName;
    return (
        <div className="boqp-sign">
            <div>
                <div className="boqp-sign-line" />
                <div>{T.signPreparedBy}{prepared !== '' ? ` (${prepared})` : ''}</div>
                <div className="boqp-muted">{T.signDate}</div>
            </div>
            <div>
                <div className="boqp-sign-line" />
                <div>{T.signOwner}{owner !== '' ? ` (${owner})` : ''}</div>
                <div className="boqp-muted">{T.signDate}</div>
            </div>
        </div>
    );
}

const DETAIL_COLS = 12;

function DetailSection({ s }: { s: PrintDetailSection }) {
    return (
        <tbody>
            <tr className="boqp-sec">
                <td className="boqp-center">{s.no}</td>
                <td colSpan={DETAIL_COLS - 1}>
                    {s.title}
                    {!s.inConstructionTotal && <span className="boqp-muted" style={{ fontWeight: 400 }}> ({T.preConstructionNote})</span>}
                </td>
            </tr>
            {s.rows.map(r => r.type === 'heading'
                ? (
                    <tr key={r.key}>
                        <td className="boqp-center">{r.itemNo}</td>
                        <td colSpan={DETAIL_COLS - 1} style={{ fontWeight: 600 }}>{r.desc}</td>
                    </tr>
                )
                : (
                    <tr key={r.key}>
                        <td className="boqp-center">{r.itemNo}</td>
                        <td>{r.desc}</td>
                        <td className="boqp-num">{fmtQty(r.qty)}</td>
                        <td className="boqp-center">{r.unit}</td>
                        <td className="boqp-num">{fmtPercent(r.waste)}</td>
                        <td className="boqp-num">{fmtQty(r.grossQty)}</td>
                        <td className="boqp-num">{fmtMoney(r.matUnit)}</td>
                        <td className="boqp-num">{fmtMoney(r.matTotal)}</td>
                        <td className="boqp-num">{fmtMoney(r.labUnit)}</td>
                        <td className="boqp-num">{fmtMoney(r.labTotal)}</td>
                        <td className="boqp-num" style={{ fontWeight: 600 }}>{fmtMoney(r.total)}</td>
                        <td>{r.note}</td>
                    </tr>
                ))}
            <tr className="boqp-sub">
                <td colSpan={7} style={{ textAlign: 'right' }}>{T.subtotal} {s.title}</td>
                <td className="boqp-num">{fmtMoney(s.matTotal)}</td>
                <td />
                <td className="boqp-num">{fmtMoney(s.labTotal)}</td>
                <td className="boqp-num">{fmtMoney(s.total)}</td>
                <td />
            </tr>
        </tbody>
    );
}

function Details({ model }: { model: BoqPrintModel }) {
    return (
        <section className="boqp-break">
            <div className="boqp-h2">{T.detailTitle}{model.projectName !== '' ? ` — ${model.projectName}` : ''}</div>
            {model.details.length === 0
                ? <p className="boqp-muted">{T.nothing}</p>
                : (
                    <table className="boqp-table boqp-detail">
                        <colgroup>
                            <col style={{ width: '4.5%' }} />
                            <col />
                            <col style={{ width: '6.5%' }} />
                            <col style={{ width: '5%' }} />
                            <col style={{ width: '4%' }} />
                            <col style={{ width: '6.5%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '7%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '8.5%' }} />
                            <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th rowSpan={2}>{T.colItemNo}</th>
                                <th rowSpan={2}>{T.colDesc}</th>
                                <th rowSpan={2}>{T.colQty}</th>
                                <th rowSpan={2}>{T.colUnit}</th>
                                <th rowSpan={2}>{T.colWaste}</th>
                                <th rowSpan={2}>{T.colGross}</th>
                                <th colSpan={2}>{T.colMat}</th>
                                <th colSpan={2}>{T.colLab}</th>
                                <th rowSpan={2}>{T.colTotal}</th>
                                <th rowSpan={2}>{T.colNote}</th>
                            </tr>
                            <tr>
                                <th>{T.colUnitPrice}</th>
                                <th>{T.colSum}</th>
                                <th>{T.colUnitPrice}</th>
                                <th>{T.colSum}</th>
                            </tr>
                        </thead>
                        {model.details.map(s => <DetailSection key={s.no} s={s} />)}
                        <tbody>
                            <tr className="boqp-total">
                                <td colSpan={10} style={{ textAlign: 'right' }}>{T.constructionTotal}</td>
                                <td className="boqp-num">{fmtMoney(model.constructionTotal)}</td>
                                <td>{T.baht}</td>
                            </tr>
                            {model.preConstruction.length > 0 && (
                                <tr>
                                    <td colSpan={10} style={{ textAlign: 'right' }}>{T.preConstruction}</td>
                                    <td className="boqp-num">{fmtMoney(model.preConstructionTotal)}</td>
                                    <td>{T.baht}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
        </section>
    );
}

/** The whole printable document (summary page, then the detailed list). */
export function BoqPrintDocument({ model }: { model: BoqPrintModel }) {
    return (
        <div className={PRINT_ROOT_CLASS} lang="th">
            <style>{CSS}</style>
            <Header model={model} />
            <Summary model={model} />
            <Signatures model={model} />
            <Details model={model} />
        </div>
    );
}
