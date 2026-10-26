// Extracts cached values of the three planning sheets (Man-Day_Basic, S-Curve_Plan_Basic, CashFLOW_Basic)
// from the v5 dump into the golden JSON used by src/domain/planning/__tests__.
// Usage: node scripts/excel/extract-planning-golden.mjs %TEMP%/ctrv2/v5 src/domain/planning/__tests__/golden.planning.v5.json
import fs from 'node:fs';

const dir = process.argv[2];
const out = process.argv[3];

function load(name) {
    const cells = new Map();
    for (const line of fs.readFileSync(`${dir}/${name}`, 'utf8').split(/\r?\n/)) {
        const parts = line.split('\t');
        if (parts.length < 2 || !/^[A-Z]{1,3}\d+$/.test(parts[0])) continue;
        cells.set(parts[0], { v: parts[1], f: parts[2] ?? '' });
    }
    return cells;
}
const num = (cells, a) => {
    const c = cells.get(a);
    if (!c || c.v === '') return null;
    const n = Number(c.v);
    return Number.isFinite(n) ? n : c.v;
};
const colName = (i) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIdx = (s) => [...s].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const md = load('sheet02.txt');
const sc = load('sheet03.txt');
const cf = load('sheet04.txt');

const blocks = [15, 18, 31, 34, 37, 60, 67, 82, 96, 106, 113, 136, 147, 151, 161, 178, 184, 188, 193, 198, 204, 209, 217, 222, 233, 244, 254, 272, 278, 281, 293, 299];
const manday = {};
for (const r of blocks) manday[r] = Object.fromEntries(['O', 'P', 'Q', 'R', 'S', 'T', 'U'].map(c => [c, num(md, `${c}${r}`)]));

const J = colIdx('J');
const BE = colIdx('BE');
const gridRow = (cells, r, from, to) => {
    const o = [];
    for (let i = from; i <= to; i++) o.push(num(cells, `${colName(i)}${r}`));
    return o;
};
const taskRows = [14, 16, 18, 20, 22, 24, 26, 29, 31, 33, 35, 37, 40, 42, 44, 47, 49, 52, 54, 57, 59, 61, 63, 65, 68, 70, 73, 75, 77, 79, 81, 83];
const tasks = taskRows.map(r => ({
    row: r, no: sc.get(`B${r}`)?.v, name: sc.get(`C${r}`)?.v,
    D: num(sc, `D${r}`), E: num(sc, `E${r}`), F: num(sc, `F${r}`), G: num(sc, `G${r}`), H: num(sc, `H${r}`),
    grid: gridRow(sc, r, J, BE),
    actual: { D: num(sc, `D${r + 1}`), E: num(sc, `E${r + 1}`), F: num(sc, `F${r + 1}`), G: num(sc, `G${r + 1}`), H: num(sc, `H${r + 1}`), grid: gridRow(sc, r + 1, J, BE) },
    progress: num(sc, `BF${r}`),
}));
const scurve = {
    D5: num(sc, 'D5'), D6: num(sc, 'D6'), D7: num(sc, 'D7'),
    Q4: num(sc, 'Q4'), Q5: num(sc, 'Q5'), Q6: num(sc, 'Q6'), Q7: num(sc, 'Q7'),
    row9: gridRow(sc, 9, J, BE), row10: gridRow(sc, 10, J, BE), row11: gridRow(sc, 11, J, BE), row12: gridRow(sc, 12, J, BE),
    tasks,
    ...Object.fromEntries([86, 87, 88, 89, 90, 91, 92, 93].map(r => [`row${r}`, gridRow(sc, r, J, BE)])),
};

const D = colIdx('D');
const W = colIdx('W');
const cfRows = {};
for (let r = 4; r <= 59; r++) {
    cfRows[r] = { A: num(cf, `A${r}`), B: num(cf, `B${r}`), C: num(cf, `C${r}`), Y: num(cf, `Y${r}`), Z: num(cf, `Z${r}`), weeks: gridRow(cf, r, D, W) };
}
const cashflow = {
    D2: num(cf, 'D2'), K2: num(cf, 'K2'),
    dash: Object.fromEntries(['AA2', 'AA4', 'AA6', 'AA7', 'AA8', 'AA9', 'AA10', 'AA11', 'AA12', 'AA13', 'AA14', 'AA15', 'Z18', 'Z19', 'Y55', 'B54'].map(a => [a, num(cf, a)])),
    rows: cfRows,
};

fs.writeFileSync(out, JSON.stringify({ manday, T310: num(md, 'T310'), U310: num(md, 'U310'), scurve, cashflow }, null, 1));
console.log('ok');
