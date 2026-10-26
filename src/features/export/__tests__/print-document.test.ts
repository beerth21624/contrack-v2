import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { buildBoqPrintModel, fmtMoney } from '../boq-print-model';
import { BoqPrintDocument } from '../BoqPrintDocument';

const project = createProject('sample');
const model = buildBoqPrintModel(computeProject(project).boq, { ...project.meta, ownerName: 'คุณสมชาย' });
const render = (part?: 'all' | 'summary' | 'detail') =>
    renderToStaticMarkup(createElement(BoqPrintDocument, { model, part }));

describe('BoqPrintDocument', () => {
    const html = render();

    it('renders the ปร.5 summary: header block, totals in figures and words, Factor F line, section 0, signatures', () => {
        expect(html).toContain('รูปแบบตามแบบ ปร.5');
        expect(html).toContain('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
        for (const label of ['ชื่อโครงการ', 'สถานที่ก่อสร้าง', 'เจ้าของ/หน่วยงาน', 'แบบเลขที่', 'ประมาณราคาโดย', 'เมื่อวันที่']) {
            expect(html).toContain(label);
        }
        expect(html).toContain('คุณสมชาย');
        expect(html).toContain('รายการ (หมวดงาน)');
        expect(html).toContain('รวมค่างานต้นทุน');
        expect(html).toContain(fmtMoney(model.constructionTotal));
        expect(html).toContain(`(ตัวอักษร ${model.constructionTotalText})`);
        expect(html).toContain('Factor F (ถ้ามี)');
        expect(html).toContain('ค่าใช้จ่ายก่อนการก่อสร้าง (ไม่รวมในค่างานต้นทุน)');
        for (const role of ['ผู้ประมาณราคา', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']) expect(html).toContain(role);
        expect(html).toContain('ลงชื่อ');
        expect(html).toContain('ตำแหน่ง');
    });

    it('renders the ปร.4 detail: split money columns, section sub-totals, grand total', () => {
        expect(html).toContain('รูปแบบตามแบบ ปร.4');
        expect(html).toContain('แบบแสดงรายการ ปริมาณงาน และราคา');
        expect(html).toContain('ราคาต่อหน่วย');
        expect(html).toContain('จำนวนเงิน');
        expect(html).toContain('รวมค่าวัสดุและค่าแรงงาน');
        expect(html).toContain('ดินถม (ตามสเปค) + บดอัด');
        for (const s of model.details) expect(html).toContain(`>รวมหมวดที่ ${s.no}<`);
        expect(html).toContain('รวมหมวดที่ 0 (ไม่รวมในค่างานต้นทุน)');
        expect(html).not.toContain('NaN');
    });

    it('print CSS: A4 named pages, 0.5pt black rules, repeated headers, rows kept whole, page numbers', () => {
        expect(html).toContain('@page boqp-portrait { size: A4 portrait; }');
        expect(html).toContain('@page boqp-landscape { size: A4 landscape; }');
        expect(html).toContain('margin: 20mm');
        expect(html).toContain('0.5pt solid #000');
        expect(html).toContain('display: table-header-group');
        expect(html).toContain('break-inside: avoid');
        expect(html).toContain('counter(page) "/" counter(pages)');
        expect(html).toContain('table-layout: fixed');
        // black and greys only
        const colours = html.match(/#[0-9a-f]{3,6}\b/gi) ?? [];
        for (const c of colours) {
            const hex = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1);
            expect(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6)).toBe(true);
        }
    });

    it('prints one form on its own', () => {
        const summary = render('summary');
        expect(summary).toContain('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
        expect(summary).not.toContain('แบบแสดงรายการ ปริมาณงาน และราคา');
        const detail = render('detail');
        expect(detail).toContain('แบบแสดงรายการ ปริมาณงาน และราคา');
        expect(detail).not.toContain('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
    });

    it('every table row has the full column count (no misaligned rows)', () => {
        const tables = html.split('<table').slice(1).map(t => t.split('</table>')[0] ?? '');
        expect(tables).toHaveLength(2);
        const width = (row: string) => [...row.matchAll(/<td(?:\s[^>]*)?>/g)]
            .reduce((a, m) => a + Number(/colSpan="(\d+)"/i.exec(m[0])?.[1] ?? 1), 0);
        tables.forEach((t, i) => {
            const cols = i === 0 ? 6 : 10;
            const body = t.split('</thead>')[1] ?? '';
            const rows = body.split('<tr').slice(1);
            expect(rows.length).toBeGreaterThan(3);
            for (const row of rows) expect(width(row)).toBe(cols);
        });
    });

    it('renders a blank project', () => {
        const blank = createProject('blank');
        const out = renderToStaticMarkup(createElement(BoqPrintDocument, {
            model: buildBoqPrintModel(computeProject(blank).boq, blank.meta),
        }));
        expect(out).not.toContain('NaN');
        expect(out).toContain('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
    });
});
