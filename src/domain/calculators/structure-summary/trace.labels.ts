// ─── Dev-mode trace labels of the structural materials summary (docs/dev-mode/README.md §5) ───
// Output keys are `<step>.<column>` and `total.<column>`; the names are generated from the lists below so every
// key has an exact label. Never mention the spreadsheet here.
import { REBAR_SIZES } from '../../boq/slots';
import type { CalcTraceLabels, TraceLabelSet } from '../../trace/types';

interface Name { th: string; en: string }

const COLUMNS: readonly { key: string; th: string; en: string; unit: Name }[] = [
    { key: 'excavation', th: 'ดินขุด', en: 'Excavation', unit: { th: 'ลบ.ม.', en: 'm³' } },
    { key: 'sand', th: 'ทรายหยาบ', en: 'Coarse sand', unit: { th: 'ลบ.ม.', en: 'm³' } },
    { key: 'lean', th: 'คอนกรีตหยาบ', en: 'Lean concrete', unit: { th: 'ลบ.ม.', en: 'm³' } },
    { key: 'plastic', th: 'พลาสติก กันชื้น', en: 'Damp-proof plastic', unit: { th: 'ตร.ม.', en: 'm²' } },
    { key: 'area', th: 'พื้นสำเร็จรูป', en: 'Precast slab', unit: { th: 'ตร.ม.', en: 'm²' } },
    { key: 'wiremesh', th: 'เหล็กไวร์เมช', en: 'Wire mesh', unit: { th: 'ตร.ม.', en: 'm²' } },
    ...REBAR_SIZES.map(s => ({ key: `rebar.${s}`, th: s, en: s, unit: { th: 'กก.', en: 'kg' } })),
    { key: 'props', th: 'ไม้ค้ำยัน', en: 'Props', unit: { th: 'ต้น', en: 'pcs' } },
    { key: 'formwork', th: 'ไม้แบบ', en: 'Formwork', unit: { th: 'ตร.ม.', en: 'm²' } },
    { key: 'concrete', th: 'คอนกรีต โครงสร้าง', en: 'Structural concrete', unit: { th: 'ลบ.ม.', en: 'm³' } },
    { key: 'backfill', th: 'ดิน ถมกลับ', en: 'Backfill', unit: { th: 'ลบ.ม.', en: 'm³' } },
];

const ELEMENTS: readonly { calc: string; th: string; en: string }[] = [
    { calc: 'footing', th: 'งานฐานราก', en: 'Footing' },
    { calc: 'pedestal', th: 'งานเสาตอม่อ', en: 'Pedestal' },
    { calc: 'ground-beam', th: 'งานคานคอดิน', en: 'Ground beam' },
    { calc: 'slab-on-grade', th: 'งานพื้นหล่อในที่', en: 'Slab on grade' },
    { calc: 'precast-slab', th: 'งานพื้นสำเร็จรูป', en: 'Precast slab' },
    { calc: 'column', th: 'งานเสาชั้น 1', en: 'Column (floor 1)' },
    { calc: 'roof-beam', th: 'งานคานดาดฟ้า', en: 'Roof beam' },
    { calc: 'roof-slab', th: 'งานพื้นดาดฟ้า', en: 'Roof slab' },
    { calc: 'stair', th: 'งานบันได', en: 'Stair' },
];

function build(l: 'th' | 'en'): TraceLabelSet {
    const total = l === 'th' ? 'รวม' : 'Total';
    const terms: Record<string, string> = {
        cell: l === 'th' ? 'ค่าของแต่ละงานโครงสร้าง' : 'value of each structural work',
        'total.rebar': l === 'th' ? 'เหล็กเสริม รวมทุกขนาด' : 'Reinforcement, all sizes',
    };
    const units: Record<string, string> = { 'total.rebar': l === 'th' ? 'กก.' : 'kg' };
    const steps: Record<string, { label: string; formula: string; unit: string }> = {};
    for (const c of COLUMNS) {
        terms[c.key] = c[l];   // a dependency value of that column (e.g. footing › excavation)
        terms[`total.${c.key}`] = `${c[l]} ${total}`;
        units[`total.${c.key}`] = c.unit[l];
        for (const e of ELEMENTS) {
            terms[`${e.calc}.${c.key}`] = `${c[l]} · ${e[l]}`;
            units[`${e.calc}.${c.key}`] = c.unit[l];
        }
        const note = c.key === 'backfill'
            ? (l === 'th' ? ' (ฐานรากใช้ค่าหลังหักเสาตอม่อ)' : ' (footing uses the value after pedestal deduction)')
            : '';
        steps[`colTotal.${c.key}`] = { label: `${c[l]} ${total}`, formula: `Σ {cell}${note}`, unit: c.unit[l] };
    }
    for (const s of REBAR_SIZES) terms[`kg_${s}`] = `${s} ${total}`;
    steps.rebarAll = {
        label: terms['total.rebar'] ?? '',
        formula: REBAR_SIZES.map(s => `{kg_${s}}`).join(' + '),
        unit: l === 'th' ? 'กก.' : 'kg',
    };
    return { terms, units, steps };
}

export const STRUCTURE_SUMMARY_TRACE_LABELS: CalcTraceLabels = { th: build('th'), en: build('en') };
