// ─── Default adapters for Clock / IdGenerator, plus fixed versions for tests ───
import { randomUUID } from 'node:crypto';
import { Clock, IdGenerator } from '../application/ports';

export class SystemClock extends Clock {
    now(): Date {
        return new Date();
    }
}

export class RandomIdGenerator extends IdGenerator {
    newId(): string {
        return randomUUID();
    }
}

/** A clock tests can move. */
export class FixedClock extends Clock {
    constructor(private current: Date = new Date('2026-01-01T00:00:00.000Z')) {
        super();
    }

    now(): Date {
        return new Date(this.current.getTime());
    }

    advance(ms: number): void {
        this.current = new Date(this.current.getTime() + ms);
    }

    set(date: Date): void {
        this.current = new Date(date.getTime());
    }
}

/** Deterministic UUID-shaped ids for tests (…-000000000001, …-000000000002, …). */
export class SequentialIdGenerator extends IdGenerator {
    private n = 0;

    newId(): string {
        this.n += 1;
        return `00000000-0000-4000-8000-${this.n.toString(16).padStart(12, '0')}`;
    }
}
