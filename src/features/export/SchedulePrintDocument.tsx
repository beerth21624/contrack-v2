// ─── Printable S-Curve schedule: Gantt + S-Curve, and the ปฏิทินงาน (one page per month) ─────────────────
// Rendered into <body> only while printing (SchedulePrintButton → runBrowserPrint); print CSS hides the app around
// it. Same rules as the BOQ forms (BoqPrintDocument.tsx): Sarabun, 0.5pt black rules, backgrounds printed exactly,
// "แผ่นที่ n/N" in the top-right margin box, fixed table layout, header rows repeated, rows never split.
//
// Page setup: A4 landscape, 14 mm top (room for the page number) and 10 mm elsewhere: 277 × 186 mm of page area.
//   Gantt     — the header block and the S-curve keep together on the first page; the task table follows. Its last
//               column is a fixed-width timeline: bars sit at their dates in proportion (left / width in %), with
//               a rule at each month, so the table fits the width whatever the number of weeks.
//               An installment (งวด) row is kept with its first task, the total with the last task.
//   Calendar  — each month is one fixed-height page (`.schp-month`, CAL_LAYOUT.pageHeight): the grid takes what the
//               header and the overflow table leave, so a month can never run onto a second page. How many task
//               chips a day shows, and the type scale, come from the model (fitMonth). Crew names (when the project
//               has crews assigned) ride on the chip after the task, cut with "…" when the cell is narrow, and on a
//               second line under the task in the overflow table.

import {
    CAL_LAYOUT, SCHEDULE_PRINT_TEXT as T, monthSummaryText,
    type CalendarPrintCell, type CalendarPrintModel, type CalendarPrintMonth, type GanttPrintInstallment,
    type GanttPrintModel, type GanttPrintTask, type SCurvePrintModel, type TimelineBar, type TimelineMonth,
} from './schedule-print-model';
import type { ReactNode } from 'react';
import { PRINT_FONT_VAR } from './BoqPrintDocument';
import { PRINT_TEXT } from './boq-print-model';
import { CHART_COLORS, formatDate, installmentColors } from '@/features/planning/shared/planning-format';
import { WEEKDAYS, crewText } from '@/features/planning/schedule/calendar-grid';

export const SCHEDULE_PRINT_ROOT_CLASS = 'schp-root';

const R = SCHEDULE_PRINT_ROOT_CLASS;
const RULE = '0.5pt solid #000';


