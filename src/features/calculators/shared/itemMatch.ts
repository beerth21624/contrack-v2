// ─── AI catalogue matching for free text in pick-lists: the pure decisions ───
// When a typed item is not in the catalogue (spec: contract ai-assist.ts, module `ai-assist`), the model is asked
// which catalogue text means the same thing. This file decides what to show and remembers answers; the hook
// (useItemMatches.ts) does the debouncing and the network. No UI, no React.
import { ITEM_MATCH_AUTO, ITEM_MATCH_SUGGEST, type ItemMatch } from '@/shared/contract/ai-assist';
import { catalogueItem, matchKey, type Catalogue, type PickRow } from '@/domain/calculators/shared/pick-list';

export type SuggestionLevel = 'auto' | 'suggest' | 'none';

/** Normalised text the cache is keyed by (same spacing rules as the catalogue lookup). */
export const textKey = matchKey;

/** ≥ AUTO: "do you mean X?"; SUGGEST..AUTO: "maybe you mean X"; below, or no catalogue item: nothing. */
export function suggestionLevel(match: ItemMatch | null | undefined): SuggestionLevel {
    if (match?.item == null || textKey(match.item) === '') return 'none';
    if (match.confidence >= ITEM_MATCH_AUTO) return 'auto';
    if (match.confidence >= ITEM_MATCH_SUGGEST) return 'suggest';
    return 'none';
}

/** What the row shows under its item field. */
export interface ItemSuggestion {
    level: Exclude<SuggestionLevel, 'none'>;
    /** The catalogue text, verbatim (so `selectItem` applies its unit and prices exactly). */
    item: string;
}

/**
 * Answers remembered for the session: every model answer by normalised text (so the same text is never asked
 * twice, whatever the answer), the texts the user declined, and workspaces whose module answered `module_disabled`.
 */
export interface MatchStore {
    /** The remembered answer; undefined = never asked (or the answer did not arrive). */
    get(text: string): ItemMatch | undefined;
    remember(text: string, match: ItemMatch): void;
    /** Texts of `inputs` (deduplicated, non-empty) that still need an answer. */
    pending(texts: readonly string[]): string[];
    isDeclined(text: string): boolean;
    decline(text: string): void;
    /** The module answered 404 `module_disabled` for this workspace: do not ask again this session. */
    markDisabled(workspaceId: string): void;
    isDisabled(workspaceId: string): boolean;
    /** The suggestion to show for `text`, or undefined (unknown, declined, below threshold, or an exact catalogue item). */
    suggestionFor(catalogue: Catalogue, text: string): ItemSuggestion | undefined;
    clear(): void;
}

export function createMatchStore(): MatchStore {
    const answers = new Map<string, ItemMatch>();
    const declined = new Set<string>();
    const disabled = new Set<string>();
    const store: MatchStore = {
        get: text => answers.get(textKey(text)),
        remember: (text, match) => { const k = textKey(text); if (k !== '') answers.set(k, match); },
        pending: texts => {
            const seen = new Set<string>();
            const out: string[] = [];
            for (const t of texts) {
                const k = textKey(t);
                if (k === '' || seen.has(k) || answers.has(k) || declined.has(k)) continue;
                seen.add(k);
                out.push(k);
            }
            return out;
        },
        isDeclined: text => declined.has(textKey(text)),
        decline: text => { const k = textKey(text); if (k !== '') declined.add(k); },
        markDisabled: id => { disabled.add(id); },
        isDisabled: id => disabled.has(id),
        suggestionFor: (catalogue, text) => {
            const k = textKey(text);
            if (k === '' || declined.has(k) || catalogueItem(catalogue, text) !== undefined) return undefined;
            const match = answers.get(k);
            const level = suggestionLevel(match);
            if (level === 'none' || match?.item == null) return undefined;
            // The model must name an existing catalogue text; anything else is treated as no match.
            if (catalogueItem(catalogue, match.item) === undefined) return undefined;
            return { level, item: match.item };
        },
        clear: () => { answers.clear(); declined.clear(); disabled.clear(); },
    };
    return store;
}

/** The app-wide store (one per page load). */
export const itemMatchStore: MatchStore = createMatchStore();

/** Limits of the request contract (ai-assist.ts): inputs ≤ 50 of ≤ 300 chars, catalogue ≤ 255 of ≤ 200 chars. */
export const MATCH_LIMITS = { inputs: 50, inputChars: 300, catalogue: 255, catalogueChars: 200 } as const;

/** Row texts that are non-empty and not in the catalogue (deduplicated by normalised text, list order). */
export function unmatchedTexts(rows: readonly PickRow[], catalogue: Catalogue): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
        const k = textKey(r.item);
        if (k === '' || k.length > MATCH_LIMITS.inputChars || seen.has(k) || catalogueItem(catalogue, r.item) !== undefined) continue;
        seen.add(k);
        out.push(k);
    }
    return out;
}

/** The catalogue texts to send: the original keys (the model answers with one of them verbatim). */
export function catalogueTexts(catalogue: Catalogue): string[] {
    return Object.keys(catalogue)
        .filter(k => textKey(k) !== '' && k.length <= MATCH_LIMITS.catalogueChars)
        .slice(0, MATCH_LIMITS.catalogue);
}

/** Stores a response: `matches[i]` answers `inputs[i]` (same order per contract); an unanswered input is left unknown. */
export function rememberResponse(store: MatchStore, inputs: readonly string[], matches: readonly ItemMatch[]): void {
    inputs.forEach((input, i) => {
        const m = matches[i];
        if (m) store.remember(input, m);
    });
}
