import { describe, expect, it } from 'vitest';
import { createPackageRequestSchema, type VendorListEntryDto } from '@/shared/contract';
import { computeProject, createProject } from '@/domain/project';
import { tasksOfTrade } from '@/domain/subcontracting/trades';
import {
    TEMPLATES, applyTemplate, buildRequest, changeTrade, customLinesComplete, effectiveKeys, estimateTotal, groupRows,
    heldLines, initialDraft, inviteeProblem, issueText, isStandardRetention, labourEstimate, questionsOf, scheduleFromPlan,
    sendProblems, sortVendors, titleOf, titleRevealsProject, toggleInvitee, toggleKeys, wizardRows, type Draft,
} from '../wizard/state';

const result = computeProject(createProject('sample'));
const boq = result.boq;
const tasks = result.planning.schedule.tasks;
const now = new Date(2026, 9, 26, 10, 0, 0);

const settings = {
    defaultRetentionPct: 0.05, defaultWarrantyMonths: 12, defaultWhtPct: 0.03, estimatorCanAward: false,
    estimatorCanApproveClaims: false, viewerSeesPrices: true, levelingThreshold: 0.2, fixesBlockNextClaim: false,
    contractTemplateHtml: '',
};

function draftFor(trade: Draft['trade'], section: number | null = null): Draft {
    return initialDraft({ trade, section, boq, settings, province: 'นนทบุรี', address: '12 ถ.ติวานนท์ นนทบุรี', now });
}

const vendor = (over: Partial<VendorListEntryDto>): VendorListEntryDto => ({
    id: '00000000-0000-4000-8000-000000000001', displayName: 'ทีม', phone: '+66812345678', lineId: '', trades: [],
    province: '', privateNote: '', vendorWorkspaceId: null, hasAccount: false, tier: null, profileComplete: false,
    lastEngagedAt: null, ratingFromUs: null, completedWithUs: 0, hidden: false, createdAt: '2026-10-01T00:00:00Z', ...over,
});

describe('wizard rows', () => {
    it('lists only rows of the chosen trades, in BOQ order', () => {
        const rows = wizardRows(boq, ['structure']);
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.every(r => r.trade === 'structure')).toBe(true);
        const orders = rows.map(r => r.order);
        expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    });

    it('labour estimate is BOQ L (K × the labour quantity)', () => {
        for (const r of wizardRows(boq, ['structure', 'electrical'])) {
            expect(labourEstimate(r.row)).toBeCloseTo(r.row.labTotal, 2);
        }
    });

    it('hides zero-quantity rows unless shown or ticked', () => {
        const rows = wizardRows(computeProject(createProject('blank')).boq, ['structure']);
        const zero = rows.find(r => r.row.qty === 0);
        expect(zero).toBeDefined();
        if (zero === undefined) return;
        const visible = (g: ReturnType<typeof groupRows>) => g.flatMap(x => x.rows.map(r => r.row.key));
        expect(visible(groupRows(rows, false, new Set()))).not.toContain(zero.row.key);
        expect(visible(groupRows(rows, true, new Set()))).toContain(zero.row.key);
        expect(visible(groupRows(rows, false, new Set([zero.row.key])))).toContain(zero.row.key);
    });

    it('groups by section in order', () => {
        const groups = groupRows(wizardRows(boq, ['structure']), true, new Set());
        const sections = groups.map(g => g.section);
        expect(new Set(sections).size).toBe(sections.length);
    });
});

describe('selection', () => {
    it('pre-ticks the non-zero rows of the section from the BOQ shortcut', () => {
        const rows = wizardRows(boq, ['structure']);
        const section = rows[0]?.section ?? -1;
        const d = draftFor('structure', section);
        expect(d.selected.length).toBeGreaterThan(0);
        expect(d.selected).toEqual(rows.filter(r => r.section === section && r.row.qty > 0).map(r => r.row.key));
    });

    it('a template sets the trade, lists its trades and ticks their non-zero rows', () => {
        const t = TEMPLATES.find(x => x.id === 'roof');
        expect(t).toBeDefined();
        if (t === undefined) return;
        const d = applyTemplate(draftFor('masonry'), t, boq);
        expect(d.trade).toBe('roof-structure');
        expect(d.shownTrades).toEqual(['roof-structure', 'roofing']);
        expect(d.selected).toEqual(wizardRows(boq, ['roof-structure', 'roofing']).filter(r => r.row.qty > 0).map(r => r.row.key));
    });

    it('every template trade is part of its own list', () => {
        for (const t of TEMPLATES) expect(t.trades).toContain(t.trade);
    });

    it('rows held by another live package and rows of hidden trades do not count', () => {
        const rows = wizardRows(boq, ['structure']);
        const [a, b] = rows;
        if (a === undefined || b === undefined) throw new Error('sample has structure rows');
        const held = heldLines([
            { id: 'p1', title: 'โครงสร้างชั้น 1', lines: [{ lineKey: a.row.key }, { lineKey: null }] },
            { id: 'self', title: 'ตัวเอง', lines: [{ lineKey: b.row.key }] },
        ], 'self');
        expect(held.get(a.row.key)).toBe('โครงสร้างชั้น 1');
        expect(held.has(b.row.key)).toBe(false);
        const d = { ...draftFor('structure'), selected: [b.row.key, a.row.key, 'other-trade-key'] };
        expect(effectiveKeys(d, rows, held)).toEqual([b.row.key]);
        // Changing the trade keeps the ticks but they stop counting.
        const moved = changeTrade(d, 'painting');
        expect(effectiveKeys(moved, wizardRows(boq, moved.shownTrades), held)).toEqual([]);
    });

    it('toggles keys on and off', () => {
        expect(toggleKeys(['a'], ['b', 'c'], true).sort()).toEqual(['a', 'b', 'c']);
        expect(toggleKeys(['a', 'b'], ['a'], false)).toEqual(['b']);
    });

    it('custom lines need a unit once described; blank rows are ignored', () => {
        expect(customLinesComplete([{ id: '1', desc: '', unit: '', qty: 0, estUnit: 0 }])).toBe(true);
        expect(customLinesComplete([{ id: '1', desc: 'รื้อรั้ว', unit: '', qty: 10, estUnit: 0 }])).toBe(false);
        expect(customLinesComplete([{ id: '1', desc: 'รื้อรั้ว', unit: 'ม.', qty: 10, estUnit: 50 }])).toBe(true);
    });
});

