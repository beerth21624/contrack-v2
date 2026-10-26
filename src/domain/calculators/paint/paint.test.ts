import { describe, expect, it } from 'vitest';
import {
    paint, paintAreas, paintLinkedSources, paintSuggestions, applyPaintSuggestions, pendingPaintSuggestions, PAINT_LINES,
} from '.';
import { plaster } from '../plaster';
import { roofing } from '../roofing';
import { ceiling } from '../ceiling';
import { wallFinishing } from '../wall-finishing';
import type { CalcContext } from '../types';
import { computeProject, createProject } from '../../project';
import golden from '../../boq/__tests__/golden.v5.json';
import type { BoqItemRow } from '../../boq/types';

const none: CalcContext = { outputs: () => undefined };
const goldenLines: Record<string, { E?: number; M?: number } | undefined> = golden.lines;
const goldenSections: Record<string, { J: number; L: number; M: number } | undefined> = golden.sections;

const must = (v: number | undefined): number => {
    if (v === undefined) throw new Error('missing golden value');
    return v;
};
const E = (row: string) => must(goldenLines[row]?.E);
const M = (row: string) => must(goldenLines[row]?.M);

/** Excel cached C5…C13. */
const EXCEL_C = [191.8225, 314.7825, 37.38, 92.54055467, 19.5, 8.1, 9.8, 14.536, 506.605];

