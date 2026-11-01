import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup as renderBare } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';
import { readyDay } from '@/domain/workforce/scenario';
import { buildTeamRows, type TeamAssignment } from '../team-model';
import {
    earlyStartLines, earlyStartSummaryText, earlyStarts, finishDeltaText, finishMetric, labourDeltaText, labourMetric,
} from '../team-metrics';
import { TeamMetrics } from '../TeamMetrics';
import { TeamTable } from '../TeamTable';
import { withIntl } from '../../test-intl';

/** Renders under the Thai messages (the components read their texts with next-intl). */
const renderToStaticMarkup = (el: ReactElement): string => renderBare(withIntl(el));

const { schedule, manday } = computeProject(createProject('sample')).planning;

const HERE = 'p-here';
let seq = 0;
const asg = (taskId: string, crewId: string, start: string, end: string): TeamAssignment =>
    ({ id: `a${String(++seq)}`, projectId: HERE, taskId, crewId, start, end, note: null });
const plusDays = (iso: string, n: number) => serialToIso((isoToSerial(iso) ?? 0) + n);
const days = (a: string, b: string) => (isoToSerial(b) ?? 0) - (isoToSerial(a) ?? 0) + 1;

/** Every task crewed on its planned days (crew c1). */
const onPlan = () => schedule.tasks.flatMap(t => (t.start && t.finish ? [asg(t.id, 'c1', t.start, t.finish < t.start ? t.start : t.finish)] : []));
const task = (id: string) => {
    const t = schedule.tasks.find(x => x.id === id);
    if (!t?.start || !t.finish) throw new Error(`sample ${id} has dates`);
    return { start: t.start, finish: t.finish };
};
const block = (id: string) => {
    const b = manday.blocks.find(x => x.id === id);
    if (!b) throw new Error(id);
    return b;
};

describe('finish as crewed', () => {
    it('every task on its planned days: the plan finish, on plan', () => {
        const m = finishMetric(buildTeamRows(schedule, manday, onPlan()));
        expect(m).toEqual({ crewedFinish: schedule.finish, planFinish: schedule.finish, days: 0, partial: false });
        expect(finishDeltaText(0)).toBe('ตรงแผน');
    });

    it('the last task later or earlier than planned: later / earlier by the days', () => {
        const last = onPlan().map(a => (a.taskId === '8.6' ? { ...a, end: plusDays(a.end, 5) } : a));
        expect(finishMetric(buildTeamRows(schedule, manday, last)).days).toBe(5);
        expect(finishDeltaText(5)).toBe('ช้ากว่าแผน 5 วัน');
        expect(finishDeltaText(-3)).toBe('เร็วกว่าแผน 3 วัน');
    });

    it('only some tasks crewed: counts those, against the plan finish of the same tasks', () => {
        const f = task('1.5');
        const m = finishMetric(buildTeamRows(schedule, manday, [asg('1.5', 'c1', f.start, plusDays(f.finish, 2))]));
        expect(m).toEqual({ crewedFinish: plusDays(f.finish, 2), planFinish: f.finish, days: 2, partial: true });
    });

    it('no crew yet: nothing to show', () => {
        const m = finishMetric(buildTeamRows(schedule, manday, []));
        expect(m).toMatchObject({ crewedFinish: null, days: null, partial: true });
        expect(renderToStaticMarkup(createElement(TeamMetrics, { finish: m, labour: undefined }))).toBe('');
    });
});