const CSS = `
@media screen { .${R} { display: none !important; } }
@media print {
  @page {
    size: A4 landscape; margin: 14mm 10mm 10mm;
    @top-right {
      content: "${PRINT_TEXT.pageOf} " counter(page) "/" counter(pages);
      font-family: var(${PRINT_FONT_VAR}, Tahoma), Tahoma, sans-serif; font-size: 10pt; color: #000;
      vertical-align: bottom; padding-bottom: 3mm;
    }
  }
  html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.${R}) { display: none !important; }
  .${R} { display: block !important; }
}
.${R} {
  font-family: var(--font-sarabun, 'Sarabun'), 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif;
  color: #000; background: #fff; font-size: 10.5pt; line-height: 1.35;
  font-variant-numeric: tabular-nums lining-nums;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.${R} *, .${R} *::before, .${R} *::after { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* ── Gantt + S-Curve ── */
.schp-lead { break-inside: avoid; page-break-inside: avoid; }
.schp-title { margin: 0 0 3mm; text-align: center; font-size: 15pt; font-weight: 700; line-height: 1.3; }
.schp-fields { display: grid; grid-template-columns: 5fr 3fr 3fr; column-gap: 6mm; row-gap: 1.2mm; margin-bottom: 3.5mm; }
.schp-field { display: flex; align-items: baseline; gap: 2mm; min-width: 0; }
.schp-label { font-weight: 700; white-space: nowrap; }
.schp-value { flex: 1 1 auto; min-width: 0; min-height: 1.35em; padding: 0 1mm; border-bottom: 0.5pt dotted #000; }
.schp-chart { border: ${RULE}; padding: 1.5mm 2mm 1mm; margin-bottom: 4mm; }
.schp-chart-head { display: flex; align-items: baseline; gap: 6mm; font-size: 10pt; }
.schp-chart-head b { font-size: 11pt; }
.schp-key { display: inline-flex; align-items: center; gap: 1.5mm; font-size: 9pt; }
.schp-key i { display: inline-block; width: 6mm; height: 0.8mm; }
.schp-key i.schp-box { width: 3mm; height: 3mm; }
.schp-chart svg { display: block; width: 100%; height: auto; }

.schp-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; line-height: 1.3; }
.schp-table thead { display: table-header-group; }
.schp-table tr { break-inside: avoid; page-break-inside: avoid; }
.schp-table tbody.schp-keep { break-inside: avoid; page-break-inside: avoid; }
.schp-table th, .schp-table td { border: ${RULE}; padding: 0.6mm 1.2mm; vertical-align: middle; overflow-wrap: break-word; }
.schp-table th { background: #e6e6e6; font-weight: 700; text-align: center; line-height: 1.2; }
.schp-num { text-align: right; white-space: nowrap; }
.schp-c { text-align: center; white-space: nowrap; }
.schp-inst td { font-weight: 700; }
.schp-inst td.schp-fill { background: #f2f2f2; }
.schp-total td { font-weight: 700; background: #e6e6e6; border-top: 1pt solid #000; }
.schp-empty td { text-align: center; padding: 4mm; }
.schp-note { margin: -2.5mm 0 2mm; font-size: 8.5pt; color: #404040; }

.schp-table td.schp-tl, .schp-table th.schp-tlh { padding: 0; }
.schp-tlbox { position: relative; height: 4.6mm; overflow: hidden; }
.schp-tlh .schp-tlbox { height: 5mm; font-weight: 400; font-size: 8pt; }
.schp-tlbox .schp-mline { position: absolute; top: 0; bottom: 0; width: 0; border-left: 0.5pt solid #b3b3b3; }
.schp-tlh .schp-mline { border-left-color: #000; }
.schp-mlabel { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center;
  white-space: nowrap; overflow: hidden; }
.schp-mlabel-start { justify-content: flex-start; padding-left: 0.7mm; }
.schp-bar { position: absolute; display: block; border-radius: 0.4mm; }
.schp-bar-plan { top: 0.9mm; height: 1.9mm; background: ${CHART_COLORS.plan}; }
.schp-bar-actual { top: 3mm; height: 1.1mm; background: ${CHART_COLORS.actual}; }
.schp-tlkeys { display: flex; justify-content: center; gap: 4mm; font-weight: 400; font-size: 8pt; }

/* ── ปฏิทินงาน ── */
.schp-month { height: ${CAL_LAYOUT.pageHeight}mm; display: flex; flex-direction: column; overflow: hidden;
  break-inside: avoid; page-break-inside: avoid; font-size: 10pt; }
.schp-month + .schp-month { break-before: page; page-break-before: always; }
.schp-s90 { font-size: 9pt; }
.schp-s80 { font-size: 8pt; }
.schp-mhead { flex: none; display: grid; grid-template-columns: 1fr auto; column-gap: 6mm; row-gap: 0.6mm;
  align-items: end; margin-bottom: 2mm; }
.schp-mproj { font-size: 1em; }
.schp-mtitle { font-size: 1.6em; font-weight: 700; line-height: 1.25; }
.schp-mspan { text-align: right; font-size: 0.95em; }
.schp-msum { font-size: 0.95em; }
.schp-legend { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.6mm 3mm; font-size: 0.85em; }
.schp-legend span { display: inline-flex; align-items: center; gap: 1mm; white-space: nowrap; }
.schp-legend i { display: inline-block; width: 2.6mm; height: 2.6mm; border-radius: 0.4mm; }

.schp-grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  border-top: ${RULE}; border-left: ${RULE}; }
.schp-wd, .schp-cell { border-right: ${RULE}; border-bottom: ${RULE}; min-width: 0; min-height: 0; }
.schp-wd { background: #e6e6e6; text-align: center; font-weight: 700; font-size: 0.9em; padding: 0.4mm 0; }
.schp-cell { display: flex; flex-direction: column; gap: 0.35mm; padding: 0.6mm 0.8mm; overflow: hidden; background: #fff; }
.schp-cell.schp-out { background: #f7f7f7; }
.schp-cell.schp-off { background: #e9e9e9; color: #808080; }
.schp-dnum { font-weight: 700; font-size: 0.9em; line-height: 1.3; }
.schp-chip { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.78em;
  line-height: 1.45; padding: 0 0.8mm 0 1.4mm; border-radius: 0.5mm; color: #1f1f1f; }
.schp-chip b { font-weight: 600; color: #404040; }
.schp-more { font-size: 0.75em; line-height: 1.35; padding-left: 1.4mm; font-weight: 700; color: #404040; }
.schp-crew { margin-top: auto; font-size: 0.72em; line-height: 1.35; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; color: #262626; }

.schp-over { flex: none; margin-top: 2mm; }
.schp-over-title { font-weight: 700; font-size: 0.9em; margin-bottom: 0.8mm; }
.schp-over-cols { display: flex; gap: 3mm; align-items: flex-start; }
.schp-over-cols .schp-table { flex: 0 1 50%; width: auto; min-width: 0; font-size: 0.8em; }
.schp-over-cols.schp-over-3 .schp-table { flex-basis: 33.4%; }
.schp-over-cols .schp-table th, .schp-over-cols .schp-table td { padding: 0.2mm 1mm; }
.schp-over-cols td.schp-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.schp-ocrew { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.92em;
  line-height: 1.25; color: #404040; }
.schp-chip .schp-ccrew { color: #404040; }
.schp-swatch { display: inline-block; width: 2.2mm; height: 2.2mm; border-radius: 0.4mm; margin-right: 1mm; vertical-align: -0.2mm; }
`;