describe('defaults', () => {
    it('terms follow the workspace settings; 7% retention counts as custom', () => {
        const d = draftFor('structure');
        expect(d.retentionPct).toBe(0.05);
        expect(d.retentionCustom).toBe(false);
        expect(d.warrantyMonths).toBe(12);
        expect(d.hideOwnerIdentity).toBe(true);
        expect(d.location.province).toBe('นนทบุรี');
        const custom = initialDraft({ trade: 'structure', section: null, boq, settings: { ...settings, defaultRetentionPct: 0.07 }, province: '', address: '', now });
        expect(custom.retentionCustom).toBe(true);
        expect(isStandardRetention(0.1)).toBe(true);
        const none = initialDraft({ trade: 'structure', section: null, boq, settings: undefined, province: '', address: '', now });
        expect(none.retentionPct).toBe(0.05);
    });

    it('title and questions follow the trade until edited', () => {
        const d = draftFor('electrical');
        expect(titleOf(d)).toBe('ไฟฟ้า');
        expect(questionsOf(d)).toEqual(['ช่างมีหนังสือรับรองความรู้ความสามารถช่างไฟฟ้าภายในอาคารกี่คน']);
        expect(questionsOf(changeTrade(d, 'masonry'))).toEqual(['เคยทำงานฉาบเรียบขัดมันไหม']);
        expect(titleOf({ ...d, title: 'ไฟทั้งหลัง' })).toBe('ไฟทั้งหลัง');
        // The default never carries the project name (crews see the title even when the owner is hidden).
        expect(titleOf(draftFor('masonry'))).toBe('ก่ออิฐ-ฉาบปูน');
    });

    it('warns when a typed title shows the hidden project name', () => {
        expect(titleRevealsProject('ก่ออิฐ บ้านคุณเอ', 'บ้านคุณเอ', true)).toBe(true);
        expect(titleRevealsProject('ก่ออิฐ บ้าน คุณเอ', 'บ้านคุณเอ', true)).toBe(true);
        expect(titleRevealsProject('ก่ออิฐ บ้านคุณเอ', 'บ้านคุณเอ', false)).toBe(false);
        expect(titleRevealsProject('ก่ออิฐ-ฉาบปูน', 'บ้านคุณเอ', true)).toBe(false);
        expect(titleRevealsProject('ก่ออิฐ', '', true)).toBe(false);
    });

    it('bid deadline is +5 days at 17:00 and prices hold 30 days', () => {
        const d = draftFor('structure');
        const deadline = new Date(d.bidDeadline);
        expect(deadline.getDate()).toBe(31);
        expect(deadline.getHours()).toBe(17);
        expect(d.priceValidUntil).toBe('2026-11-25');
    });
});

describe('schedule from the S-Curve', () => {
    it('spans the earliest start to the latest finish of the trade tasks', () => {
        const ids = new Set(tasksOfTrade('structure'));
        const mine = tasks.filter(t => ids.has(t.id));
        const s = scheduleFromPlan(tasks, 'structure');
        const starts = mine.map(t => t.start).filter((x): x is string => x !== null).sort();
        expect(s.start).toBe(starts[0] ?? null);
        if (s.start !== null && s.finish !== null) expect(s.days).toBeGreaterThan(0);
    });

    it('without dates: unknown start/finish, days from the Man-Day durations', () => {
        const undated = tasks.map(t => ({ ...t, start: null, finish: null }));
        const s = scheduleFromPlan(undated, 'masonry');
        const ids = new Set(tasksOfTrade('masonry'));
        const sum = Math.ceil(undated.filter(t => ids.has(t.id)).reduce((a, t) => a + t.duration, 0));
        expect(s.start).toBeNull();
        expect(s.finish).toBeNull();
        expect(s.days).toBe(sum > 0 ? sum : null);
    });
});

