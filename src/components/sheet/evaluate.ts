/**
 * Reads what a user typed in a number cell: a plain number ("1,250.5") or simple arithmetic as typed in
 * Excel ("7*2.3", "=12+3.5", "(4+2)*0.9"). Only + - * / ( ) and numbers; anything else gives undefined.
 */
export function evaluateNumber(text: string): number | undefined {
    const src = text.replace(/,/g, '').replace(/^\s*=/, '').replace(/[×x]/g, '*').replace(/÷/g, '/').trim();
    if (src === '') return undefined;
    let i = 0;
    const peek = () => src[i];
    const skip = () => { while (src[i] === ' ') i++; };

    function primary(): number {
        skip();
        const c = peek();
        if (c === '(') {
            i++;
            const v = expr();
            skip();
            if (peek() !== ')') throw new Error('missing )');
            i++;
            return v;
        }
        if (c === '-') { i++; return -primary(); }
        if (c === '+') { i++; return primary(); }
        const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(src.slice(i));
        if (!m) throw new Error('number expected');
        i += m[0].length;
        return Number(m[0]);
    }
    function term(): number {
        let v = primary();
        for (;;) {
            skip();
            const c = peek();
            if (c === '*') { i++; v *= primary(); } else if (c === '/') { i++; v /= primary(); } else return v;
        }
    }
    function expr(): number {
        let v = term();
        for (;;) {
            skip();
            const c = peek();
            if (c === '+') { i++; v += term(); } else if (c === '-') { i++; v -= term(); } else return v;
        }
    }

    try {
        const v = expr();
        skip();
        return i === src.length && Number.isFinite(v) ? v : undefined;
    } catch {
        return undefined;
    }
}
