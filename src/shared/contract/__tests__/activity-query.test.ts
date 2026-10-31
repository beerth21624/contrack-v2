import { describe, expect, it } from 'vitest';
import { activityQuerySchema } from '../projects';

describe('activityQuerySchema.before', () => {
    const ok = (before: string) => activityQuerySchema.safeParse({ before }).success;

    it('accepts ids from 0 up to the largest bigint', () => {
        expect(ok('0')).toBe(true);
        expect(ok('9223372036854775807')).toBe(true);
    });

    it('refuses values past the bigint range or longer than 19 digits', () => {
        expect(ok('9223372036854775808')).toBe(false);
        expect(ok('12345678901234567890')).toBe(false);
    });

    it('refuses non-numbers without throwing (a throw became a 500)', () => {
        for (const v of ['abc', '-1', '1.5', '', ' 1', '1e3']) {
            expect(() => activityQuerySchema.safeParse({ before: v })).not.toThrow();
            expect(ok(v)).toBe(false);
        }
    });
});
