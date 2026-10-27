import { describe, expect, it } from 'vitest';
import type { CrewAssignmentDto, CrewDto } from '@/shared/contract';
import { buildCrewBoard } from '@/domain/workforce/board';
import {
    PROJECT_COLOURS, boardCrews, conflictText, filterRows, percent, projectColours, projectsInRows, rowHeight, taskLabel, windowLabel,
} from '../view';

const T = '2026-10-01T00:00:00.000Z';
const U = '00000000-0000-4000-8000-000000000000';

function crew(id: string, name: string, trade: CrewDto['trade'], archived = false): CrewDto {
    return {
        id, workspaceId: U, name, trade, leaderId: null, memberIds: [], skilledCount: 1, labourerCount: 0, rateCardId: null,
        dailyCostOverride: null, dailyCost: null, wagesHidden: false, note: null, createdAt: T, updatedAt: T, archivedAt: archived ? T : null,
    };
}

function asg(id: string, crewId: string, projectId: string, taskId: string, start: string, end: string): CrewAssignmentDto {
    return { id, workspaceId: U, projectId, taskId, crewId, start, end, note: null, createdBy: U, createdAt: T, updatedAt: T };
}

const NAMES: Record<string, string> = { wichai: 'บ้านคุณวิชัย', somsri: 'บ้านคุณสมศรี', red: 'ทีมก่อฉาบช่างแดง' };
const names = { project: (id: string) => NAMES[id] ?? id, crew: (id: string) => NAMES[id] ?? id };
const W = { from: '2026-10-01', to: '2026-11-30' };

describe('crew board view helpers', () => {
    it('writes the conflict line in Thai', () => {
        const board = buildCrewBoard([crew('red', 'ทีมก่อฉาบช่างแดง', 'masonry')], [
            asg('p', 'red', 'wichai', '5.1', '2026-10-12', '2026-10-30'),
            asg('b', 'red', 'somsri', '4.1', '2026-10-28', '2026-11-15'),
        ], new Map(), W, '2026-10-26');
        const [c] = board.conflicts;
        expect(c === undefined ? '' : conflictText(c, names))
            .toBe('ทีมก่อฉาบช่างแดง ชน 3 วัน (28–30 ต.ค.): บ้านคุณวิชัย 5.1 งานฉาบปูน กับ บ้านคุณสมศรี 4.1 งานก่ออิฐ');
    });

    it('labels tasks, windows and percentages', () => {
        expect(taskLabel('1.5')).toBe('1.5 งานฐานราก');
        expect(taskLabel('9.9')).toBe('งาน 9.9');
        expect(windowLabel({ from: '2026-10-26', to: '2026-11-08' })).toBe('26 ต.ค.–8 พ.ย. 26');
        expect(windowLabel({ from: '2026-12-28', to: '2027-01-10' })).toBe('28 ธ.ค. 26–10 ม.ค. 27');
        expect(percent(0.6449)).toBe('64%');
        expect(percent(1)).toBe('100%');
    });

    it('keeps a project colour by name, whatever order the ids come in', () => {
        const a = projectColours(['somsri', 'wichai'], names.project);
        const b = projectColours(['wichai', 'somsri', 'wichai'], names.project);
        expect(a.get('wichai')).toEqual(b.get('wichai'));
        expect(a.get('somsri')).not.toEqual(a.get('wichai'));
        const many = projectColours(Array.from({ length: PROJECT_COLOURS.length + 1 }, (_, i) => `p${String(i).padStart(2, '0')}`), id => id);
        expect(many.get('p00')).toEqual(many.get(`p${String(PROJECT_COLOURS.length).padStart(2, '0')}`));
    });

    it('puts active crews, and archived crews still working in the window, by trade then name', () => {
        const crews = [
            crew('c1', 'ทีมทาสี', 'painting'), crew('c2', 'ทีมโครงสร้าง ข.', 'structure'), crew('c3', 'ทีมโครงสร้าง ก.', 'structure'),
            crew('old', 'ทีมเก่า', 'masonry', true), crew('gone', 'ทีมเลิกแล้ว', 'masonry', true),
        ];
        const list = boardCrews(crews, [asg('x', 'old', 'wichai', '4.1', '2026-10-05', '2026-10-06')], W);
        expect(list.map(c => c.id)).toEqual(['c3', 'c2', 'old', 'c1']);
    });

    it('filters rows by trade, project and problems', () => {
        const crews = [crew('red', 'ทีมก่อฉาบช่างแดง', 'masonry'), crew('paint', 'ทีมทาสี', 'painting'), crew('busy', 'ทีมเต็ม', 'structure')];
        const board = buildCrewBoard(crews, [
            asg('p', 'red', 'wichai', '5.1', '2026-10-12', '2026-10-30'),
            asg('b', 'red', 'somsri', '4.1', '2026-10-28', '2026-11-15'),
            asg('q', 'paint', 'somsri', '7.1', '2026-10-01', '2026-11-30'),
            asg('s', 'busy', 'wichai', '1.1', '2026-10-01', '2026-11-30'),
        ], new Map(), W, '2026-10-26');
        const ids = (f: Parameters<typeof filterRows>[1]) => filterRows(board.rows, f, '2026-10-26').map(r => r.crew.id);
        expect(ids({ trade: undefined, projectId: undefined, problemsOnly: false })).toEqual(['red', 'paint', 'busy']);
        expect(ids({ trade: 'painting', projectId: undefined, problemsOnly: false })).toEqual(['paint']);
        expect(ids({ trade: undefined, projectId: 'wichai', problemsOnly: false })).toEqual(['red', 'busy']);
        expect(ids({ trade: undefined, projectId: undefined, problemsOnly: true })).toEqual(['red']);
        expect(projectsInRows(board.rows).sort()).toEqual(['somsri', 'wichai']);
    });

    it('grows a row with its lanes', () => {
        expect(rowHeight(2) - rowHeight(1)).toBe(26);
        expect(rowHeight(0)).toBe(rowHeight(1));
    });
});
