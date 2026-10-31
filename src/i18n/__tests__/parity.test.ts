import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@/shared/contract';
import { checkParity, compareMessages } from '../../../scripts/i18n/check-parity.mjs';
import en from '../messages/en';
import th from '../messages/th';

describe('i18n parity (th ↔ en)', () => {
    it('the message files have the same keys in both languages', () => {
        expect(checkParity()).toEqual([]);
    });

    it('index.ts of each language bundles the same namespaces', () => {
        expect(compareMessages(th, en)).toEqual([]);
    });

    it('reports a key missing in one language and a namespace missing in the other', () => {
        expect(compareMessages({ a: { x: '1', y: { z: '2' } } }, { a: { x: '1' }, b: {} })).toEqual([
            'a.y.z: missing in en',
            'namespace "b" is missing in th',
        ]);
    });

    it('errors.codes has a text for every API error code (and the client-side ones)', () => {
        for (const code of [...ERROR_CODES, 'network_error', 'invalid_response']) {
            expect(th.errors.codes).toHaveProperty(code);
        }
    });
});
