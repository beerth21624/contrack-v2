// ─── Pure helpers of the ทีมช่างและบุคลากร page: crew status today, daily-cost preview, filters, form ↔ request ───
// No React, no API: everything here is unit tested (./__tests__/logic.test.ts).
import {
    type CreateCrewRequest, type CreatePersonRequest, type CrewAssignmentDto, type CrewDto, type EmploymentType,
    type PersonDto, type PersonRole, type RateCardDto, type UpdateCrewRequest, type UpdatePersonRequest,
    type WorkforceTradeId,
} from '@/shared/contract';
import { tradeNameOf, workforceText } from '../text';

// ─── Dates ───

/** The local calendar day of `now` as 'YYYY-MM-DD' (the planning dates have no time zone). */
export function isoDay(now: Date): string {
    const y = String(now.getFullYear()).padStart(4, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → 'dd/mm' (the short form a site uses); the input as is when it is not a day. */
export function dayMonth(iso: string): string {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
    return m === null ? iso : `${m[2] ?? ''}/${m[1] ?? ''}`;
}

// ─── "ตอนนี้อยู่ที่" ───

export interface CrewPlace {
    projectId: string;
    projectName: string;
    taskId: string;
    taskName: string;
    /** Last day on the task (inclusive). */
    end: string;
}

export type CrewStatus =
    | { kind: 'free' }
    /** `places` sorted by end; more than one means the crew is booked twice today (ชนกัน). */
    | { kind: 'busy'; places: [CrewPlace, ...CrewPlace[]] };

export interface PlaceNames {
    project: (projectId: string) => string;
    task: (taskId: string) => string;
}

/** Where a crew is on `today`: the assignments covering that day (start ≤ today ≤ end), else free. */
export function crewStatusOn(crewId: string, assignments: readonly CrewAssignmentDto[], today: string, names: PlaceNames): CrewStatus {
    const places = assignments
        .filter(a => a.crewId === crewId && a.start <= today && today <= a.end)
        .sort((a, b) => a.end.localeCompare(b.end) || a.projectId.localeCompare(b.projectId) || a.taskId.localeCompare(b.taskId))
        .map((a): CrewPlace => ({
            projectId: a.projectId, projectName: names.project(a.projectId), taskId: a.taskId, taskName: names.task(a.taskId), end: a.end,
        }));
    const [first, ...rest] = places;
    return first === undefined ? { kind: 'free' } : { kind: 'busy', places: [first, ...rest] };
}

/** One line for a busy place: "บ้านคุณวิชัย · งานฐานราก" and "ถึง 30/10" (or "วันนี้วันสุดท้าย"). */
export function placeLines(place: CrewPlace, today: string): { where: string; until: string } {
    const t = workforceText();
    return {
        where: `${place.projectName} · ${place.taskName}`,
        until: place.end === today ? t('crews.status.lastDay') : t('crews.status.until', { date: dayMonth(place.end) }),
    };
}

// ─── Crew daily cost (same rule as the server: override, else skilled × card + labourers × card, else none) ───

export type RateSource = 'card' | 'lump';

export interface CostInput {
    skilledCount: number | null | undefined;
    labourerCount: number | null | undefined;
    source: RateSource;
    card: Pick<RateCardDto, 'skilledRate' | 'labourerRate'> | undefined;
    lumpSum: number | null | undefined;
}

export interface CostPreview {
    total: number;
    /** How the total was made, for the line under the field ("3 × 800 + 2 × 500"); undefined for a typed lump sum. */
    formula: { skilled: number; skilledRate: number; labourers: number; labourerRate: number } | undefined;
}

const count = (n: number | null | undefined): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** The crew's ฿/day as the form stands; undefined while there is nothing to price it with. */
export function crewCostPreview(input: CostInput): CostPreview | undefined {
    if (input.source === 'lump') {
        const v = input.lumpSum;
        return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? { total: Math.round(v), formula: undefined } : undefined;
    }
    if (input.card === undefined) return undefined;
    const skilled = count(input.skilledCount);
    const labourers = count(input.labourerCount);
    return {
        total: skilled * input.card.skilledRate + labourers * input.card.labourerRate,
        formula: { skilled, skilledRate: input.card.skilledRate, labourers, labourerRate: input.card.labourerRate },
    };
}

// ─── Labels ───

export const tradeLabel = (id: WorkforceTradeId): string => tradeNameOf(workforceText(), id);

/** "ช่าง 3 · คนงาน 2". */
export function headcountLabel(crew: Pick<CrewDto, 'skilledCount' | 'labourerCount'>): string {
    return workforceText()('shared.headcount', { skilled: String(crew.skilledCount), labourers: String(crew.labourerCount) });
}

/** "สมชาย (ชาย)" when there is a nickname. */
export function personLabel(p: Pick<PersonDto, 'name' | 'nickname'>): string {
    const nick = p.nickname?.trim() ?? '';
    return nick === '' ? p.name : `${p.name} (${nick})`;
}

// ─── Filters ───

const norm = (s: string) => s.trim().toLocaleLowerCase('th-TH');
const has = (hay: string | null | undefined, needle: string) => hay !== null && hay !== undefined && norm(hay).includes(needle);

export interface CrewFilter { search: string; trade: WorkforceTradeId | undefined }

/** Active crews matching the search (crew or leader name) and trade; keeps the input order. */
export function filterCrews(crews: readonly CrewDto[], filter: CrewFilter, peopleById: ReadonlyMap<string, PersonDto>): CrewDto[] {
    const q = norm(filter.search);
    return crews.filter(c => {
        if (c.archivedAt !== null) return false;
        if (filter.trade !== undefined && c.trade !== filter.trade) return false;
        if (q === '') return true;
        const leader = c.leaderId === null ? undefined : peopleById.get(c.leaderId);
        return has(c.name, q) || has(leader?.name, q) || has(leader?.nickname, q);
    });
}

export interface PersonFilter { search: string; trade: WorkforceTradeId | undefined; role: PersonRole | undefined }

/** Active people matching the search (name, nickname, phone), trade and role. */
export function filterPeople(people: readonly PersonDto[], filter: PersonFilter): PersonDto[] {
    const q = norm(filter.search);
    const digits = q.replace(/[\s-]/g, '');
    return people.filter(p => {
        if (p.archivedAt !== null) return false;
        if (filter.trade !== undefined && !p.trades.includes(filter.trade)) return false;
        if (filter.role !== undefined && p.role !== filter.role) return false;
        if (q === '') return true;
        return has(p.name, q) || has(p.nickname, q) || (digits !== '' && p.phone?.replace(/[\s-]/g, '').includes(digits) === true);
    });
}

/** person id → the active crews they lead or belong to (by crew name). */
export function crewsByPerson(crews: readonly CrewDto[]): Map<string, CrewDto[]> {
    const out = new Map<string, CrewDto[]>();
    for (const c of crews) {
        if (c.archivedAt !== null) continue;
        const ids = new Set([...(c.leaderId === null ? [] : [c.leaderId]), ...c.memberIds]);
        for (const id of ids) {
            const list = out.get(id);
            if (list === undefined) out.set(id, [c]);
            else list.push(c);
        }
    }
    for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return out;
}

/** People to pick as crew members: those of `trade` first (then by name), the rest after. */
export function peopleForTrade(people: readonly PersonDto[], trade: WorkforceTradeId | undefined): { inTrade: PersonDto[]; others: PersonDto[] } {
    const active = people.filter(p => p.archivedAt === null).sort((a, b) => a.name.localeCompare(b.name, 'th'));
    if (trade === undefined) return { inTrade: [], others: active };
    return { inTrade: active.filter(p => p.trades.includes(trade)), others: active.filter(p => !p.trades.includes(trade)) };
}

// ─── Forms ───

export interface CrewFormValues {
    name: string;
    trade: WorkforceTradeId | undefined;
    leaderId: string | undefined;
    memberIds: string[];
    skilledCount: number | null;
    labourerCount: number | null;
    rateSource: RateSource;
    rateCardId: string | undefined;
    lumpSum: number | null;
    note: string;
}

export const EMPTY_CREW_FORM: CrewFormValues = {
    name: '', trade: undefined, leaderId: undefined, memberIds: [], skilledCount: 1, labourerCount: 0,
    rateSource: 'card', rateCardId: undefined, lumpSum: null, note: '',
};

export function crewToForm(c: CrewDto): CrewFormValues {
    return {
        name: c.name,
        trade: c.trade,
        leaderId: c.leaderId ?? undefined,
        memberIds: [...c.memberIds],
        skilledCount: c.skilledCount,
        labourerCount: c.labourerCount,
        rateSource: c.dailyCostOverride === null ? 'card' : 'lump',
        rateCardId: c.rateCardId ?? undefined,
        lumpSum: c.dailyCostOverride,
        note: c.note ?? '',
    };
}

const textOrNull = (s: string | null | undefined): string | null => {
    const t = s?.trim() ?? '';
    return t === '' ? null : t;
};

const wholeOrNull = (n: number | null | undefined): number | null =>
    typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;

/** The request body of a filled crew form (trade is required by the form; undefined → undefined so callers can stop). */
export function crewFormToRequest(v: CrewFormValues): CreateCrewRequest | undefined {
    if (v.trade === undefined) return undefined;
    const lump = v.rateSource === 'lump';
    const leaderId = v.leaderId ?? null;
    return {
        name: v.name.trim(),
        trade: v.trade,
        leaderId,
        // The leader is listed as a leader, not twice.
        memberIds: [...new Set(v.memberIds)].filter(id => id !== leaderId),
        skilledCount: count(v.skilledCount),
        labourerCount: count(v.labourerCount),
        rateCardId: lump ? null : (v.rateCardId ?? null),
        dailyCostOverride: lump ? wholeOrNull(v.lumpSum) : null,
        note: textOrNull(v.note),
    };
}

/** Update body for an existing crew; the rate fields are left out when the caller cannot see them (never wipe them). */
export function crewUpdate(req: CreateCrewRequest, wagesHidden: boolean): UpdateCrewRequest {
    const { rateCardId, dailyCostOverride, memberIds, leaderId, note, ...rest } = req;
    return {
        ...rest,
        memberIds,
        leaderId: leaderId ?? null,
        note: note ?? null,
        ...(wagesHidden ? {} : { rateCardId: rateCardId ?? null, dailyCostOverride: dailyCostOverride ?? null }),
    };
}

export interface PersonFormValues {
    name: string;
    nickname: string;
    phone: string;
    role: PersonRole;
    employment: EmploymentType;
    trades: WorkforceTradeId[];
    dailyWage: number | null;
    note: string;
}

export const EMPTY_PERSON_FORM: PersonFormValues = {
    name: '', nickname: '', phone: '', role: 'skilled', employment: 'daily', trades: [], dailyWage: null, note: '',
};

export function personToForm(p: PersonDto): PersonFormValues {
    return {
        name: p.name, nickname: p.nickname ?? '', phone: p.phone ?? '', role: p.role, employment: p.employment,
        trades: [...p.trades], dailyWage: p.dailyWage, note: p.note ?? '',
    };
}

export function personFormToRequest(v: PersonFormValues): CreatePersonRequest {
    return {
        name: v.name.trim(),
        nickname: textOrNull(v.nickname),
        phone: textOrNull(v.phone),
        role: v.role,
        employment: v.employment,
        trades: [...new Set(v.trades)],
        dailyWage: wholeOrNull(v.dailyWage),
        note: textOrNull(v.note),
    };
}

/** Update body for an existing person; the wage is left out when the caller cannot see it. */
export function personUpdate(req: CreatePersonRequest, wagesHidden: boolean): UpdatePersonRequest {
    const { dailyWage, trades, nickname, phone, note, ...rest } = req;
    return {
        ...rest,
        trades: trades ?? [],
        nickname: nickname ?? null,
        phone: phone ?? null,
        note: note ?? null,
        ...(wagesHidden ? {} : { dailyWage: dailyWage ?? null }),
    };
}
