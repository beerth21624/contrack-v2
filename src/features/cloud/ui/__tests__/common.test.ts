import { describe, expect, it } from 'vitest';
import { formatDateTime } from '../common';

describe('formatDateTime', () => {
    it('Thai month with the Christian-era year, like the rest of the app', () => {
        // Noon UTC: the same calendar day in any time zone the tests may run in.
        const s = formatDateTime('2026-10-26T12:00:00Z');
        expect(s).toMatch(/^26 ต\.ค\. 26 \d{2}:\d{2}$/);
        expect(s).not.toContain('69');
    });

    it('an invalid date gives an empty string', () => {
        expect(formatDateTime('not a date')).toBe('');
    });
});
