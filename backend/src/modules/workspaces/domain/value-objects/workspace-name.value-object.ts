import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';

export const WORKSPACE_NAME_MAX_LENGTH = 120;

/** A workspace name: trimmed, 1–120 characters. */
export class WorkspaceName {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<WorkspaceName, DomainError> {
        const value = raw.trim();
        if (value.length === 0) return err(DomainError.validation('Workspace name is required'));
        if (value.length > WORKSPACE_NAME_MAX_LENGTH) {
            return err(DomainError.validation(`Workspace name must be at most ${WORKSPACE_NAME_MAX_LENGTH} characters`));
        }
        return ok(new WorkspaceName(value));
    }

    /** Trusted value read back from storage. */
    static rehydrate(value: string): WorkspaceName {
        return new WorkspaceName(value);
    }

    equals(other: WorkspaceName): boolean {
        return this.value === other.value;
    }
}
