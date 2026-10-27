// ─── Expected values for the Robot suites, computed by the real BOQ engine ───
// The engine is checked against the Excel v5 workbook by the golden and oracle tests (vitest), so an E2E test that
// types inputs into the UI compares the screen with what this script computes from the same project.
//
// Usage: tsx tests/robot/tools/expected.ts <project.json | ->      (- = read the project JSON from stdin)
//        tsx tests/robot/tools/expected.ts --create blank|sample  (a new project, as the app makes it)
// Output (stdout, JSON): see `Expected` below.
import { readFileSync } from 'node:fs';
import { computeProject, createProject, type Project, type ProjectStart } from '@/domain/project';
import { JOURNEY_LEVELS, levelTotal, missingRequirements, levelStates } from '@/domain/journey';

interface Expected {
    constructionTotal: number;
    preConstructionTotal: number;
    sections: { no: number; title: string; mat: number; lab: number; total: number }[];
    levels: { id: string; title: string; total: number; state: string; missing: string[] }[];
    planning: {
        manday: unknown;
        schedule: unknown;
        cashflow: unknown;
    };
    calcOutputs: Record<string, Record<string, number>>;
    project: Project;
}

function readProject(arg: string | undefined): Project {
    if (arg === '--create') {
        const start = (process.argv[3] ?? 'sample') as ProjectStart;
        return createProject(start);
    }
    const raw = arg === undefined || arg === '-' ? readFileSync(0, 'utf8') : readFileSync(arg, 'utf8');
    const parsed = JSON.parse(raw) as Project | { state?: { project?: Project } };
    // Accept the zustand-persist wrapper stored in localStorage ({ state: { project } }) as well as a bare project.
    if ('state' in parsed && parsed.state?.project) return parsed.state.project;
    return parsed as Project;
}

const project = readProject(process.argv[2]);
const res = computeProject(project);
const states = levelStates(project.journey ?? {});
const out: Expected = {
    constructionTotal: res.boq.constructionTotal,
    preConstructionTotal: res.boq.preConstructionTotal,
    sections: res.boq.sections.map(s => ({ no: s.no, title: s.title, mat: s.matTotal, lab: s.labTotal, total: s.total })),
    levels: JOURNEY_LEVELS.map(l => ({
        id: l.id,
        title: l.title,
        total: levelTotal(l, res),
        state: states[l.id] ?? 'locked',
        missing: missingRequirements(l.id, project).map(m => JSON.stringify(m)),
    })),
    planning: { manday: res.planning.manday, schedule: res.planning.schedule, cashflow: res.planning.cashflow },
    calcOutputs: res.calcOutputs,
    project,
};
process.stdout.write(JSON.stringify(out));
