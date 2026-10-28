// Component checks by server rendering (the project runs vitest in node without a DOM): what each role sees.
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from 'antd';
import { describe, expect, it } from 'vitest';
import type { CrewDto, PersonDto } from '@/shared/contract';
import { CrewStatusCell, CrewsTab, FIRST_CREW_HINT } from '../CrewsTab';
import { PeopleTab } from '../PeopleTab';
import { ModuleOff } from '../CrewsPage';
import type { PlaceNames } from '../logic';

const T = '2026-10-01T00:00:00.000Z';
const W = '00000000-0000-4000-8000-000000000001';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TODAY = '2026-10-26';
const names: PlaceNames = { project: () => 'บ้านคุณวิชัย', task: () => 'งานฐานราก' };

const render = (el: ReactElement): string =>
    renderToStaticMarkup(h(QueryClientProvider, { client: new QueryClient() }, h(App, null, el)));

const leader: PersonDto = {
    id: uuid(101), workspaceId: W, name: 'พงษ์ศักดิ์', nickname: 'พงษ์', phone: '081-234-5678', role: 'foreman',
    employment: 'permanent', trades: ['electrical'], dailyWage: 900, wagesHidden: false, note: null, createdAt: T,
    updatedAt: T, archivedAt: null,
};

const crew: CrewDto = {
    id: uuid(201), workspaceId: W, name: 'ทีมไฟฟ้า ก.', trade: 'electrical', leaderId: leader.id, memberIds: [uuid(102)],
    skilledCount: 3, labourerCount: 2, rateCardId: null, dailyCostOverride: 4200, dailyCost: 4200, wagesHidden: false,
    note: null, createdAt: T, updatedAt: T, archivedAt: null,
};

const crewsProps = (over: Partial<Parameters<typeof CrewsTab>[0]> = {}): Parameters<typeof CrewsTab>[0] => ({
    workspaceId: W, canManage: true, seeCost: true, crews: { data: [crew], isLoading: false, error: null }, people: [leader],
    rateCards: [], assignments: [], today: TODAY, names, ...over,
});

describe('CrewStatusCell', () => {
    it('free, busy and booked twice', () => {
        expect(render(h(CrewStatusCell, { status: { kind: 'free' }, today: TODAY }))).toContain('ว่าง');
        const place = { projectId: uuid(400), projectName: 'บ้านคุณวิชัย', taskId: '2.1', taskName: 'งานฐานราก', end: '2026-10-30' };
        const busy = render(h(CrewStatusCell, { status: { kind: 'busy', places: [place] }, today: TODAY }));
        expect(busy).toContain('บ้านคุณวิชัย · งานฐานราก');
        expect(busy).toContain('ถึง 30/10');
        expect(busy).not.toContain('ชนกับ');
        const twice = render(h(CrewStatusCell, { status: { kind: 'busy', places: [place, { ...place, end: '2026-11-02' }] }, today: TODAY }));
        expect(twice).toContain('ชนกับอีก 1 งาน');
    });
});

describe('CrewsTab', () => {
    it('first use: a manager gets the hint and one button', () => {
        const html = render(h(CrewsTab, crewsProps({ crews: { data: [], isLoading: false, error: null } })));
        expect(html).toContain(FIRST_CREW_HINT);
        expect(html).toContain('เพิ่มทีมแรก');
    });
    it('first use: a viewer gets no button', () => {
        const html = render(h(CrewsTab, crewsProps({ canManage: false, crews: { data: [], isLoading: false, error: null } })));
        expect(html).not.toContain('เพิ่มทีมแรก');
        expect(html).toContain('ยังไม่มีทีมช่าง');
    });
    it('a manager sees the row, its cost, where it is and the actions', () => {
        const html = render(h(CrewsTab, crewsProps({
            assignments: [{
                id: uuid(301), workspaceId: W, projectId: uuid(400), taskId: '2.1', crewId: crew.id, start: '2026-10-20',
                end: '2026-10-30', note: null, createdBy: uuid(1), createdAt: T, updatedAt: T,
            }],
        })));
        expect(html).toContain('ทีมไฟฟ้า ก.');
        expect(html).toContain('ไฟฟ้า');
        expect(html).toContain('พงษ์ศักดิ์ (พงษ์)');
        expect(html).toContain('ช่าง 3 · คนงาน 2');
        expect(html).toContain('รายชื่อ 1 คน');
        expect(html).toContain('ค่าแรงต่อวัน');
        expect(html).toContain('4,200');
        expect(html).toContain('ถึง 30/10');
        expect(html).toContain('เพิ่มทีม');
        expect(html).toContain('แก้ไข ทีมไฟฟ้า ก.');
    });
    it('read-only and without cost: no cost column, no actions', () => {
        const html = render(h(CrewsTab, crewsProps({ canManage: false, seeCost: false })));
        expect(html).toContain('ทีมไฟฟ้า ก.');
        expect(html).not.toContain('ค่าแรงต่อวัน');
        expect(html).not.toContain('4,200');
        expect(html).not.toContain('แก้ไข ทีมไฟฟ้า ก.');
    });
    it('hides the cost column when the server hid every cost', () => {
        const html = render(h(CrewsTab, crewsProps({
            crews: { data: [{ ...crew, dailyCost: null, dailyCostOverride: null, wagesHidden: true }], isLoading: false, error: null },
        })));
        expect(html).not.toContain('ค่าแรงต่อวัน');
    });
});

describe('PeopleTab', () => {
    const props = (over: Partial<Parameters<typeof PeopleTab>[0]> = {}): Parameters<typeof PeopleTab>[0] => ({
        workspaceId: W, canManage: true, seeWages: true, people: { data: [leader], isLoading: false, error: null }, crews: [crew], ...over,
    });
    it('a manager sees wages and the crews a person belongs to', () => {
        const html = render(h(PeopleTab, props()));
        expect(html).toContain('พงษ์ศักดิ์');
        expect(html).toContain('หัวหน้างาน / โฟร์แมน');
        expect(html).toContain('พนักงานประจำ');
        expect(html).toContain('081-234-5678');
        expect(html).toContain('900');
        expect(html).toContain('ทีมไฟฟ้า ก. (หัวหน้า)');
    });
    it('an estimator sees no wage column and no actions', () => {
        const html = render(h(PeopleTab, props({ canManage: false, seeWages: false })));
        expect(html).not.toContain('ค่าแรงต่อวัน');
        expect(html).not.toContain('แก้ไข พงษ์ศักดิ์');
    });
});

describe('ModuleOff', () => {
    it('says the module is not on', () => {
        expect(render(h(ModuleOff))).toContain('ยังไม่เปิดใช้งาน');
    });
});
