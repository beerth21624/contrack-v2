// ─── Crew (ทีมช่าง): a leader, named members and/or a typed headcount, priced by a company rate card or a ฿/day ───
// A crew may be headcount only (ช่าง 3 · คนงาน 2), so the members do not have to be typed one by one.
import type { WorkforceTradeId } from '@contrack/contract';
import type { CrewId, PersonId, RateCardId, WorkspaceId } from '../../../../shared/domain';
import type { WorkforceName } from '../value-objects/workforce-name.value-object';

export interface CrewProps {
    id: CrewId;
    workspaceId: WorkspaceId;
    name: WorkforceName;
    trade: WorkforceTradeId;
    leaderId: PersonId | null;
    /** Named members, in the order given (no duplicates). */
    memberIds: PersonId[];
    skilledCount: number;
    labourerCount: number;
    rateCardId: RateCardId | null;
    /** A typed lump sum ฿/day that overrides the rate card. */
    dailyCostOverride: number | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export type CrewFields = Omit<CrewProps, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

/** The fields an update may change (undefined = keep; null = clear). */
export type CrewChanges = Partial<CrewFields>;

const copyDate = (d: Date): Date => new Date(d.getTime());
const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

export class Crew {
    private constructor(private props: CrewProps) {}

    static create(input: CrewFields & { id: CrewId; workspaceId: WorkspaceId; now: Date }): Crew {
        const { now, ...rest } = input;
        return new Crew({
            ...rest, memberIds: [...new Set(rest.memberIds)], createdAt: copyDate(now), updatedAt: copyDate(now), archivedAt: null,
        });
    }

    /** From storage (no rules re-applied). */
    static rehydrate(props: CrewProps): Crew {
        return new Crew({
            ...props,
            memberIds: [...props.memberIds],
            createdAt: copyDate(props.createdAt),
            updatedAt: copyDate(props.updatedAt),
            archivedAt: props.archivedAt === null ? null : copyDate(props.archivedAt),
        });
    }

    get id(): CrewId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get name(): WorkforceName { return this.props.name; }
    get trade(): WorkforceTradeId { return this.props.trade; }
    get leaderId(): PersonId | null { return this.props.leaderId; }
    get memberIds(): PersonId[] { return [...this.props.memberIds]; }
    get skilledCount(): number { return this.props.skilledCount; }
    get labourerCount(): number { return this.props.labourerCount; }
    get rateCardId(): RateCardId | null { return this.props.rateCardId; }
    get dailyCostOverride(): number | null { return this.props.dailyCostOverride; }
    get note(): string | null { return this.props.note; }
    get createdAt(): Date { return copyDate(this.props.createdAt); }
    get updatedAt(): Date { return copyDate(this.props.updatedAt); }
    get archivedAt(): Date | null { return this.props.archivedAt === null ? null : copyDate(this.props.archivedAt); }
    get isArchived(): boolean { return this.props.archivedAt !== null; }

    /** The person leads the crew or is one of its named members. */
    involves(personId: PersonId): boolean {
        return this.props.leaderId === personId || this.props.memberIds.includes(personId);
    }

    /** Applies the changes; false when every given value equals the current one. */
    update(changes: CrewChanges, now: Date): boolean {
        const next: CrewProps = { ...this.props };
        let changed = false;
        if (changes.name !== undefined && !changes.name.equals(next.name)) {
            next.name = changes.name;
            changed = true;
        }
        if (changes.memberIds !== undefined) {
            const members = [...new Set(changes.memberIds)];
            if (!sameList(members, next.memberIds)) {
                next.memberIds = members;
                changed = true;
            }
        }
        for (const key of ['trade', 'leaderId', 'skilledCount', 'labourerCount', 'rateCardId', 'dailyCostOverride', 'note'] as const) {
            const value = changes[key];
            if (value !== undefined && value !== next[key]) {
                (next as Record<typeof key, unknown>)[key] = value;
                changed = true;
            }
        }
        if (!changed) return false;
        this.props = { ...next, updatedAt: copyDate(now) };
        return true;
    }

    /** Takes an archived person out of the crew (as leader and as member); false when they were not in it. */
    removePerson(personId: PersonId, now: Date): boolean {
        if (!this.involves(personId)) return false;
        this.props = {
            ...this.props,
            leaderId: this.props.leaderId === personId ? null : this.props.leaderId,
            memberIds: this.props.memberIds.filter(id => id !== personId),
            updatedAt: copyDate(now),
        };
        return true;
    }

    /** Soft delete. False when it is already archived. */
    archive(now: Date): boolean {
        if (this.props.archivedAt !== null) return false;
        this.props = { ...this.props, archivedAt: copyDate(now), updatedAt: copyDate(now) };
        return true;
    }

    toProps(): CrewProps {
        return { ...this.props, memberIds: this.memberIds, createdAt: this.createdAt, updatedAt: this.updatedAt, archivedAt: this.archivedAt };
    }
}