describe('ทาสี_Paint (sheet 19)', () => {
    it('Excel sample: C5…C13 (no source calculators → Excel numbers)', () => {
        const areas = paintAreas(paint.defaults(), none);
        PAINT_LINES.forEach((l, i) => expect(areas[l.key]).toBeCloseTo(must(EXCEL_C[i]), 9));
        // Hard-coded formulas reproduce Excel exactly.
        expect(areas.wallSlat).toBe(3.3 + 4.8);
        expect(areas.moulding).toBe((0.5 * 13) + (0.3 * 11));
        expect(areas.fascia).toBe(63.2 * 0.23);
    });

    it('outputs equal BOQ E of §23 R223–R231, §25 R245–R252, §31 R300–R307', () => {
        const out = paint.compute(paint.defaults(), none);
        const rows = PAINT_LINES.flatMap(l => l.boq);
        expect(rows).toHaveLength(9 + 8 + 8);
        for (const row of rows) expect(out[row]).toBeCloseTo(E(row), 9);
        expect(paint.boqLinks.map(l => l.line)).toEqual(rows);
        expect(paint.boqLinks.every(l => l.field === 'qty' && l.output === l.line)).toBe(true);
    });

    it('sections 23 / 25 / 31 equal Excel (prices from the BOQ template, incl. เชิงชาย 50 vs 20)', () => {
        const { boq } = computeProject(createProject(), [paint]);
        for (const no of [23, 25, 31]) {
            const s = boq.sections.find(x => x.no === no);
            const g = goldenSections[no];
            expect(s?.matTotal).toBeCloseTo(must(g?.J), 4);
            expect(s?.labTotal).toBeCloseTo(must(g?.L), 4);
            expect(s?.total).toBeCloseTo(must(g?.M), 4);
        }
        const r230 = boq.sections.find(x => x.no === 23)?.rows.find(r => r.key === 'R230') as BoqItemRow;
        const r252 = boq.sections.find(x => x.no === 25)?.rows.find(r => r.key === 'R252') as BoqItemRow;
        expect(r230.total).toBeCloseTo(M('R230'), 6);   // เชิงชาย §23: mat 50
        expect(r252.total).toBeCloseTo(M('R252'), 6);   // เชิงชาย §25: mat 20 (O-10)
    });

    it('with the plaster calculator linked, C5 / C6 / C13 take its outputs and the BOQ follows', () => {
        // Plaster outputs of the Excel sample (stubbed: brick / door-window are built in parallel).
        const ctx: CalcContext = { outputs: id => (id === 'plaster' ? { exterior: 191.8225, interior: 314.7825 } : undefined) };
        const out = paint.compute(paint.defaults(), ctx);
        expect(out.R223).toBe(191.8225);
        expect(out.R224).toBe(314.7825);
        expect(out.R231).toBeCloseTo(E('R231'), 9);
        // End-to-end: a project with plaster registered feeds the same outputs into §23.
        const { calcOutputs } = computeProject(createProject(), [plaster, paint]);
        const ext = must(calcOutputs.plaster?.exterior);
        const int = must(calcOutputs.plaster?.interior);
        expect(calcOutputs.paint?.R223).toBe(ext);
        expect(calcOutputs.paint?.R231).toBeCloseTo(ext + int, 9);
    });

    it('source values are used when present (0 is a real value)', () => {
        const ctx: CalcContext = {
            outputs: id => ({
                plaster: { exterior: 100, interior: 200 },
                ceiling: { 'paint.ภายนอก': 10, 'paint.ภายใน': 0, 'paint.ไม้ระแนง': 5 },
            } as Record<string, Record<string, number>>)[id],
        };
        const out = paint.compute(paint.defaults(), ctx);
        expect(out.R223).toBe(100);
        expect(out.R301).toBe(200);
        expect(out.R231).toBe(300);
        expect(out.R225).toBe(10);
        expect(out.R248).toBe(0);
        expect(out.R304).toBe(5);
        expect(out.R228).toBeCloseTo(8.1, 9);   // hand-typed lines unchanged
        expect(paintLinkedSources(ctx)).toEqual({ plaster: true, ceilingExterior: true, ceilingInterior: true, ceilingSlat: true });
        expect(paintLinkedSources(none)).toEqual({ plaster: false, ceilingExterior: false, ceilingInterior: false, ceilingSlat: false });
    });

    it('editing slat / moulding / fascia inputs (added moulding row computes)', () => {
        const input = paint.defaults();
        input.slatWallArea = 12;
        input.mouldings.push({ size: '', girth: 0.4, length: 5 });
        input.fasciaLength = 62.3;
        const out = paint.compute(input, none);
        expect(out.R250).toBe(12);
        expect(out.R229).toBeCloseTo(9.8 + 2, 9);
        expect(out.R306).toBeCloseTo(11.8, 9);
        expect(out.R230).toBeCloseTo(14.329, 9);
        expect(out.R307).toBeCloseTo(14.329, 9);
    });

    it('suggestions from wall-finishing / roofing (decision D20 pending — not applied automatically)', () => {
        expect(paintSuggestions(none).fasciaLength).toBeUndefined();
        const roofOut = roofing.compute(roofing.defaults(), none);
        const ctx: CalcContext = {
            outputs: id => (id === 'roofing' ? roofOut
                : id === 'wall-finishing' ? { slatWallArea: 8.1, 'moulding.0.3': 13, 'moulding.0.1': 11 } : undefined),
        };
        const s = paintSuggestions(ctx);
        expect(s.fasciaLength).toBeCloseTo(62.3, 9);
        expect(s.slatWallArea).toBe(8.1);
        expect(s.mouldingLength('0.3')).toBe(13);
        expect(s.mouldingLength('0.1')).toBe(11);
        expect(s.mouldingLength('')).toBeUndefined();
        // Defaults stay Excel's 63.2 even when roofing says 62.3.
        expect(paint.compute(paint.defaults(), ctx).R230).toBeCloseTo(14.536, 9);
    });

    it('blank(): hand-typed areas 0, girths and fascia height kept; with empty sources every BOQ line is 0', () => {
        const input = paint.blank?.();
        expect(input).toBeDefined();
        if (!input) return;
        expect(input).toEqual({
            slatWallArea: 0,
            mouldings: [{ size: '0.3', girth: 0.5, length: 0 }, { size: '0.1', girth: 0.3, length: 0 }],
            fasciaLength: 0,
            fasciaHeight: 0.23,
        });
        // Sources of a blank project: ceiling / wall-finishing blanks, plaster with no walls yet.
        const sources: Record<string, Record<string, number> | undefined> = {
            plaster: { exterior: 0, interior: 0 },
            ceiling: ceiling.compute(must2(ceiling.blank?.()), none),
            'wall-finishing': wallFinishing.compute(must2(wallFinishing.blank?.()), none),
        };
        const ctx: CalcContext = { outputs: id => sources[id] };
        const out = paint.compute(input, ctx);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
        for (const l of paint.boqLinks) expect(out[l.output], l.line).toBe(0);
        expect(pendingPaintSuggestions(input, paintSuggestions(ctx))).toBe(0);
    });

    it('a blank project: every finishes-level BOQ line (§19–23, 25, 31) is 0', () => {
        const { calcOutputs, boq } = computeProject(createProject('blank'));
        for (const l of paint.boqLinks) expect(calcOutputs.paint?.[l.output], l.line).toBe(0);
        for (const no of [19, 20, 22, 23, 25, 31]) expect(boq.sections.find(s => s.no === no)?.total, `§${no}`).toBe(0);
        for (const k of ['R210', 'R211']) expect(calcOutputs['toilet-tile']?.[k], k).toBe(0);
    });

    it('applyPaintSuggestions takes every source value at once (and only where a source has one)', () => {
        const input = must2(paint.blank?.());
        const roofOut = roofing.compute(roofing.defaults(), none);
        const ctx: CalcContext = {
            outputs: id => (id === 'roofing' ? roofOut
                : id === 'wall-finishing' ? { slatWallArea: 8.1, 'moulding.0.3': 13, 'moulding.0.1': 11 } : undefined),
        };
        const s = paintSuggestions(ctx);
        expect(pendingPaintSuggestions(input, s)).toBe(4);
        const applied = applyPaintSuggestions({ ...input, mouldings: [...input.mouldings, { size: '', girth: 0.4, length: 5 }] }, s);
        expect(applied.slatWallArea).toBe(8.1);
        expect(applied.mouldings.map(m => m.length)).toEqual([13, 11, 5]);
        expect(applied.fasciaLength).toBeCloseTo(62.3, 9);
        expect(pendingPaintSuggestions(applied, s)).toBe(0);
        const out = paint.compute(applied, ctx);
        expect(out.R228).toBe(8.1);
        expect(out.R229).toBeCloseTo(9.8 + 2, 9);
        expect(out.R230).toBeCloseTo(62.3 * 0.23, 9);
        // No sources → nothing changes.
        expect(applyPaintSuggestions(input, paintSuggestions(none))).toEqual(input);
    });
});

function must2<T>(v: T | undefined): T {
    if (v === undefined) throw new Error('missing blank()');
    return v;
}