describe('invitees', () => {
    it('direct needs exactly one; rfq 2–8', () => {
        expect(inviteeProblem('direct', 1)).toBeNull();
        expect(inviteeProblem('direct', 2)).not.toBeNull();
        expect(inviteeProblem('rfq', 1)).not.toBeNull();
        expect(inviteeProblem('rfq', 2)).toBeNull();
        expect(inviteeProblem('rfq', 8)).toBeNull();
        expect(inviteeProblem('rfq', 9)).not.toBeNull();
    });

    it('direct keeps the last ticked; rfq stops at 8; untick removes', () => {
        expect(toggleInvitee([{ entryId: 'a', channel: 'sms' }], 'b', true, 'direct')).toEqual([{ entryId: 'b', channel: 'link' }]);
        const eight = Array.from({ length: 8 }, (_x, i) => ({ entryId: String(i), channel: 'link' as const }));
        expect(toggleInvitee(eight, 'z', true, 'rfq')).toHaveLength(8);
        expect(toggleInvitee(eight, '3', false, 'rfq')).toHaveLength(7);
        expect(toggleInvitee([{ entryId: 'a', channel: 'sms' }], 'a', true, 'rfq')).toEqual([{ entryId: 'a', channel: 'sms' }]);
    });

    it('sorts the project province first, then experience with us, then name', () => {
        const list = [
            vendor({ id: 'a', displayName: 'ข', province: 'ชลบุรี', completedWithUs: 5 }),
            vendor({ id: 'b', displayName: 'ค', province: 'นนทบุรี', completedWithUs: 0 }),
            vendor({ id: 'c', displayName: 'ก', province: 'นนทบุรี', completedWithUs: 2 }),
            vendor({ id: 'd', displayName: 'ก', province: 'ชลบุรี', completedWithUs: 5 }),
        ];
        expect(sortVendors(list, 'นนทบุรี').map(v => v.id)).toEqual(['c', 'b', 'd', 'a']);
    });
});

describe('the request', () => {
    it('builds a valid CreatePackageRequest from the sample', () => {
        const d = { ...draftFor('structure', wizardRows(boq, ['structure'])[0]?.section ?? null), invitees: [{ entryId: 'x', channel: 'link' as const }, { entryId: 'y', channel: 'link' as const }] };
        const keys = effectiveKeys(d, wizardRows(boq, d.shownTrades), new Map());
        const req = buildRequest(d, { lineKeys: keys, tasks });
        expect(createPackageRequestSchema.safeParse(req).success).toBe(true);
        expect(req.materialByLine).toEqual({});
        expect(sendProblems(req, d, now, false)).toEqual([]);
        expect(estimateTotal(boq, d, keys)).toBeGreaterThan(0);
    });

    it('keeps per-line material only for chosen lines in per_line mode', () => {
        const rows = wizardRows(boq, ['structure']);
        const [a, b] = rows;
        if (a === undefined || b === undefined) throw new Error('sample has structure rows');
        const d: Draft = { ...draftFor('structure'), supplyMode: 'per_line', materialByLine: { [a.row.key]: 'vendor', [b.row.key]: 'vendor' } };
        const req = buildRequest(d, { lineKeys: [a.row.key], tasks });
        expect(req.materialByLine).toEqual({ [a.row.key]: 'vendor' });
        const labour = buildRequest({ ...d, supplyMode: 'labour_only' }, { lineKeys: [a.row.key], tasks });
        expect(labour.materialByLine).toEqual({});
    });

    it('lists what blocks sending', () => {
        const d = { ...draftFor('structure'), installments: [{ no: 1, pct: 0.6, condition: 'เสร็จ' }], bidDeadline: '2026-10-01T10:00:00.000Z' };
        const req = buildRequest(d, { lineKeys: [], tasks });
        const problems = sendProblems(req, d, now, false);
        expect(problems).toContain('เลือกงานอย่างน้อย 1 รายการ');
        expect(problems.some(p => p.startsWith('งวดจ่าย'))).toBe(true);
        expect(problems).toContain('วันปิดรับราคาต้องเป็นเวลาข้างหน้า');
        expect(problems).toContain('ขอราคาเทียบเลือกอย่างน้อย 2 ราย');
        expect(sendProblems(req, d, now, true)).not.toContain('ขอราคาเทียบเลือกอย่างน้อย 2 ราย');
    });

    it('turns a zod issue into Thai', () => {
        expect(issueText({ path: [], message: 'เลือกงานอย่างน้อย 1 รายการ' })).toBe('เลือกงานอย่างน้อย 1 รายการ');
        expect(issueText({ path: ['title'], message: 'String must contain at least 1 character(s)' })).toBe('ตรวจ "ชื่อแพ็กเกจ" อีกครั้ง');
        expect(issueText(undefined)).toBe('ข้อมูลไม่ครบ ตรวจอีกครั้ง');
    });
});
