// ─── Printable BOQ in the layout of the Thai estimate forms ปร.5 (summary) and ปร.4 (detail) ─────────
// Rendered into <body> only while printing (see BoqExportButtons); print CSS hides the app around it.
// Thai renders with the app's Sarabun font (next/font, --font-sarabun) because it prints from the same document.
//
// Page setup
//   A4, 20 mm margins. The summary (ปร.5) is portrait, like the official summary form: five narrow columns fit
//   with room for the signature blocks. The detail (ปร.4) is landscape: it has ten columns (two split money
//   groups) and portrait would leave the รายการ column too narrow for Thai item names. Each form uses a named
//   page (`page:`), so a browser that honours per-page sizes (Chrome/Edge) prints both orientations in one PDF;
//   elsewhere every page takes the first size and the tables, sized in %, still fit.
//   "แผ่นที่ n/N" is printed in the page's top-right margin box (Chrome/Edge 131+; other browsers show none).
//   Columns are fixed-width (`table-layout: fixed`), so every page of a form lines up the same way; header rows
//   repeat on every page; a row is never split across pages.
//   Carried totals (ยอดยกไป / ยอดยกมา) need to know where the browser breaks pages, which CSS cannot report, so
//   each section closes with its own sub-total ("รวมหมวดที่ n") instead.
//
// Type sizes: Google Sarabun draws Thai about 1.35× larger than TH Sarabun New at the same point size, so 12 pt here
// reads like the official 16 pt TH Sarabun New body text, and the 10.5 pt tables like 14 pt.

import type { ReactNode } from 'react';
import {
    fmtMoney, fmtQty, PRINT_TEXT as T,
    type BoqPrintModel, type PrintDetailRow, type PrintDetailSection, type PrintPageHeader, type PrintPart,
    type PrintSignature, type PrintSummaryLine,
} from './boq-print-model';

export const PRINT_ROOT_CLASS = 'boqp-root';
/** Set on <html> while printing (see BoqExportButtons): the page margin boxes do not see body's --font-sarabun. */
export const PRINT_FONT_VAR = '--boqp-font';

const R = PRINT_ROOT_CLASS;
const RULE = '0.5pt solid #000';

