// ─── SweepMarks (shared port): once-per-day marks of the daily sweeps, table `sweep_marks` ───
import { SweepMarks } from '../../../../shared/application/ports';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { sweepMarks } from '../../../../shared/infrastructure/database/schema-platform';

/** Postgres: insert … on conflict do nothing; a returned row = first mark. */
export class DrizzleSweepMarks extends SweepMarks {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async markOnce(sweep: string, key: string, date: string): Promise<boolean> {
        const rows = await this.ctx.executor.insert(sweepMarks).values({ sweep, key, markDate: date })
            .onConflictDoNothing().returning({ sweep: sweepMarks.sweep });
        return rows.length > 0;
    }
}

export class InMemorySweepMarks extends SweepMarks {
    private readonly marks = new Set<string>();

    markOnce(sweep: string, key: string, date: string): Promise<boolean> {
        const id = JSON.stringify([sweep, key, date]);
        if (this.marks.has(id)) return Promise.resolve(false);
        this.marks.add(id);
        return Promise.resolve(true);
    }

    /** Marks stored (tests). */
    get size(): number {
        return this.marks.size;
    }
}
