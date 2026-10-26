// ─── Project name: trimmed, 1–160 characters (same rule as the contract's projectNameSchema) ───
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export const PROJECT_NAME_MAX = 160;

export class ProjectName {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<ProjectName, DomainError> {
        const value = raw.trim();
        if (value.length === 0) return err(DomainError.validation('The project name is required'));
        if (value.length > PROJECT_NAME_MAX) {
            return err(DomainError.validation(`The project name is longer than ${PROJECT_NAME_MAX} characters`));
        }
        return ok(new ProjectName(value));
    }

    equals(other: ProjectName): boolean {
        return this.value === other.value;
    }
}