const CSS = `
@media screen { .${R} { display: none !important; } }
@media print {
  @page {
    size: A4; margin: 20mm;
    @top-right {
      content: "${T.pageOf} " counter(page) "/" counter(pages);
      font-family: var(${PRINT_FONT_VAR}, Tahoma), Tahoma, sans-serif; font-size: 11pt; color: #000;
      vertical-align: bottom; padding-bottom: 5mm;
    }
  }
  @page boqp-portrait { size: A4 portrait; }
  @page boqp-landscape { size: A4 landscape; }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.${R}) { display: none !important; }
  .${R} { display: block !important; }
}
.${R} {
  font-family: var(--font-sarabun, 'Sarabun'), 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
  color: #000; background: #fff; font-size: 12pt; line-height: 1.35;
  font-variant-numeric: tabular-nums lining-nums;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.${R} *, .${R} *::before, .${R} *::after { box-sizing: border-box; }
.boqp-pr5 { page: boqp-portrait; }
.boqp-pr4 { page: boqp-landscape; }
.boqp-pr5 + .boqp-pr4 { break-before: page; page-break-before: always; }

.boqp-head { margin: 0 0 4mm; }
.boqp-form { display: flex; justify-content: flex-end; }
.boqp-form span { border: ${RULE}; padding: 0.3mm 2.5mm; font-size: 11pt; }
.boqp-title { margin: 1mm 0 4mm; text-align: center; font-size: 15pt; font-weight: 700; line-height: 1.3; }
.boqp-fields { display: grid; grid-template-columns: 3fr 2fr; column-gap: 8mm; row-gap: 1.5mm; }
.boqp-field { display: flex; align-items: baseline; gap: 2mm; min-width: 0; }
.boqp-field.boqp-wide { grid-column: 1 / -1; }
.boqp-label { font-weight: 700; white-space: nowrap; }
.boqp-value { flex: 1 1 auto; min-width: 0; min-height: 1.35em; padding: 0 1mm; border-bottom: 0.5pt dotted #000; }

.boqp-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10.5pt; line-height: 1.3; }
.boqp-pr5 .boqp-table { font-size: 11pt; }
.boqp-table thead { display: table-header-group; }
.boqp-table tr { break-inside: avoid; page-break-inside: avoid; }
.boqp-table tbody.boqp-keep { break-inside: avoid; page-break-inside: avoid; }
.boqp-table th, .boqp-table td { border: ${RULE}; padding: 0.8mm 1.5mm; vertical-align: top; overflow-wrap: break-word; }
.boqp-table th { background: #e6e6e6; font-weight: 700; text-align: center; vertical-align: middle; line-height: 1.2; }
.boqp-num { text-align: right; white-space: nowrap; }
.boqp-c { text-align: center; }
.boqp-b { font-weight: 700; }
.boqp-sec td { font-weight: 700; break-after: avoid; page-break-after: avoid; }
.boqp-hd td { font-weight: 600; break-after: avoid; page-break-after: avoid; }
.boqp-sub td { font-weight: 700; background: #f2f2f2; }
.boqp-total td { font-weight: 700; background: #e6e6e6; border-top: 1pt solid #000; }
.boqp-band td { font-weight: 700; background: #f2f2f2; }
.boqp-words td { text-align: center; font-weight: 700; }
.boqp-qnote { font-size: 9.5pt; color: #404040; }
.boqp-empty td { text-align: center; color: #404040; padding: 4mm; }

.boqp-signs { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 8mm; margin-top: 12mm;
  break-inside: avoid; page-break-inside: avoid; font-size: 11pt; }
.boqp-sign-role { text-align: center; font-weight: 700; margin-bottom: 9mm; }
.boqp-sign-line { display: flex; align-items: baseline; gap: 1.5mm; margin-top: 2.5mm; white-space: nowrap; }
.boqp-fill { flex: 1 1 auto; min-width: 0; min-height: 1.35em; border-bottom: 0.5pt dotted #000; text-align: center;
  white-space: normal; }
`;

function Header({ header }: { header: PrintPageHeader }) {
    return (
        <header className="boqp-head">
            <div className="boqp-form"><span>{header.formLabel}</span></div>
            <h1 className="boqp-title">{header.title}</h1>
            <div className="boqp-fields">
                {header.fields.map(f => (
                    <div key={f.key} className={f.wide ? 'boqp-field boqp-wide' : 'boqp-field'}>
                        <span className="boqp-label">{f.label}</span>
                        <span className="boqp-value">{f.value}</span>
                    </div>
                ))}
            </div>
        </header>
    );
}

// ─── ปร.5 summary ─────────────────────────────────────────────────────────────

const SUMMARY_COLS = 6;

function SummaryRow({ line, note = '' }: { line: PrintSummaryLine; note?: string }) {
    return (
        <tr>
            <td className="boqp-c">{line.no}</td>
            <td>{line.title}</td>
            <td className="boqp-num">{fmtMoney(line.matTotal)}</td>
            <td className="boqp-num">{fmtMoney(line.labTotal)}</td>
            <td className="boqp-num">{fmtMoney(line.total)}</td>
            <td>{note}</td>
        </tr>
    );
}

function Signature({ s }: { s: PrintSignature }) {
    return (
        <div>
            <div className="boqp-sign-role">{s.role}</div>
            <div className="boqp-sign-line"><span>{T.signName}</span><span className="boqp-fill" /></div>
            <div className="boqp-sign-line"><span>(</span><span className="boqp-fill">{s.name}</span><span>)</span></div>
            <div className="boqp-sign-line"><span>{T.signPosition}</span><span className="boqp-fill" /></div>
            <div className="boqp-sign-line"><span>{T.signDate}</span><span className="boqp-fill" /></div>
        </div>
    );
}

