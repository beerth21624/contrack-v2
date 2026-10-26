// Names for rooms added by "ทำซ้ำ": the next free number, never a name already used.

/**
 * Name for a copy of `name`: "ห้องนอน 1" → "ห้องนอน 2", "ห้องนอน 1 (1)" → "ห้องนอน 1 (2)", "ครัว" → "ครัว (2)",
 * skipping names in `used`. An empty name stays empty.
 */
export function nextCopyName(name: string, used: readonly string[]): string {
    const base = name.trim();
    if (base === '') return '';
    const taken = new Set(used.map(u => u.trim()));
    const paren = /^(.*\()(\d+)(\))$/.exec(base);
    const tail = /^(.*?)(\d+)$/.exec(base);
    let make: (n: number) => string;
    let n: number;
    if (paren) {
        const [, head = '', num = '1', close = ')'] = paren;
        make = k => `${head}${String(k)}${close}`;
        n = Number(num) + 1;
    } else if (tail) {
        const [, head = '', num = '1'] = tail;
        make = k => `${head}${String(k)}`;
        n = Number(num) + 1;
    } else {
        make = k => `${base} (${String(k)})`;
        n = 2;
    }
    while (taken.has(make(n))) n++;
    return make(n);
}
