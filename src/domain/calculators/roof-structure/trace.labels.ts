// ─── Dev-mode trace labels of the roof structure step (docs/dev-mode/README.md §5) ───
// Names follow the roof structure page. Never mention the spreadsheet here (no sheet names, column letters or row
// numbers). The six members share one pattern, so their labels are generated from one table per language.
import type { CalcTraceLabels, TraceLabelSet, TraceStepLabel } from '../../trace/types';

interface Words {
    member: Record<'wallPlate' | 'kingPosts' | 'ridge' | 'valley' | 'rafter' | 'purlin', string>;
    t: Record<string, string>;
    steel: string;     // 'steel sticks' etc.
    sticks: string;    // unit of a stick count
    round: string;     // 'round up'
    sqm: string; m: string; pcs: string;
}

const TH: Words = {
    member: { wallPlate: 'อะเส', kingPosts: 'ดั้ง', ridge: 'อกไก่', valley: 'ตะเข้ราง', rafter: 'จันทัน', purlin: 'แป' },
    t: {
        desc: 'รายการ', c: 'ซีคู่', lengths: 'ความยาวแต่ละช่วง', count: 'จำนวนเส้น', factor: 'ตัวคูณหลังคา',
        area: 'พื้นที่หลังคา (ตร.ม.)', spacing: 'ระยะห่าง', length: 'ความยาว', total: 'ความยาวรวม',
        sticks: 'จำนวนท่อน', segments: 'ความยาวแต่ละช่วง',
    },
    steel: 'ท่อน', sticks: 'ท่อน', round: 'ปัดขึ้น', sqm: 'ตร.ม.', m: 'ม.', pcs: 'เส้น',
};
const EN: Words = {
    member: { wallPlate: 'Wall plate', kingPosts: 'King posts', ridge: 'Ridge', valley: 'Valley', rafter: 'Rafter', purlin: 'Purlin' },
    t: {
        desc: 'Item', c: 'Double C', lengths: 'Length of each segment', count: 'Number of bars', factor: 'Roof factor',
        area: 'Roof area (sq.m)', spacing: 'Spacing', length: 'Length', total: 'Total length',
        sticks: 'Number of sticks', segments: 'Length of each segment',
    },
    steel: 'sticks', sticks: 'sticks', round: 'round up', sqm: 'sq.m', m: 'm', pcs: 'bars',
};

