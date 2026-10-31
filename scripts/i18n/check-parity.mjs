#!/usr/bin/env node
// ─── Checks that every message file has the same keys in Thai and English (docs/erp/03-i18n.md §3) ───
// Usage: node scripts/i18n/check-parity.mjs [messagesDir]   → exit 0 when th and en match, exit 1 (with a list) when not.
// The same logic runs in vitest (src/i18n/__tests__/parity.test.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PARITY_LOCALES = /** @type {const} */ (['th', 'en']);

/** @param {unknown} v */
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Every leaf key path (`a.b.c`) of a message tree, with what the leaf is ("string", "object" for an empty object,
 * or the JS type of anything that should not be there).
 * @param {unknown} tree
 * @param {string} [prefix]
 * @returns {Map<string, string>}
 */
export function leafKeys(tree, prefix = '') {
    /** @type {Map<string, string>} */
    const out = new Map();
    if (!isPlainObject(tree)) {
        out.set(prefix, typeof tree);
        return out;
    }
    const entries = Object.entries(/** @type {Record<string, unknown>} */ (tree));
    if (entries.length === 0 && prefix !== '') out.set(prefix, 'object');
    for (const [key, value] of entries) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (isPlainObject(value)) {
            for (const [k, v] of leafKeys(value, path)) out.set(k, v);
        } else {
            out.set(path, Array.isArray(value) ? 'array' : typeof value);
        }
    }
    return out;
}

/**
 * Problems between two locales' messages ({namespace: tree}); empty when they match.
 * @param {Record<string, unknown>} th
 * @param {Record<string, unknown>} en
 * @returns {string[]}
 */
export function compareMessages(th, en) {
    /** @type {string[]} */
    const problems = [];
    const namespaces = [...new Set([...Object.keys(th), ...Object.keys(en)])].sort();
    for (const ns of namespaces) {
        if (!(ns in th)) { problems.push(`namespace "${ns}" is missing in th`); continue; }
        if (!(ns in en)) { problems.push(`namespace "${ns}" is missing in en`); continue; }
        const a = leafKeys(th[ns]);
        const b = leafKeys(en[ns]);
        for (const [key, kind] of a) {
            const label = key === '' ? ns : `${ns}.${key}`;
            if (!b.has(key)) problems.push(`${label}: missing in en`);
            else if (b.get(key) !== kind) problems.push(`${label}: ${kind} in th but ${b.get(key)} in en`);
            else if (kind !== 'string' && kind !== 'object') problems.push(`${label}: must be a string (is ${kind})`);
        }
        for (const key of b.keys()) {
            if (!a.has(key)) problems.push(`${key === '' ? ns : `${ns}.${key}`}: missing in th`);
        }
    }
    return problems;
}

/**
 * Reads `<dir>/<locale>/*.json` (file name = namespace) for each locale.
 * @param {string} dir
 * @returns {Record<string, Record<string, unknown>>}
 */
export function loadMessages(dir) {
    /** @type {Record<string, Record<string, unknown>>} */
    const all = {};
    for (const locale of PARITY_LOCALES) {
        /** @type {Record<string, unknown>} */
        const namespaces = {};
        for (const file of readdirSync(join(dir, locale)).filter(f => f.endsWith('.json')).sort()) {
            namespaces[file.slice(0, -'.json'.length)] = JSON.parse(readFileSync(join(dir, locale, file), 'utf8'));
        }
        all[locale] = namespaces;
    }
    return all;
}

/**
 * Problems of the message files under `dir` (default: src/i18n/messages of this repository).
 * @param {string} [dir]
 * @returns {string[]}
 */
export function checkParity(dir = fileURLToPath(new URL('../../src/i18n/messages', import.meta.url))) {
    const all = loadMessages(dir);
    return compareMessages(all.th ?? {}, all.en ?? {});
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    const dir = process.argv[2] === undefined ? undefined : resolve(process.argv[2]);
    const problems = checkParity(dir);
    if (problems.length > 0) {
        console.error(`i18n parity: ${problems.length} problem(s)`);
        for (const p of problems) console.error(`  - ${p}`);
        process.exit(1);
    }
    console.log('i18n parity: th and en match');
}
