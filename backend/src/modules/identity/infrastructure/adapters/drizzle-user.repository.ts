import { eq, inArray } from 'drizzle-orm';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, asUserId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { users } from '../../../../shared/infrastructure/database/schema';
import { UserRepository } from '../../application/ports/user.repository';
import { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { DisplayName } from '../../domain/value-objects/display-name.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { isUniqueViolation } from './postgres-errors';

type UserRow = typeof users.$inferSelect;

function toUser(row: UserRow): User {
    return User.rehydrate({
        id: asUserId(row.id),
        email: Email.rehydrate(row.email),
        displayName: DisplayName.rehydrate(row.displayName),
        passwordHash: row.passwordHash,
        createdAt: row.createdAt,
    });
}

export class DrizzleUserRepository extends UserRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(id: UserId): Promise<User | undefined> {
        const rows = await this.ctx.executor.select().from(users).where(eq(users.id, id)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toUser(row);
    }

    async findByEmail(email: Email): Promise<User | undefined> {
        const rows = await this.ctx.executor.select().from(users).where(eq(users.email, email.value)).limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toUser(row);
    }

    async findMany(ids: readonly UserId[]): Promise<User[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(users).where(inArray(users.id, [...new Set(ids)]));
        return rows.map(toUser);
    }

    async insert(user: User): Promise<Result<void, DomainError>> {
        try {
            await this.ctx.executor.insert(users).values({
                id: user.id,
                email: user.email.value,
                displayName: user.displayName.value,
                passwordHash: user.passwordHash,
                createdAt: user.createdAt,
            });
            return okVoid();
        } catch (error: unknown) {
            // A concurrent registration with the same e-mail won the race.
            if (isUniqueViolation(error, 'users_email_key')) return err(IdentityErrors.emailTaken());
            throw error;
        }
    }
}