describe('labour as crewed vs the Man-Day labour of the same tasks', () => {
    const f = task('1.5');
    const n = days(f.start, f.finish);

    it('Σ days × ฿/day against the Man-Day ค่าแรงของงาน of the crewed tasks only', () => {
        const groups = buildTeamRows(schedule, manday, [asg('1.5', 'c1', f.start, f.finish), asg('1.5', 'c2', f.start, f.start)]);
        const m = labourMetric(groups, manday, id => (id === 'c1' ? 3000 : 1300));
        expect(m.taskIds).toEqual(['1.5']);
        expect(m.crewCost).toBe(n * 3000 + 1300);
        expect(m.boqLabour).toBe(block('1.5').labourCost);
        expect(m.diff).toBe(n * 3000 + 1300 - block('1.5').labourCost);
        expect(m.percent).toBeCloseTo(((m.diff ?? 0) / block('1.5').labourCost) * 100, 9);
        expect(m.missingCost).toBe('none');
    });

    it('a shareOfTotal block compares with its Man-Day labour (share × total), piles are left out', () => {
        const a = task('7.1');
        const p = task('1.4');
        const groups = buildTeamRows(schedule, manday, [asg('7.1', 'c1', a.start, a.finish), asg('1.4', 'c1', p.start, p.finish)]);
        const m = labourMetric(groups, manday, () => 1000);
        expect(block('7.1').labourBasis).toBe('shareOfTotal');
        expect(m.boqLabour).toBe(block('7.1').labourCost);
        expect(m.excludedTaskIds).toEqual(['1.4']);
        expect(m.crewCost).toBe(days(a.start, a.finish) * 1000);
    });

    it('a crew without a known ฿/day: no money (never ฿0), and says whether some or all', () => {
        const groups = buildTeamRows(schedule, manday, [asg('1.5', 'c1', f.start, f.finish), asg('2.1', 'cx', '2026-02-05', '2026-02-08')]);
        const some = labourMetric(groups, manday, id => (id === 'c1' ? 3000 : null));
        expect(some).toMatchObject({ crewCost: null, diff: null, percent: null, missingCost: 'some' });
        expect(labourMetric(groups, manday, () => undefined).missingCost).toBe('all');
        const html = renderToStaticMarkup(createElement(TeamMetrics, { finish: finishMetric(groups), labour: some }));
        expect(html).toContain('บางทีมยังไม่มีค่าแรง');
        expect(html).not.toContain('0 บาท');
    });

    it('texts: above / below / equal to the BOQ with the share', () => {
        expect(labourDeltaText(12300, 8.47)).toBe('สูงกว่า BOQ 12,300 บาท (+8.5%)');
        expect(labourDeltaText(-4000, -3.14)).toBe('ต่ำกว่า BOQ 4,000 บาท (−3.1%)');
        expect(labourDeltaText(0.2, 0)).toBe('เท่ากับ BOQ');
        expect(labourDeltaText(500, null)).toBe('สูงกว่า BOQ 500 บาท');
    });

    it('the tiles: finish, labour with the BOQ figure; no labour tile for those who may not see costs', () => {
        const groups = buildTeamRows(schedule, manday, [asg('1.5', 'c1', f.start, f.finish)]);
        const finish = finishMetric(groups);
        const html = renderToStaticMarkup(createElement(TeamMetrics, { finish, labour: labourMetric(groups, manday, () => 3000) }));
        expect(html).toContain('วันเสร็จตามทีมที่จัด');
        expect(html).toContain('ตรงแผน');
        expect(html).toContain('นับเฉพาะงานที่จัดทีมแล้ว');
        expect(html).toContain('ค่าแรงตามทีมที่จัด');
        expect(html).toContain('ค่าแรงตาม BOQ (Man-Day)');
        expect(html).toContain('เทียบเฉพาะงานที่จัดทีมแล้ว 1 งาน');
        expect(html).not.toContain('NaN');
        const viewer = renderToStaticMarkup(createElement(TeamMetrics, { finish, labour: undefined }));
        expect(viewer).not.toContain('ค่าแรง');
        expect(viewer).not.toContain('บาท');
    });
});

