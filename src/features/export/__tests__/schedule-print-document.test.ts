import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { buildCalendarPrintModel, buildGanttPrintModel, calendarMonthOptions } from '../schedule-print-model';
import { CalendarPrintDocument, GanttPrintDocument, OVERFLOW_COLS } from '../SchedulePrintDocument';
import { computeCrewCalendar } from '@/domain/planning';

const { schedule, manday } = computeProject(createProject('sample')).planning;

/** Cells of a row, counting colSpan. */
const width = (row: string) => [...row.matchAll(/<t[dh](?:\s[^>]*)?>/g)]
    .reduce((a, m) => a + Number(/colSpan="(\d+)"/i.exec(m[0])?.[1] ?? 1), 0);
const tables = (html: string) => html.split('<table').slice(1).map(t => t.split('</table>')[0] ?? '');
const bodyRows = (table: string) => (table.split('</thead>')[1] ?? '').split('<tr').slice(1);

describe('GanttPrintDocument', () => {
    const model = buildGanttPrintModel(schedule, '2026-10-26');
    const html = renderToStaticMarkup(createElement(GanttPrintDocument, { model }));

    it('header, S-curve and every task', () => {
        for (const label of ['ชื่อโครงการ', 'วันเริ่มโครงการ', 'วันเสร็จโครงการ', 'ระยะเวลา', 'งบประมาณโครงการ', 'วันที่พิมพ์']) {
            expect(html).toContain(label);
        }
        expect(html).toContain('26/10/2026');
        expect(html).toContain('<svg');
        expect(html).toContain('S-Curve แผนงานเทียบผลงาน (สะสม)');
        for (const t of schedule.tasks) expect(html).toContain(`<td class="schp-c">${t.id}</td>`);
        for (const col of ['ลำดับ', 'งาน', 'งวด', 'ระยะเวลา', 'เริ่ม', 'เสร็จ', 'งบ', '% น้ำหนัก']) expect(html).toContain(`<th rowSpan="2">${col}`);
        expect(html).toContain('รวมทั้งโครงการ');
        expect(html).not.toContain('NaN');
        expect(html).not.toContain('undefined');
    });

    it('every table row has the full column count; headers repeat, rows are kept whole', () => {
        const [table] = tables(html);
        if (!table) throw new Error('no table');
        const rows = bodyRows(table);
        expect(rows.length).toBe(schedule.tasks.length + schedule.installments.length + 1);
        for (const row of rows) expect(width(row)).toBe(9);
        // header: 8 cells spanning two rows + the timeline's two cells
        const head = table.split('</thead>')[0] ?? '';
        expect(width(head.split('<tr')[1] ?? '')).toBe(9);
        expect(html).toContain('display: table-header-group');
        expect(html).toContain('break-inside: avoid');
        expect(html).toContain('table-layout: fixed');
        // each งวด heading is kept with its first task
        const blocks = html.split('<tbody').slice(1);
        for (const b of blocks.filter(x => x.includes('schp-inst'))) {
            expect(b.startsWith(' class="schp-keep"')).toBe(true);
            expect((b.split('</tbody>')[0] ?? '').split('<tr').length - 1).toBeGreaterThanOrEqual(2);
        }
    });

    it('print CSS: landscape A4, page numbers, exact colours, 0.5pt black rules', () => {
        expect(html).toContain('size: A4 landscape');
        expect(html).toContain('counter(page) "/" counter(pages)');
        expect(html).toContain('print-color-adjust: exact');
        expect(html).toContain('0.5pt solid #000');
        expect(html).toContain('แผ่นที่');
    });
});

describe('CalendarPrintDocument', () => {
    const render = (months?: string[]) => {
        const model = buildCalendarPrintModel(schedule, manday, months);
        return { model, html: renderToStaticMarkup(createElement(CalendarPrintDocument, { model })) };
    };

    it('one page section per month (default: all months of the plan)', () => {
        const { model, html } = render();
        const all = calendarMonthOptions(computeCrewCalendar(schedule, manday));
        expect(model.months).toHaveLength(all.length);
        expect(html.match(/<section class="schp-month/g)).toHaveLength(all.length);
        for (const o of all) expect(html).toContain(`data-month="${o.value}"`);
        for (const o of all) expect(html).toContain(`>${o.label}<`);
    });

    it('a subset prints only those months', () => {
        const all = calendarMonthOptions(computeCrewCalendar(schedule, manday));
        const pick = [all[0]?.value ?? '', all[2]?.value ?? ''];
        const { html } = render(pick);
        expect(html.match(/<section class="schp-month/g)).toHaveLength(2);
        expect(html).not.toContain(`data-month="${all[1]?.value ?? ''}"`);
    });

    it('each month: 7 weekday headers and whole weeks of day cells; legend; summary', () => {
        const { model, html } = render();
        const pages = html.split('<section').slice(1);
        pages.forEach((p, i) => {
            const m = model.months[i];
            if (!m) throw new Error('page without month');
            expect(p.match(/class="schp-wd"/g)).toHaveLength(7);
            expect(p.match(/class="schp-cell/g)).toHaveLength(m.weeks.length * 7);
            expect(p).toContain('งวดที่ 8');
            expect(p).toContain('class="schp-msum"');
        });
        expect(html).toContain('ช่าง ');
        expect(html).toContain('วันจันทร์');
        expect(html).not.toContain('NaN');
    });

    it('overflow tables: every row has the full column count', () => {
        const ids = schedule.tasks.map(t => t.id);
        // a crowded month: every task on the same days (shift the sample's own tasks)
        const crowded = {
            ...schedule,
            tasks: schedule.tasks.map(t => ({ ...t, start: '2026-03-02', finish: '2026-03-20', duration: 19 })),
        };
        const model = buildCalendarPrintModel(crowded, manday);
        const html = renderToStaticMarkup(createElement(CalendarPrintDocument, { model }));
        const m = model.months[0];
        expect(m?.overflow.length).toBe(ids.length - (m?.chipLimit ?? 0));
        expect(html).toContain(`+${ids.length - (m?.chipLimit ?? 0)} งาน`);
        const ts = tables(html);
        expect(ts.length).toBe(m?.overflowColumns);
        let rows = 0;
        for (const t of ts) {
            expect(width((t.split('</thead>')[0] ?? '').split('<tr')[1] ?? '')).toBe(OVERFLOW_COLS);
            for (const row of bodyRows(t)) { expect(width(row)).toBe(OVERFLOW_COLS); rows++; }
        }
        expect(rows).toBe(m?.overflow.length);
        expect(html.match(/<section class="schp-month/g)).toHaveLength(1);
    });

    it('print CSS keeps a month on one fixed-height page and starts each on a new page', () => {
        const { html } = render();
        expect(html).toMatch(/\.schp-month \{ height: \d+mm;/);
        expect(html).toContain('.schp-month + .schp-month { break-before: page;');
        expect(html).toContain('size: A4 landscape');
    });
});
