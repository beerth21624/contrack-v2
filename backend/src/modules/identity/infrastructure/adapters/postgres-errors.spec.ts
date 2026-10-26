import { isUniqueViolation } from './postgres-errors';

describe('isUniqueViolation', () => {
    const pgError = { code: '23505', constraint: 'users_email_key' };

    it('recognises a pg unique violation directly', () => {
        expect(isUniqueViolation(pgError)).toBe(true);
        expect(isUniqueViolation(pgError, 'users_email_key')).toBe(true);
    });

    it('recognises it wrapped by Drizzle (error.cause)', () => {
        const wrapped = Object.assign(new Error('Failed query: insert into "users"'), { cause: pgError });
        expect(isUniqueViolation(wrapped, 'users_email_key')).toBe(true);
    });

    it('checks the constraint name when given', () => {
        expect(isUniqueViolation({ code: '23505', constraint: 'users_pkey' }, 'users_email_key')).toBe(false);
    });

    it('ignores other errors', () => {
        expect(isUniqueViolation(new Error('connection refused'))).toBe(false);
        expect(isUniqueViolation({ code: '23503' })).toBe(false);
        expect(isUniqueViolation(undefined)).toBe(false);
        expect(isUniqueViolation('23505')).toBe(false);
    });
});
