// ─── Pure helpers of the crew board page: project colours, row filters, Thai lines, day widths ───
// No React, no API: unit tested in ./__tests__/view.test.ts. The board itself is src/domain/workforce/board.ts.
import { WORKFORCE_TRADE_IDS, type CrewAssignmentDto, type CrewDto, type WorkforceTradeId } from '@/shared/contract';
import {
    crewHasProblem, thaiDayRange, type BoardConflict, type BoardPreset, type BoardWindow, type CrewBoardRow,
} from '@/domain/workforce/board';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { taskNameIn } from '@/domain/planning/labels.en';
import { workforceLocale, workforceText } from '../text';

export type BoardRow = CrewBoardRow<CrewDto, CrewAssignmentDto>;

// ─── Colours: one per project, none of them a state colour (red / green / amber) or the brand orange ───

export interface ProjectColour {
    /** Bar fill (soft), accent (left edge, stripes, swatch) and text on the fill. */
    fill: string;
    accent: string;
    text: string;
}

export const PROJECT_COLOURS: readonly ProjectColour[] = [
    { fill: '#DBEAFE', accent: '#2563EB', text: '#1E3A8A' }, // blue
    { fill: '#CCFBF1', accent: '#0D9488', text: '#134E4A' }, // teal
    { fill: '#EDE9FE', accent: '#7C3AED', text: '#4C1D95' }, // violet
    { fill: '#CFFAFE', accent: '#0891B2', text: '#164E63' }, // cyan
    { fill: '#FAE8FF', accent: '#C026D3', text: '#701A75' }, // fuchsia
    { fill: '#E0E7FF', accent: '#4F46E5', text: '#312E81' }, // indigo
    { fill: '#E2E8F0', accent: '#475569', text: '#1E293B' }, // slate
    { fill: '#F5F5F4', accent: '#78716C', text: '#292524' }, // stone
];

/**
 * project id → colour, by project name (Thai order) so a project keeps its colour while the window moves; past the
 * palette the colours repeat.
 */
export function projectColours(projectIds: Iterable<string>, name: (id: string) => string): Map<string, ProjectColour> {
    const ids = [...new Set(projectIds)].sort((a, b) => name(a).localeCompare(name(b), 'th') || (a < b ? -1 : a > b ? 1 : 0));
    const fallback = PROJECT_COLOURS[0] ?? { fill: '#E5E7EB', accent: '#6B7280', text: '#111827' };
    return new Map(ids.map((id, i) => [id, PROJECT_COLOURS[i % PROJECT_COLOURS.length] ?? fallback]));
}

// ─── Rows ───

const tradeRank = (t: WorkforceTradeId) => WORKFORCE_TRADE_IDS.indexOf(t);

/**
 * Crews on the board: the active ones, plus archived crews that still have work in the window; by trade (the order
 * of the trade list), then name.
 */
export function boardCrews(crews: readonly CrewDto[], assignments: readonly CrewAssignmentDto[], w: BoardWindow): CrewDto[] {
    const inWindow = new Set(assignments.filter(a => a.start <= w.to && a.end >= w.from).map(a => a.crewId));
    return crews
        .filter(c => c.archivedAt === null || inWindow.has(c.id))
        .sort((a, b) => tradeRank(a.trade) - tradeRank(b.trade) || a.name.localeCompare(b.name, 'th'));
}

export interface RowFilter {
    trade: WorkforceTradeId | undefined;
    projectId: string | undefined;
    problemsOnly: boolean;
}

/** The rows a filter keeps: trade, work on the project in the window, and "มีปัญหา" (domain crewHasProblem). */
export function filterRows(rows: readonly BoardRow[], f: RowFilter, today: string): BoardRow[] {
    return rows.filter(r => {
        if (f.trade !== undefined && r.crew.trade !== f.trade) return false;
        if (f.projectId !== undefined && !r.segments.some(s => s.kind === 'work' && s.projectId === f.projectId)) return false;
        if (f.problemsOnly && !crewHasProblem(r, today)) return false;
        return true;
    });
}

/** Projects with work in the rows, for the legend and the project filter. */
export function projectsInRows(rows: readonly BoardRow[]): string[] {
    const out = new Set<string>();
    for (const r of rows) for (const s of r.segments) if (s.kind === 'work') out.add(s.projectId);
    return [...out];
}

// ─── Thai lines ───

const TASK_NAME = new Map(PLAN_TASKS.map(t => [t.id, t.name]));

/** "5.1 งานฉาบปูน". */
export function taskLabel(taskId: string): string {
    const t = workforceText();
    const name = TASK_NAME.get(taskId);
    return name === undefined ? t('shared.taskFallback', { id: taskId }) : t('shared.taskLabel', { id: taskId, name: taskNameIn(taskId, name, workforceLocale()) });
}

export interface BoardNames {
    project: (projectId: string) => string;
    crew: (crewId: string) => string;
}

/** "ทีมก่อฉาบช่างแดง ชน 3 วัน (28–30 ต.ค.): บ้านคุณวิชัย 5.1 งานฉาบปูน กับ บ้านคุณสมศรี 4.1 งานก่ออิฐ". */
export function conflictText(c: BoardConflict, names: BoardNames): string {
    const side = (a: { projectId: string; taskId: string }) => `${names.project(a.projectId)} ${taskLabel(a.taskId)}`;
    return workforceText()('board.view.conflict', {
        crew: names.crew(c.crewId), days: c.days, range: thaiDayRange(c.from, c.to, workforceLocale()), a: side(c.a), b: side(c.b),
    });
}

/** "26 ต.ค.–8 พ.ย. 26" for the window label (the year always shown once). */
export function windowLabel(w: BoardWindow): string {
    const text = thaiDayRange(w.from, w.to, workforceLocale());
    if (w.from.slice(0, 4) !== w.to.slice(0, 4)) return text;
    return `${text} ${String(Number(w.from.slice(0, 4)) % 100).padStart(2, '0')}`;
}

/** "64%" (whole percent). */
export const percent = (ratio: number): string => `${String(Math.round(ratio * 100))}%`;

// ─── Layout ───

/** Pixels per day: 2 weeks and 1 month fit a desktop card; 3 months fits too, with week labels only. */
export const DAY_WIDTH: Record<BoardPreset, number> = { '2w': 68, '1m': 31, '3m': 10 };
export const LANE_HEIGHT = 26;
export const BAR_HEIGHT = 22;
export const ROW_PAD = 7;

/** Height of a row with `lanes` lanes. */
export const rowHeight = (lanes: number): number => ROW_PAD * 2 + Math.max(1, lanes) * LANE_HEIGHT - (LANE_HEIGHT - BAR_HEIGHT);

/** DOM id of a work bar (the conflict list scrolls to it). */
export const barDomId = (assignmentId: string): string => `crew-bar-${assignmentId}`;
