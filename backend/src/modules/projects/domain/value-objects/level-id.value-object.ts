// ─── Level id: a level of the guided journey (JOURNEY_LEVELS of the shared domain) ───
import { JOURNEY_LEVELS } from '@contrack/domain/journey/levels';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

const LEVEL_IDS: ReadonlySet<string> = new Set(JOURNEY_LEVELS.map(l => l.id));

export class LevelId {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<LevelId, DomainError> {
        return LEVEL_IDS.has(raw)
            ? ok(new LevelId(raw))
            : err(DomainError.unprocessable(`There is no level "${raw}" in the journey`, { levelId: raw }));
    }
}