function SummaryForm({ model }: { model: BoqPrintModel }) {
    return (
        <section className="boqp-pr5">
            <Header header={model.summaryHeader} />
            <table className="boqp-table">
                <colgroup>
                    <col style={{ width: '8%' }} />
                    <col />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th>{T.colNo}</th>
                        <th>{T.colSection}</th>
                        <th>{T.colMat}<br />{T.currency}</th>
                        <th>{T.colLab}<br />{T.currency}</th>
                        <th>{T.colTotal}<br />{T.currency}</th>
                        <th>{T.colNote}</th>
                    </tr>
                </thead>
                <tbody>
                    {model.summary.map(l => <SummaryRow key={l.no} line={l} />)}
                    <tr className="boqp-total">
                        <td />
                        <td className="boqp-c">{T.constructionTotal}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionMat)}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionLab)}</td>
                        <td className="boqp-num">{fmtMoney(model.constructionTotal)}</td>
                        <td />
                    </tr>
                    <tr className="boqp-words">
                        <td colSpan={SUMMARY_COLS}>({T.inWords} {model.constructionTotalText})</td>
                    </tr>
                    <tr>
                        <td />
                        <td>{T.factorF}</td>
                        <td /><td /><td /><td />
                    </tr>
                </tbody>
                {model.preConstruction.length > 0 && (
                    <tbody>
                        <tr className="boqp-band"><td colSpan={SUMMARY_COLS}>{T.preConstruction}</td></tr>
                        {model.preConstruction.map(l => <SummaryRow key={l.no} line={l} note={T.preConstructionNote} />)}
                    </tbody>
                )}
            </table>
            <div className="boqp-signs">
                {model.signatures.map(s => <Signature key={s.role} s={s} />)}
            </div>
        </section>
    );
}

// ─── ปร.4 detail ──────────────────────────────────────────────────────────────

const DETAIL_COLS = 10;

function DetailRow({ r }: { r: PrintDetailRow }) {
    if (r.type === 'heading') {
        return (
            <tr className="boqp-hd">
                <td className="boqp-c">{r.itemNo}</td>
                <td>{r.desc}</td>
                <td /><td /><td /><td /><td /><td /><td /><td />
            </tr>
        );
    }
    return (
        <tr>
            <td className="boqp-c">{r.itemNo}</td>
            <td>{r.desc}</td>
            <td className="boqp-num">{fmtQty(r.qty)}</td>
            <td className="boqp-c">{r.unit}</td>
            <td className="boqp-num">{fmtMoney(r.matUnit)}</td>
            <td className="boqp-num">{fmtMoney(r.matTotal)}</td>
            <td className="boqp-num">{fmtMoney(r.labUnit)}</td>
            <td className="boqp-num">{fmtMoney(r.labTotal)}</td>
            <td className="boqp-num">{fmtMoney(r.total)}</td>
            <td>
                {r.note !== '' && <div>{r.note}</div>}
                {r.qtyNote !== '' && <div className="boqp-qnote">{r.qtyNote}</div>}
            </td>
        </tr>
    );
}

function AmountsRow({ className, label, mat, lab, total }: {
    className: string; label: string; mat: number; lab: number; total: number;
}) {
    return (
        <tr className={className}>
            <td />
            <td className="boqp-c">{label}</td>
            <td /><td /><td />
            <td className="boqp-num">{fmtMoney(mat)}</td>
            <td />
            <td className="boqp-num">{fmtMoney(lab)}</td>
            <td className="boqp-num">{fmtMoney(total)}</td>
            <td />
        </tr>
    );
}

/** Rows a section's title stays with: up to and including its first priced item (a heading alone is not enough). */
function leadCount(rows: PrintDetailRow[]): number {
    const i = rows.findIndex(r => r.type === 'item');
    return i < 0 ? rows.length : i + 1;
}

/**
 * One section as up to three <tbody> blocks. Chrome ignores `break-after: avoid` between table rows, but keeps a
 * whole <tbody> with `break-inside: avoid` on one page: the title (and `lead`, e.g. the pre-construction band) stays
 * with the first item, and the "รวมหมวดที่ n" sub-total with the last row, so neither is left alone on a page.
 */