// ─── S-Curve ──────────────────────────────────────────────────────────────────

const VW = 1000;
const VH = 250;
const M = { left: 56, right: 16, top: 24, bottom: 36 };

/** "Nice" tick values covering [0, hi]. */
function ticksTo(hi: number, count = 4): number[] {
    const raw = hi / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = ([1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw)) ?? raw;
    const out: number[] = [];
    for (let v = 0; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
}

function SCurve({ m }: { m: SCurvePrintModel }) {
    const n = m.buckets.length;
    const plotW = VW - M.left - M.right;
    const bw = n > 0 ? plotW / n : plotW;
    const x = (i: number) => M.left + i * bw;
    const base = VH - M.bottom;
    const top = Math.max(1, ...m.plan, ...m.actual);
    const y = (v: number) => base - (v / top) * (base - M.top);
    const path = (vals: number[]) => [`M${M.left},${y(0)}`, ...vals.map((v, i) => `L${x(i + 1)},${y(v)}`)].join(' ');
    const pctLabel = (v: number | undefined) => (v === undefined ? '' : `${(v * 100).toFixed(0)}%`);
    const lastPlan = m.plan.length - 1;
    const lastActual = m.actual.length - 1;
    return (
        <svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={T.scurve}>
            {ticksTo(top).map(t => (
                <g key={t}>
                    <line x1={M.left} x2={VW - M.right} y1={y(t)} y2={y(t)} stroke="#d0d0d0" strokeWidth={0.8} />
                    <text x={M.left - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill="#404040">{pctLabel(t)}</text>
                </g>
            ))}
            {m.buckets.map((b, i) => (
                <g key={i}>
                    {b.week === 1 && <line x1={x(i)} x2={x(i)} y1={M.top} y2={base + 32} stroke="#9a9a9a" strokeWidth={0.8} />}
                    {bw >= 14 && <text x={x(i) + bw / 2} y={base + 12} fontSize={9} textAnchor="middle" fill="#595959">{b.weekLabel}</text>}
                    {b.week === 1 && (
                        <text x={x(i) + Math.min(2, n - i) * bw} y={base + 28} fontSize={12} textAnchor="middle" fill="#000">{b.monthLabel}</text>
                    )}
                </g>
            ))}
            <line x1={M.left} x2={VW - M.right} y1={base} y2={base} stroke="#000" strokeWidth={1} />
            <line x1={M.left} x2={M.left} y1={M.top} y2={base} stroke="#000" strokeWidth={1} />
            {n > 0 && <path d={path(m.plan)} fill="none" stroke={CHART_COLORS.plan} strokeWidth={2.2} strokeLinejoin="round" />}
            {m.actual.length > 0 && (
                <>
                    <path d={path(m.actual)} fill="none" stroke={CHART_COLORS.actual} strokeWidth={2.2} strokeLinejoin="round" />
                    <circle cx={x(lastActual + 1)} cy={y(m.actual[lastActual] ?? 0)} r={4} fill={CHART_COLORS.actual} />
                    <text x={x(lastActual + 1) + 6} y={y(m.actual[lastActual] ?? 0) - 8} fontSize={11} fill={CHART_COLORS.actual}
                        stroke="#fff" strokeWidth={3} paintOrder="stroke">
                        {T.actual} {pctLabel(m.actual[lastActual])}
                    </text>
                </>
            )}
            {lastPlan >= 0 && (
                <text x={x(lastPlan + 1) - 4} y={y(m.plan[lastPlan] ?? 0) - 7} fontSize={11} textAnchor="end" fill="#000">
                    {T.plan} {pctLabel(m.plan[lastPlan])}
                </text>
            )}
        </svg>
    );
}

// ─── Gantt table ──────────────────────────────────────────────────────────────

const GANTT_COLS = 9;
const pctStyle = (b: TimelineBar) => ({ left: `${(b.left * 100).toFixed(3)}%`, width: `${(b.width * 100).toFixed(3)}%` });

function MonthLines({ months }: { months: TimelineMonth[] }) {
    return <>{months.slice(1).map(m => <i key={m.label} className="schp-mline" style={{ left: `${(m.left * 100).toFixed(3)}%` }} />)}</>;
}

function TaskRow({ t, months }: { t: GanttPrintTask; months: TimelineMonth[] }) {
    return (
        <tr>
            <td className="schp-c">{t.id}</td>
            <td>{t.name}</td>
            <td className="schp-c">{t.installment}</td>
            <td className="schp-num">{t.duration}</td>
            <td className="schp-c">{t.start}</td>
            <td className="schp-c">{t.finish}</td>
            <td className="schp-num">{t.budget}</td>
            <td className="schp-num">{t.weight}</td>
            <td className="schp-tl">
                <div className="schp-tlbox">
                    <MonthLines months={months} />
                    {t.plan && <b className="schp-bar schp-bar-plan" style={pctStyle(t.plan)} />}
                    {t.actual && <b className="schp-bar schp-bar-actual" style={pctStyle(t.actual)} />}
                </div>
            </td>
        </tr>
    );
}

function InstallmentRow({ inst, months }: { inst: GanttPrintInstallment; months: TimelineMonth[] }) {
    const c = installmentColors(inst.no);
    return (
        <tr className="schp-inst">
            <td className="schp-c" style={c}>{inst.no}.0</td>
            <td colSpan={5} style={c}>{inst.label}{inst.finish !== '' ? ` · ${T.finishOn} ${inst.finish}` : ''}</td>
            <td className="schp-num schp-fill">{inst.budget}</td>
            <td className="schp-num schp-fill">{inst.weight}</td>
            <td className="schp-tl"><div className="schp-tlbox"><MonthLines months={months} /></div></td>
        </tr>
    );
}

/** One installment as <tbody> blocks: its heading kept with the first task; the total kept with the last task. */
function InstallmentBlocks({ inst, months, total }: { inst: GanttPrintInstallment; months: TimelineMonth[]; total?: ReactNode }) {
    const [first, ...rest] = inst.tasks;
    const last = total !== undefined && rest.length > 0 ? rest.pop() : undefined;
    return (
        <>
            <tbody className="schp-keep">
                <InstallmentRow inst={inst} months={months} />
                {first && <TaskRow t={first} months={months} />}
                {total !== undefined && last === undefined && total}
            </tbody>
            {rest.length > 0 && <tbody>{rest.map(t => <TaskRow key={t.id} t={t} months={months} />)}</tbody>}
            {last !== undefined && (
                <tbody className="schp-keep">
                    <TaskRow t={last} months={months} />
                    {total}
                </tbody>
            )}
        </>
    );
}

function GanttTable({ model }: { model: GanttPrintModel }) {
    const months = model.timeline.months;
    const total = (
        <tr className="schp-total">
            <td />
            <td colSpan={5} className="schp-c">{T.total}</td>
            <td className="schp-num">{model.totalBudget}</td>
            <td className="schp-num">{model.totalWeight}</td>
            <td />
        </tr>
    );
    const n = model.installments.length;
    return (
        <table className="schp-table">
            <colgroup>
                <col style={{ width: '4.5%' }} />
                <col />
                <col style={{ width: '3.8%' }} />
                <col style={{ width: '6.4%' }} />
                <col style={{ width: '7.4%' }} />
                <col style={{ width: '7.4%' }} />
                <col style={{ width: '9.4%' }} />
                <col style={{ width: '6.2%' }} />
                <col style={{ width: '34%' }} />
            </colgroup>
            <thead>
                <tr>
                    <th rowSpan={2}>{T.colNo}</th>
                    <th rowSpan={2}>{T.colTask}</th>
                    <th rowSpan={2}>{T.colInstallment}</th>
                    <th rowSpan={2}>{T.colDuration}<br />{T.unitDays}</th>
                    <th rowSpan={2}>{T.colStart}</th>
                    <th rowSpan={2}>{T.colFinish}</th>
                    <th rowSpan={2}>{T.colBudget}<br />{T.unitBaht}</th>
                    <th rowSpan={2}>{T.colWeight}</th>
                    <th>
                        <div className="schp-tlkeys">
                            <span className="schp-key"><i className="schp-box" style={{ background: CHART_COLORS.plan }} />{T.plan}</span>
                            <span className="schp-key"><i className="schp-box" style={{ background: CHART_COLORS.actual }} />{T.actual}</span>
                        </div>
                    </th>
                </tr>
                <tr>
                    <th className="schp-tlh">
                        <div className="schp-tlbox">
                            {/* header rules only between labels, so none runs through a label that spans months */}
                            <MonthLines months={months.filter(m => m.showLabel)} />
                            {months.map(m => m.showLabel && (
                                // a label standing for several months starts at its own month, so it reads as that month
                                <span key={m.label} className={m.labelWidth > m.width + 1e-9 ? 'schp-mlabel schp-mlabel-start' : 'schp-mlabel'}
                                    style={{ left: `${(m.left * 100).toFixed(3)}%`, width: `${(m.labelWidth * 100).toFixed(3)}%` }}>{m.label}</span>
                            ))}
                        </div>
                    </th>
                </tr>
            </thead>
            {!model.hasTasks && (
                <tbody><tr className="schp-empty"><td colSpan={GANTT_COLS}>{T.noTasks}</td></tr></tbody>
            )}
            {model.installments.map((inst, i) => (
                <InstallmentBlocks key={inst.no} inst={inst} months={months} total={i === n - 1 ? total : undefined} />
            ))}
            {n === 0 && <tbody>{total}</tbody>}
        </table>
    );
}

/** Gantt + S-Curve: header block, the S-curve, the task table with its timeline. */
export function GanttPrintDocument({ model }: { model: GanttPrintModel }) {
    return (
        <div className={R} lang="th">
            <style>{CSS}</style>
            <section className="schp-gantt">
                <div className="schp-lead">
                    <h1 className="schp-title">{model.title}</h1>
                    <div className="schp-fields">
                        {model.fields.map(f => (
                            <div key={f.label} className="schp-field">
                                <span className="schp-label">{f.label}</span>
                                <span className="schp-value">{f.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="schp-chart">
                        <div className="schp-chart-head">
                            <b>{T.scurve}</b>
                            <span className="schp-key"><i style={{ background: CHART_COLORS.plan }} />{T.planCum}</span>
                            <span className="schp-key"><i style={{ background: CHART_COLORS.actual }} />{T.actualCum}</span>
                        </div>
                        <SCurve m={model.scurve} />
                    </div>
                    {/* Above the table: below it, a full last page would push the note onto a page of its own. */}
                    <div className="schp-note">{T.ganttNote}</div>
                </div>
                <GanttTable model={model} />
            </section>
        </div>
    );
}

// ─── ปฏิทินงาน ──────────────────────────────────────────────────────────────

const tint = (hex: string) => `${hex}2e`;
export const OVERFLOW_COLS = 6;

function DayCell({ c }: { c: CalendarPrintCell }) {
    if (!c.inMonth) return <div className="schp-cell schp-out" />;
    return (
        <div className={c.inPlan ? 'schp-cell' : 'schp-cell schp-off'}>
            <div className="schp-dnum">{c.day}</div>
            {c.tasks.map(t => {
                const bg = installmentColors(t.installment).background;
                return (
                    <span key={t.id} className="schp-chip" style={{ background: tint(bg), boxShadow: `inset 0.7mm 0 0 ${bg}` }}>
                        <b>{t.id}</b> {t.name}
                        {c.crews[t.id] !== undefined && <span className="schp-ccrew"> · {c.crews[t.id]}</span>}
                    </span>
                );
            })}
            {c.hidden > 0 && <span className="schp-more">+{c.hidden} {T.more}</span>}
            {c.total > 0 && <span className="schp-crew">{crewText(c.skilled, c.labourers)}</span>}
        </div>
    );
}

function OverflowTables({ m }: { m: CalendarPrintMonth }) {
    const per = Math.ceil(m.overflow.length / m.overflowColumns);
    const columns = Array.from({ length: m.overflowColumns }, (_, i) => m.overflow.slice(i * per, i * per + per))
        .filter(c => c.length > 0);
    return (
        <div className="schp-over">
            <div className="schp-over-title">{T.overflowTitle} ({m.overflow.length} {T.tasksUnit})</div>
            <div className={m.overflowColumns === 3 ? 'schp-over-cols schp-over-3' : 'schp-over-cols'}>
                {columns.map((rows, i) => (
                    <table key={i} className="schp-table">
                        <colgroup>
                            <col style={{ width: '9%' }} />
                            <col />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '27%' }} />
                            <col style={{ width: '8%' }} />
                            <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>{T.colNo}</th><th>{T.colTask}</th><th>{T.colInstallment}</th>
                                <th>{T.colRange}</th><th>{T.colSkilled}</th><th>{T.colLabourers}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(t => (
                                <tr key={t.id}>
                                    <td className="schp-c">{t.id}</td>
                                    <td className="schp-name">
                                        <i className="schp-swatch" style={{ background: installmentColors(t.installment).background }} />{t.name}
                                        {m.overflowCrews[t.id] !== undefined && <span className="schp-ocrew">{m.overflowCrews[t.id]}</span>}
                                    </td>
                                    <td className="schp-c">{t.installment}</td>
                                    <td className="schp-c">{formatDate(t.start)}{t.finish !== t.start ? ` – ${formatDate(t.finish)}` : ''}</td>
                                    <td className="schp-num">{t.skilled}</td>
                                    <td className="schp-num">{t.labourers}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
            </div>
        </div>
    );
}

const scaleClass = (s: number) => (s === 1 ? '' : s >= 0.9 ? ' schp-s90' : ' schp-s80');

function MonthPage({ m, model }: { m: CalendarPrintMonth; model: CalendarPrintModel }) {
    const rows = m.weeks.length;
    return (
        <section className={`schp-month${scaleClass(m.scale)}`} data-month={m.value}>
            <header className="schp-mhead">
                <div className="schp-mproj">{T.calendarTitle}{model.projectName !== '' ? ` · ${model.projectName}` : ''}</div>
                <div className="schp-mspan">{T.planSpan} {formatDate(model.start)} – {formatDate(model.finish)}</div>
                <div className="schp-mtitle">{m.title}</div>
                <div className="schp-legend">
                    {model.legend.map(l => (
                        <span key={l.no}><i style={{ background: installmentColors(l.no).background }} />{l.label}</span>
                    ))}
                </div>
                <div className="schp-msum">{monthSummaryText(m)}</div>
                <div className="schp-mspan">{T.calendarNote}{model.hasCrews ? ` · ${T.calendarCrewNote}` : ''}</div>
            </header>
            <div className="schp-grid" style={{ gridTemplateRows: `auto repeat(${rows}, minmax(0, 1fr))` }}>
                {WEEKDAYS.map(w => <div key={w} className="schp-wd">{w}</div>)}
                {m.weeks.flat().map(c => <DayCell key={c.iso} c={c} />)}
            </div>
            {m.overflow.length > 0 && <OverflowTables m={m} />}
        </section>
    );
}

/** ปฏิทินงาน: one landscape page per month of the model. */
export function CalendarPrintDocument({ model }: { model: CalendarPrintModel }) {
    return (
        <div className={R} lang="th">
            <style>{CSS}</style>
            {model.months.map(m => <MonthPage key={m.value} m={m} model={model} />)}
        </div>
    );
}