describe('starts before the wait is over', () => {
    /** Before every start in these tests (the plan sample starts in January 2026). */
    const TODAY = '2025-12-31';
    const footing = asg('1.5', 'c1', '2026-10-15', '2026-10-24');
    const stumps = asg('1.6', 'c1', '2026-10-28', '2026-10-29');

    it('a task starting before the task before it + its wait: the ready day, how early and why', () => {
        const [e, ...rest] = earlyStarts([stumps, footing], [], TODAY);
        expect(rest).toEqual([]);
        expect(e).toEqual({
            taskId: '1.6', crewStart: '2026-10-28', ready: '2026-11-01', days: 4,
            causes: [{ taskId: '1.5', end: '2026-10-24', wait: 7 }],
        });
        expect(e?.ready).toBe(readyDay([stumps, footing], '1.6', []));
        if (!e) throw new Error('early');
        expect(earlyStartLines(e)).toEqual([
            'งานก่อนหน้า (งานฐานราก) จบ 24 ต.ค. + รอ 7 วัน → เริ่มได้ 1 พ.ย.',
            'ทีมที่จัดเริ่ม 28 ต.ค. ก่อนเริ่มได้ 4 วัน',
        ]);
        expect(earlyStartSummaryText(1)).toBe('เริ่มก่อนครบช่วงรอ 1 งาน');
        expect(earlyStartSummaryText(0)).toBe('');
    });

    it('the project’s own wait counts; starting on the ready day or later is fine', () => {
        expect(earlyStarts([stumps, footing], [{ taskId: '1.5', days: 3, note: null }], TODAY)).toEqual([]);
        expect(earlyStarts([{ ...stumps, start: '2026-11-01', end: '2026-11-02' }, footing], [], TODAY)).toEqual([]);
        const noWait = earlyStarts([{ ...stumps, start: '2026-10-20' }, footing], [{ taskId: '1.5', days: 0, note: null }], TODAY);
        expect(noWait.map(e => [e.taskId, e.days])).toEqual([['1.6', 5]]);
        expect(noWait[0] && earlyStartLines(noWait[0])[0]).toBe('งานก่อนหน้า (งานฐานราก) จบ 24 ต.ค. → เริ่มได้ 25 ต.ค.');
    });

    it('a task with no crew passes its predecessors on; a first task never warns', () => {
        // 1.7 waits for 1.6, which has no crew here: so it waits for 1.5 (+ 7 days).
        const ground = asg('1.7', 'c1', '2026-10-26', '2026-10-27');
        expect(earlyStarts([ground, footing], [], TODAY).map(e => [e.taskId, e.ready])).toEqual([['1.7', '2026-11-01']]);
        expect(earlyStarts([asg('1.1', 'c1', '2026-01-01', '2026-01-02')], [], TODAY)).toEqual([]);
    });

    it('the planned sample crewed on its S-Curve days: every warning matches readyDay', () => {
        const all = onPlan();
        for (const e of earlyStarts(all, [], TODAY)) {
            expect(e.ready).toBe(readyDay(all, e.taskId, []));
            expect(e.days).toBeGreaterThan(0);
            expect(e.causes.length).toBeGreaterThan(0);
        }
    });

    it('only tasks not started yet: a start on or before today is past and not marked', () => {
        expect(earlyStarts([stumps, footing], [], '2026-10-27').map(e => e.taskId)).toEqual(['1.6']);
        expect(earlyStarts([stumps, footing], [], '2026-10-28')).toEqual([]);
        expect(earlyStarts([stumps, footing], [], '2026-11-05')).toEqual([]);
    });

    it('the table marks the row quietly with the reason in its label', () => {
        const groups = buildTeamRows(schedule, manday, [footing, stumps]);
        const [e] = earlyStarts([footing, stumps], [], TODAY);
        const html = renderToStaticMarkup(createElement(TeamTable<TeamAssignment>, {
            groups, crewName: () => 'ทีมช่างสมชาย', canAssign: true, onAdd: () => undefined, onEdit: () => undefined,
            waitOf: undefined, onEditWait: undefined, conflictsOf: () => [],
            earlyStartOf: id => (id === e?.taskId ? e : undefined),
        }));
        expect(html.match(/data-early-start=/g)).toHaveLength(1);
        expect(html).toContain('data-early-start="1.6"');
        expect(html).toContain('>เริ่มก่อนครบช่วงรอ 4 วัน</span>');
        expect(html).toContain('งานก่อนหน้า (งานฐานราก) จบ 24 ต.ค. + รอ 7 วัน → เริ่มได้ 1 พ.ย.');
        expect(html).not.toContain('text-red');
    });
});