function DetailSection({ s, lead }: { s: PrintDetailSection; lead?: ReactNode }) {
    const outside = s.inConstructionTotal ? '' : ` (${T.preConstructionNote})`;
    const head = Math.min(leadCount(s.rows), s.rows.length);
    const tailFrom = Math.max(head, s.rows.length - 1);
    const subtotal = (
        <AmountsRow className="boqp-sub" label={`${s.subtotalLabel}${outside}`}
            mat={s.matTotal} lab={s.labTotal} total={s.total} />
    );
    const together = tailFrom <= head;   // short section: title, rows and sub-total in one block
    return (
        <>
            <tbody className="boqp-keep">
                {lead}
                <tr className="boqp-sec">
                    <td className="boqp-c">{s.no}</td>
                    <td>{s.title}</td>
                    <td /><td /><td /><td /><td /><td /><td /><td />
                </tr>
                {s.rows.slice(0, together ? s.rows.length : head).map(r => <DetailRow key={r.key} r={r} />)}
                {together && subtotal}
            </tbody>
            {!together && (
                <>
                    {tailFrom > head && <tbody>{s.rows.slice(head, tailFrom).map(r => <DetailRow key={r.key} r={r} />)}</tbody>}
                    <tbody className="boqp-keep">
                        {s.rows.slice(tailFrom).map(r => <DetailRow key={r.key} r={r} />)}
                        {subtotal}
                    </tbody>
                </>
            )}
        </>
    );
}

function DetailForm({ model }: { model: BoqPrintModel }) {
    const empty = model.details.length === 0 && model.preConstructionDetails.length === 0;
    return (
        <section className="boqp-pr4">
            <Header header={model.detailHeader} />
            <table className="boqp-table">
                <colgroup>
                    <col style={{ width: '5%' }} />
                    <col />
                    <col style={{ width: '7.8%' }} />
                    <col style={{ width: '5.8%' }} />
                    <col style={{ width: '8.6%' }} />
                    <col style={{ width: '10.1%' }} />
                    <col style={{ width: '8.6%' }} />
                    <col style={{ width: '10.1%' }} />
                    <col style={{ width: '11.7%' }} />
                    <col style={{ width: '10.1%' }} />
                </colgroup>
                <thead>
                    <tr>
                        <th rowSpan={2}>{T.colNo}</th>
                        <th rowSpan={2}>{T.colDesc}</th>
                        <th rowSpan={2}>{T.colQty}</th>
                        <th rowSpan={2}>{T.colUnit}</th>
                        <th colSpan={2}>{T.colMat}</th>
                        <th colSpan={2}>{T.colLab}</th>
                        <th rowSpan={2}>{T.colMatLab}<br />{T.currency}</th>
                        <th rowSpan={2}>{T.colNote}</th>
                    </tr>
                    <tr>
                        <th>{T.colUnitPrice}<br />{T.currency}</th>
                        <th>{T.colAmount}<br />{T.currency}</th>
                        <th>{T.colUnitPrice}<br />{T.currency}</th>
                        <th>{T.colAmount}<br />{T.currency}</th>
                    </tr>
                </thead>
                {empty && (
                    <tbody><tr className="boqp-empty"><td colSpan={DETAIL_COLS}>{T.nothing}</td></tr></tbody>
                )}
                {model.details.map(s => <DetailSection key={s.no} s={s} />)}
                <tbody>
                    <AmountsRow className="boqp-total" label={T.constructionTotal}
                        mat={model.constructionMat} lab={model.constructionLab} total={model.constructionTotal} />
                </tbody>
                {/* The band heads the first pre-construction section's block, so it never ends a page on its own. */}
                {model.preConstructionDetails.map((s, i) => (
                    <DetailSection key={s.no} s={s} lead={i === 0
                        ? <tr className="boqp-band"><td colSpan={DETAIL_COLS}>{T.preConstruction}</td></tr>
                        : undefined} />
                ))}
            </table>
        </section>
    );
}

/** The printable document: the ปร.5 summary (with signatures), then the ปร.4 detailed list. */
export function BoqPrintDocument({ model, part = 'all' }: { model: BoqPrintModel; part?: PrintPart }) {
    return (
        <div className={PRINT_ROOT_CLASS} lang="th">
            <style>{CSS}</style>
            {part !== 'detail' && <SummaryForm model={model} />}
            {part !== 'summary' && <DetailForm model={model} />}
        </div>
    );
}
