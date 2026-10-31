// ─── Strict HTML sanitizer for documents people edit as rich text (subcontracts, main contracts) ───
// Moved from src/domain/subcontracting/contract-template.ts (WP-26), which re-exports it. A small allowlist of formatting
// tags with every attribute removed, so a document can never carry script, links, styles or event handlers into the
// other party's browser.

/** Escapes text for HTML (every value put into a template goes through this). */
export function escapeHtmlText(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const ALLOWED_TAGS = new Set([
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span',
]);
const VOID_TAGS = new Set(['br', 'hr']);
/** Tags whose CONTENT is dropped too (code, styles, embedded documents, raw text). */
const DROP_WITH_CONTENT = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'noembed', 'noframes', 'textarea', 'title',
    'xmp', 'plaintext', 'svg', 'math', 'select', 'head', 'frameset', 'applet',
]);
const TAG_START = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)/;

/** Index of the `>` that ends the tag starting before `from` (quotes respected), or -1. */
function tagEnd(html: string, from: number): number {
    let quote: string | null = null;
    for (let k = from; k < html.length; k++) {
        const c = html[k];
        if (quote !== null) {
            if (c === quote) quote = null;
        } else if (c === '"' || c === '\'') {
            quote = c;
        } else if (c === '>') {
            return k;
        }
    }
    return -1;
}

/**
 * Keeps only p, br, h1–h3, strong, b, em, i, u, ul, ol, li, table, thead, tbody, tr, th, td, hr, span — WITHOUT any
 * attribute. Other tags are removed (script-like ones with their content), comments and declarations dropped, a stray
 * `<` becomes `&lt;` and `>` in text becomes `&gt;`. Every `<` of the output is one of the allowed bare tags.
 */
export function sanitizeContractHtml(html: string): string {
    let out = '';
    let i = 0;
    const n = html.length;
    while (i < n) {
        const c = html.charAt(i);
        if (c !== '<') {
            out += c === '>' ? '&gt;' : c === '\u0000' ? '' : c;
            i += 1;
            continue;
        }
        if (html.startsWith('<!--', i)) {
            const end = html.indexOf('-->', i + 4);
            i = end < 0 ? n : end + 3;
            continue;
        }
        const next = html.charAt(i + 1);
        if (next === '!' || next === '?') {
            const end = html.indexOf('>', i);
            i = end < 0 ? n : end + 1;
            continue;
        }
        const m = TAG_START.exec(html.slice(i, i + 64));
        const end = m === null ? -1 : tagEnd(html, i + m[0].length);
        if (m === null || end < 0) {
            out += '&lt;';
            i += 1;
            continue;
        }
        const closing = m[1] === '/';
        const name = (m[2] ?? '').toLowerCase();
        i = end + 1;
        if (DROP_WITH_CONTENT.has(name)) {
            if (!closing) {
                const closer = new RegExp(`</${name}`, 'gi');
                closer.lastIndex = i;
                const close = closer.exec(html);
                const closeEnd = close === null ? -1 : html.indexOf('>', close.index);
                i = closeEnd < 0 ? n : closeEnd + 1;
            }
            continue;
        }
        if (!ALLOWED_TAGS.has(name)) continue;
        if (VOID_TAGS.has(name)) {
            if (!closing) out += `<${name}>`;
            continue;
        }
        out += closing ? `</${name}>` : `<${name}>`;
    }
    return out;
}

/** Same sanitizer under a neutral name (ERP documents). */
export const sanitizeDocumentHtml = sanitizeContractHtml;
