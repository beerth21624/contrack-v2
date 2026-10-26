import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { buildBoqPrintModel } from '../boq-print-model';
import { BoqPrintDocument } from '../BoqPrintDocument';

describe('BoqPrintDocument', () => {
    it('renders the summary, the separate pre-construction cost and the detailed list', () => {
        const project = createProject('sample');
        const model = buildBoqPrintModel(computeProject(project).boq, { ...project.meta, ownerName: 'คุณสมชาย' });
        const html = renderToStaticMarkup(createElement(BoqPrintDocument, { model }));
        expect(html).toContain('ใบประมาณราคาค่าก่อสร้าง (BOQ)');
        expect(html).toContain('สรุปราคาตามหมวดงาน');
        expect(html).toContain('ค่าใช้จ่ายก่อนก่อสร้าง (ไม่รวมในต้นทุนก่อสร้าง)');
        expect(html).toContain('รายละเอียดราคา (BOQ)');
        expect(html).toContain('เจ้าของบ้าน (คุณสมชาย)');
        expect(html).toContain(model.constructionTotalText);
        expect(html).toContain('ดินถม (ตามสเปค) + บดอัด');
        expect(html).not.toContain('NaN');
    });

    it('renders a blank project', () => {
        const blank = createProject('blank');
        const html = renderToStaticMarkup(createElement(BoqPrintDocument, {
            model: buildBoqPrintModel(computeProject(blank).boq, blank.meta),
        }));
        expect(html).not.toContain('NaN');
    });
});