function build(w: Words, lang: 'th' | 'en'): TraceLabelSet {
    const M = w.member;
    const dash = ' · ';
    const terms: Record<string, string> = {};
    const units: Record<string, string> = {};
    const steps: Record<string, TraceStepLabel> = {};
    const th = lang === 'th';
    const step = (id: string, label: string, formula: string, unit: string) => { steps[id] = { label, formula, unit }; };

    // inputs, per member
    for (const k of ['wallPlate', 'ridge'] as const) {
        terms[`${k}.desc`] = `${M[k]}${dash}${w.t.desc}`;
        terms[`${k}.c`] = `${M[k]}${dash}${w.t.c}`;
        terms[`${k}.lengths`] = `${M[k]}${dash}${w.t.lengths}`;
        terms[`${k}.count`] = `${M[k]}${dash}${w.t.count}`;
        units[`${k}.lengths`] = w.m; units[`${k}.count`] = w.pcs;
    }
    terms['kingPosts.desc'] = `${M.kingPosts}${dash}${w.t.desc}`;
    terms['kingPosts.parts.desc'] = `${M.kingPosts}${dash}${th ? 'ชื่อ' : 'Name'}`;
    terms['kingPosts.parts.c'] = `${M.kingPosts}${dash}${w.t.c}`;
    terms['kingPosts.parts.length'] = `${M.kingPosts}${dash}${th ? 'ความสูง/ความยาว (ม.)' : 'Height / length (m)'}`;
    terms['kingPosts.parts.count'] = `${M.kingPosts}${dash}${th ? 'จำนวน (ต้น)' : 'Number (pcs)'}`;
    units['kingPosts.parts.length'] = w.m; units['kingPosts.parts.count'] = th ? 'ต้น' : 'pcs';
    terms['valley.desc'] = `${M.valley}${dash}${w.t.desc}`;
    terms['valley.c'] = `${M.valley}${dash}${w.t.c}`;
    terms['valley.runA'] = th ? 'ระยะราบ 1' : 'Horizontal run 1';
    terms['valley.runB'] = th ? 'ระยะราบ 2' : 'Horizontal run 2';
    terms['valley.deg'] = th ? 'ความลาดเอียง' : 'Pitch';
    terms['valley.count'] = `${M.valley}${dash}${w.t.count}`;
    units['valley.runA'] = w.m; units['valley.runB'] = w.m; units['valley.deg'] = th ? 'องศา' : 'degrees'; units['valley.count'] = w.pcs;
    for (const k of ['rafter', 'purlin'] as const) {
        terms[`${k}.desc`] = `${M[k]}${dash}${w.t.desc}`;
        terms[`${k}.c`] = `${M[k]}${dash}${w.t.c}`;
        terms[`${k}.factor`] = `${M[k]}${dash}${w.t.factor}`;
        terms[`${k}.area`] = `${M[k]}${dash}${w.t.area}`;
        terms[`${k}.spacing`] = `${M[k]}${dash}${w.t.spacing} (${w.m})`;
        units[`${k}.area`] = w.sqm; units[`${k}.spacing`] = w.m;
    }

    // hard-coded constants and the value read from the roofing step
    terms.stickLength = th ? 'ความยาวเหล็กต่อท่อน' : 'Length of one steel stick';
    units.stickLength = w.m;
    terms.slopeAreaDefault = th ? 'พื้นที่หลังคาตามแนวลาด (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนวัสดุมุงหลังคา)' : 'Sloped roof area (hard-coded, used when there is no roofing step)';
    units.slopeAreaDefault = w.sqm;
    terms.slopeArea = th ? 'พื้นที่หลังคาตามแนวลาด (จากขั้นตอนวัสดุมุงหลังคา)' : 'Sloped roof area (from the roofing step)';
    units.slopeArea = w.sqm;
    terms.linkedSlopeArea = terms.slopeArea; units.linkedSlopeArea = w.sqm;
    step('linkedSlopeArea', terms.slopeArea, '{slopeArea}', w.sqm);
    step('linkedSlopeAreaDefault', th ? 'พื้นที่หลังคาตามแนวลาด (ค่าฮาร์ดโค้ด)' : 'Sloped roof area (hard-coded value)', '{slopeAreaDefault}', w.sqm);

    // length members: wall plate and ridge
    for (const k of ['wallPlate', 'ridge'] as const) {
        terms[`${k}Segments`] = `${M[k]}${dash}${w.t.lengths}`;
        terms[`${k}Count`] = `${M[k]}${dash}${w.t.count}`;
        terms[`${k}Length`] = `${M[k]}${dash}${w.t.length}`;
        terms[`${k}C`] = `${M[k]}${dash}${w.t.c}`;
        terms[`${k}Total`] = `${M[k]}${dash}${w.t.total}`;
        terms[`${k}.length`] = `${M[k]}${dash}${w.t.length}`;
        terms[`${k}.total`] = `${M[k]}${dash}${w.t.total}`;
        units[`${k}Segments`] = w.m; units[`${k}Count`] = w.pcs; units[`${k}Length`] = w.m; units[`${k}Total`] = w.m;
        units[`${k}.length`] = w.m; units[`${k}.total`] = w.m;
        step(`${k}.length`, `${M[k]}${dash}${w.t.length}`, `Σ {${k}Segments}`, w.m);
        step(`${k}.total`, `${M[k]}${dash}${w.t.total}`, `({${k}Count} × {${k}Length}) × {${k}C}`, w.m);
    }
    // king posts: one row per part
    terms.partCount = th ? 'ดั้ง · จำนวน (ต้น)' : 'King post · number (pcs)';
    terms.partLength = th ? 'ดั้ง · ความสูง/ความยาว (ม.)' : 'King post · height / length (m)';
    terms.partC = `${M.kingPosts}${dash}${w.t.c}`;
    terms.partTotal = th ? 'ดั้ง · ความยาวรวม' : 'King post · total length';
    terms.kingPostsTotal = `${M.kingPosts}${dash}${w.t.total}`;
    terms['kingPosts.total'] = terms.kingPostsTotal;
    terms['kingPosts.part.*'] = th ? 'ดั้ง {0} · ความยาวรวม' : 'King post {0} · total length';
    units.partCount = th ? 'ต้น' : 'pcs'; units.partLength = w.m; units.partTotal = w.m; units.kingPostsTotal = w.m;
    units['kingPosts.total'] = w.m; units['kingPosts.part.*'] = w.m;
    step('partTotal', th ? 'ดั้ง · ความยาวรวม' : 'King post · total length', '({partCount} × {partLength}) × {partC}', w.m);
    step('kingPosts.total', terms.kingPostsTotal, 'Σ {partTotal}', w.m);
    // valley
    terms.runA = terms['valley.runA']; terms.runB = terms['valley.runB']; terms.deg = terms['valley.deg'];
    units.runA = w.m; units.runB = w.m; units.deg = units['valley.deg'] ?? '';
    terms.valleyCount = terms['valley.count']; terms.valleyC = terms['valley.c'];
    terms.valleyLength = th ? 'ความยาวตะเข้รางต่อเส้น' : 'Valley length per bar';
    terms['valley.length'] = terms.valleyLength;
    terms.valleyTotal = `${M.valley}${dash}${w.t.total}`;
    terms['valley.total'] = terms.valleyTotal;
    units.valleyCount = w.pcs; units.valleyLength = w.m; units['valley.length'] = w.m; units.valleyTotal = w.m; units['valley.total'] = w.m;
    step('valley.length', terms.valleyLength, th ? '√({runA}² + {runB}²) ÷ cos({deg})' : '√({runA}² + {runB}²) ÷ cos({deg})', w.m);
    step('valley.total', terms.valleyTotal, '({valleyCount} × {valleyLength}) × {valleyC}', w.m);
    // area members: rafter and purlin
    for (const k of ['rafter', 'purlin'] as const) {
        terms[`${k}AreaInput`] = `${M[k]}${dash}${w.t.area}`;
        terms[`${k}Area`] = `${M[k]}${dash}${w.t.area}`;
        terms[`${k}Spacing`] = `${M[k]}${dash}${w.t.spacing} (${w.m})`;
        terms[`${k}Factor`] = `${M[k]}${dash}${w.t.factor}`;
        terms[`${k}C`] = `${M[k]}${dash}${w.t.c}`;
        terms[`${k}Total`] = `${M[k]}${dash}${w.t.total}`;
        terms[`${k}.total`] = `${M[k]}${dash}${w.t.total}`;
        units[`${k}AreaInput`] = w.sqm; units[`${k}Area`] = w.sqm; units[`${k}Spacing`] = w.m; units[`${k}Total`] = w.sqm; units[`${k}.total`] = w.sqm;
        units[`${k}.area`] = w.sqm;
        step(`${k}.area`, `${M[k]}${dash}${w.t.area}`, '{linkedSlopeArea}', w.sqm);
        step(`${k}.areaTyped`, `${M[k]}${dash}${w.t.area}`, `{${k}AreaInput}`, w.sqm);
        step(`${k}.total`, `${M[k]}${dash}${th ? 'พื้นที่รวมที่ต้องใช้' : 'total quantity'}`,
            `(({${k}Area} ÷ {${k}Spacing}) × {${k}Factor}) × {${k}C}`, w.sqm);
        step(`${k}.totalNoSpacing`, `${M[k]}${dash}${th ? 'พื้นที่รวมที่ต้องใช้ (ระยะห่างว่าง)' : 'total quantity (empty spacing)'}`,
            th ? `ระยะห่างเป็น 0 ({${k}Spacing}) จึงนับเป็น 0` : `spacing is 0 ({${k}Spacing}), counted as 0`, w.sqm);
        terms[`${k}.total`] = `${M[k]}${dash}${th ? 'พื้นที่รวมที่ต้องใช้' : 'total quantity'}`;
    }
    // sticks (BOQ quantities)
    const lines: [string, string, string][] = [
        ['R152', 'wallPlate', 'wallPlateTotal'], ['R153', 'kingPosts', 'kingPostsTotal'], ['R154', 'ridge', 'ridgeTotal'],
        ['R155', 'valley', 'valleyTotal'], ['R156', 'rafter', 'rafterTotal'], ['R157', 'purlin', 'purlinTotal'],
    ];
    for (const [key, k, op] of lines) {
        const label = `${M[k as keyof typeof M]}${dash}${w.t.sticks}`;
        terms[key] = label; units[key] = w.steel;
        step(key, label, `${w.round}({${op}} ÷ {stickLength})`, w.steel);
    }
    terms.R159 = th ? 'ค่าแรงโครงสร้างเหล็ก · พื้นที่หลังคา (แป)' : 'Steel frame labour · roof area (purlin)';
    units.R159 = w.sqm;
    terms['purlin.area'] = `${M.purlin}${dash}${w.t.area}`;
    terms.purlinArea = `${M.purlin}${dash}${w.t.area}`; units.purlinArea = w.sqm;
    terms['rafter.area'] = `${M.rafter}${dash}${w.t.area}`;
    step('R159', terms.R159, '{purlinArea}', w.sqm);
    return { terms, units, steps };
}

export const ROOF_STRUCTURE_TRACE_LABELS: CalcTraceLabels = {
    th: build(TH, 'th'),
    en: build(EN, 'en'),
};
