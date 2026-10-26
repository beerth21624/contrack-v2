// ─── Person (บุคลากร): someone who works on the company's sites; not necessarily a user of ConTrack ───
// The daily wage is personal data (PDPA): only owner/admin see it (the mapper hides it from the other roles).
import type { EmploymentType, PersonRole, WorkforceTradeId } from '@contrack/contract';
import type { PersonId, WorkspaceId } from '../../../../shared/domain';
import type { WorkforceName } from '../value-objects/workforce-name.value-object';

export interface PersonProps {
    id: PersonId;
    workspaceId: WorkspaceId;
    name: WorkforceName;
    nickname: string | null;
    phone: string | null;
    role: PersonRole;
    employment: EmploymentType;
    trades: WorkforceTradeId[];
    /** ฿/day; null = not set. */
    dailyWage: number | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export type PersonFields = Omit<PersonProps, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'archivedAt'>;

/** The fields an update may change (undefined = keep; null = clear). */
export type PersonChanges = Partial<PersonFields>;

const copyDate = (d: Date): Date => new Date(d.getTime());
const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

export class Person {
    private constructor(private props: PersonProps) {}

    static create(input: PersonFields & { id: PersonId; workspaceId: WorkspaceId; now: Date }): Person {
        const { now, ...rest } = input;
        return new Person({ ...rest, trades: [...rest.trades], createdAt: copyDate(now), updatedAt: copyDate(now), archivedAt: null });
    }

    /** From storage (no rules re-applied). */
    static rehydrate(props: PersonProps): Person {
        return new Person({
            ...props,
            trades: [...props.trades],
            createdAt: copyDate(props.createdAt),
            updatedAt: copyDate(props.updatedAt),
            archivedAt: props.archivedAt === null ? null : copyDate(props.archivedAt),
        });
    }

    get id(): PersonId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get name(): WorkforceName { return this.props.name; }
    get nickname(): string | null { return this.props.nickname; }
    get phone(): string | null { return this.props.phone; }
    get role(): PersonRole { return this.props.role; }
    get employment(): EmploymentType { return this.props.employment; }
    get trades(): WorkforceTradeId[] { return [...this.props.trades]; }
    get dailyWage(): number | null { return this.props.dailyWage; }
    get note(): string | null { return this.props.note; }
    get createdAt(): Date { return copyDate(this.props.createdAt); }
    get updatedAt(): Date { return copyDate(this.props.updatedAt); }
    get archivedAt(): Date | null { return this.props.archivedAt === null ? null : copyDate(this.props.archivedAt); }
    get isArchived(): boolean { return this.props.archivedAt !== null; }

    /** Applies the changes; false when every given value equals the current one. */
    update(changes: PersonChanges, now: Date): boolean {
        const next: PersonProps = { ...this.props };
        let changed = false;
        if (changes.name !== undefined && !changes.name.equals(next.name)) {
            next.name = changes.name;
            changed = true;
        }
        if (changes.trades !== undefined && !sameList(changes.trades, next.trades)) {
            next.trades = [...changes.trades];
            changed = true;
        }
        for (const key of ['nickname', 'phone', 'role', 'employment', 'dailyWage', 'note'] as const) {
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

    /** Soft delete. False when it is already archived. */
    archive(now: Date): boolean {
        if (this.props.archivedAt !== null) return false;
        this.props = { ...this.props, archivedAt: copyDate(now), updatedAt: copyDate(now) };
        return true;
    }

    toProps(): PersonProps {
        return { ...this.props, trades: this.trades, createdAt: this.createdAt, updatedAt: this.updatedAt, archivedAt: this.archivedAt };
    }
}
