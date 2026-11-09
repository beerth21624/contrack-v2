// ─── Dev-mode trace labels of the roof beam step (docs/dev-mode/README.md §5) ───
// Names follow the roof beam page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';


/**
 * An input's term is its path without array indexes (`{field}.width`), the formulas use the bare field name
 * (`width`): every name is also known with the `{field}.` prefix so both resolve.
 */
const withPrefix = (labels: CalcTraceLabels, prefix: string): CalcTraceLabels => {
    const alias = (t: Record<string, string>): Record<string, string> => ({
        ...Object.fromEntries(Object.entries(t).filter(([k]) => !k.includes('*')).map(([k, v]) => [`${prefix}.${k}`, v])),
        ...t,
    });
    const set = (l: CalcTraceLabels['th']): CalcTraceLabels['th'] => ({
        ...l, terms: alias(l.terms), ...(l.units ? { units: alias(l.units) } : {}),
    });
    return { th: set(labels.th), en: set(labels.en) };
};

const BASE: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            name: 'ชื่อคาน',
            width: 'กว้าง',
            depth: 'ลึก',
            length: 'ยาว',
            mainSize: 'เหล็กเสริมหลัก · ขนาด',
            mainCount: 'เหล็กเสริมหลัก · จำนวน (เส้น)',
            stirrupSize: 'เหล็กปลอก · ขนาด',
            stirrupSpacing: 'เหล็กปลอก · ระยะห่าง @',
            // hard-coded constants
            propSpacing: 'ระยะห่างไม้ค้ำยัน (1 ต้นต่อ)',
            kgPerM: 'น้ำหนักเหล็ก {size} ต่อเมตร',
            // intermediate values used in formulas
            mainLength: 'เหล็กเสริมหลัก ความยาว รวม',
            mainKg: 'เหล็กเสริมหลัก น้ำหนัก',
            stirrupCount: 'เหล็กปลอก จำนวน (ปลอก)',
            stirrupPerimeter: 'เหล็กปลอก ความยาว/เส้น',
            stirrupLength: 'เหล็กปลอก ความยาว รวม',
            stirrupKg: 'เหล็กปลอก น้ำหนัก',
            mainWeight: 'เหล็กเสริมหลัก น้ำหนัก รวม',
            stirrupWeight: 'เหล็กปลอก น้ำหนัก รวม',
            // outputs (and the same names inside formulas)
            props: 'ไม้ค้ำยัน',
            formwork: 'ไม้แบบ',
            formworkExcel: 'ไม้แบบ (สูตรเดิมของแม่แบบ ใช้เทียบเท่านั้น)',
            concrete: 'คอนกรีต โครงสร้าง',
            'main.*': 'เหล็กเสริมหลัก {0} รวม',
            'stirrup.*': 'เหล็กปลอก {0} รวม',
            'rebar.*': 'เหล็กเสริม {0} รวม',
        },
        units: {
            width: 'ม.', depth: 'ม.', length: 'ม.', mainCount: 'เส้น', stirrupSpacing: 'ม.',
            propSpacing: 'ม.', kgPerM: 'กก./ม.',
            mainLength: 'ม.', mainKg: 'กก.', stirrupCount: 'ปลอก', stirrupPerimeter: 'ม.', stirrupLength: 'ม.', stirrupKg: 'กก.',
            mainWeight: 'กก.', stirrupWeight: 'กก.',
            props: 'ต้น', formwork: 'ตร.ม.', formworkExcel: 'ตร.ม.', concrete: 'ลบ.ม.',
            'main.*': 'กก.', 'stirrup.*': 'กก.', 'rebar.*': 'กก.',
        },
        steps: {
            mainLength: { label: 'เหล็กเสริมหลัก ความยาว รวม', formula: '{mainCount} × {length}', unit: 'ม.' },
            mainKg: { label: 'เหล็กเสริมหลัก {size} น้ำหนัก', formula: '{mainLength} × {kgPerM}', unit: 'กก.' },
            stirrupNone: { label: 'เหล็กปลอก (ไม่ได้ใส่ระยะห่าง จึงไม่คิดปลอก)', formula: '0', unit: '' },
            stirrupCount: { label: 'เหล็กปลอก จำนวน (ปัดขึ้น)', formula: 'ปัดขึ้น({length} ÷ {stirrupSpacing})', unit: 'ปลอก' },
            stirrupPerimeter: { label: 'เหล็กปลอก ความยาว/เส้น', formula: '2 × ({width} + {depth})', unit: 'ม.' },
            stirrupLength: { label: 'เหล็กปลอก ความยาว รวม', formula: '{stirrupCount} × {stirrupPerimeter}', unit: 'ม.' },
            stirrupKg: { label: 'เหล็กปลอก {size} น้ำหนัก', formula: '{stirrupLength} × {kgPerM}', unit: 'กก.' },
            props: { label: 'ไม้ค้ำยัน (ปัดขึ้น)', formula: 'ปัดขึ้น({length} ÷ {propSpacing})', unit: 'ต้น' },
            formwork: { label: 'ไม้แบบ (ข้างคาน 2 ด้าน + ท้องคาน)', formula: '2 × {depth} × {length} + {width} × {length}', unit: 'ตร.ม.' },
            formworkExcel: { label: 'ไม้แบบ ตามสูตรเดิมของแม่แบบ (ใช้เทียบเท่านั้น ไม่ส่งเข้า BOQ)', formula: '2 × {depth} × {length} + {width}', unit: 'ตร.ม.' },
            concrete: { label: 'คอนกรีต โครงสร้าง', formula: '{width} × {depth} × {length}', unit: 'ลบ.ม.' },
            totalProps: { label: 'ไม้ค้ำยัน รวม', formula: 'Σ {props}', unit: 'ต้น' },
            totalFormwork: { label: 'ไม้แบบ รวม', formula: 'Σ {formwork}', unit: 'ตร.ม.' },
            totalFormworkExcel: { label: 'ไม้แบบ ตามสูตรเดิมของแม่แบบ รวม (ใช้เทียบเท่านั้น)', formula: 'Σ {formworkExcel}', unit: 'ตร.ม.' },
            totalConcrete: { label: 'คอนกรีต โครงสร้าง รวม', formula: 'Σ {concrete}', unit: 'ลบ.ม.' },
            totalMainKg: { label: 'เหล็กเสริมหลัก {size} รวม', formula: 'Σ {mainKg}', unit: 'กก.' },
            totalStirrupKg: { label: 'เหล็กปลอก {size} รวม', formula: 'Σ {stirrupKg}', unit: 'กก.' },
            totalRebar: { label: 'เหล็กเสริม {size} รวม (ส่งเข้า BOQ)', formula: '{mainWeight} + {stirrupWeight}', unit: 'กก.' },
        },
    },
    en: {
        terms: {
            name: 'Beam name',
            width: 'Width',
            depth: 'Depth',
            length: 'Length',
            mainSize: 'Main bars · size',
            mainCount: 'Main bars · number (bars)',
            stirrupSize: 'Stirrups · size',
            stirrupSpacing: 'Stirrups · spacing @',
            propSpacing: 'Prop spacing (1 prop per)',
            kgPerM: 'Weight of {size} bar per metre',
            mainLength: 'Main bars, total length',
            mainKg: 'Main bars, weight',
            stirrupCount: 'Stirrups, number',
            stirrupPerimeter: 'Stirrups, length per stirrup',
            stirrupLength: 'Stirrups, total length',
            stirrupKg: 'Stirrups, weight',
            mainWeight: 'Main bars, weight total',
            stirrupWeight: 'Stirrups, weight total',
            props: 'Props',
            formwork: 'Formwork',
            formworkExcel: 'Formwork (the template\'s original formula, for comparison only)',
            concrete: 'Structural concrete',
            'main.*': 'Main bars {0}, total',
            'stirrup.*': 'Stirrups {0}, total',
            'rebar.*': 'Reinforcement {0}, total',
        },
        units: {
            width: 'm', depth: 'm', length: 'm', mainCount: 'bars', stirrupSpacing: 'm',
            propSpacing: 'm', kgPerM: 'kg/m',
            mainLength: 'm', mainKg: 'kg', stirrupCount: 'stirrups', stirrupPerimeter: 'm', stirrupLength: 'm', stirrupKg: 'kg',
            mainWeight: 'kg', stirrupWeight: 'kg',
            props: 'props', formwork: 'sq.m.', formworkExcel: 'sq.m.', concrete: 'cu.m.',
            'main.*': 'kg', 'stirrup.*': 'kg', 'rebar.*': 'kg',
        },
        steps: {
            mainLength: { label: 'Main bars, total length', formula: '{mainCount} × {length}', unit: 'm' },
            mainKg: { label: 'Main bars {size}, weight', formula: '{mainLength} × {kgPerM}', unit: 'kg' },
            stirrupNone: { label: 'Stirrups (no spacing entered, so none counted)', formula: '0', unit: '' },
            stirrupCount: { label: 'Stirrups, number (rounded up)', formula: 'round up({length} ÷ {stirrupSpacing})', unit: 'stirrups' },
            stirrupPerimeter: { label: 'Stirrups, length per stirrup', formula: '2 × ({width} + {depth})', unit: 'm' },
            stirrupLength: { label: 'Stirrups, total length', formula: '{stirrupCount} × {stirrupPerimeter}', unit: 'm' },
            stirrupKg: { label: 'Stirrups {size}, weight', formula: '{stirrupLength} × {kgPerM}', unit: 'kg' },
            props: { label: 'Props (rounded up)', formula: 'round up({length} ÷ {propSpacing})', unit: 'props' },
            formwork: { label: 'Formwork (2 beam sides + soffit)', formula: '2 × {depth} × {length} + {width} × {length}', unit: 'sq.m.' },
            formworkExcel: { label: 'Formwork by the template\'s original formula (comparison only, not sent to the BOQ)', formula: '2 × {depth} × {length} + {width}', unit: 'sq.m.' },
            concrete: { label: 'Structural concrete', formula: '{width} × {depth} × {length}', unit: 'cu.m.' },
            totalProps: { label: 'Props, total', formula: 'Σ {props}', unit: 'props' },
            totalFormwork: { label: 'Formwork, total', formula: 'Σ {formwork}', unit: 'sq.m.' },
            totalFormworkExcel: { label: 'Formwork by the original formula, total (comparison only)', formula: 'Σ {formworkExcel}', unit: 'sq.m.' },
            totalConcrete: { label: 'Structural concrete, total', formula: 'Σ {concrete}', unit: 'cu.m.' },
            totalMainKg: { label: 'Main bars {size}, total', formula: 'Σ {mainKg}', unit: 'kg' },
            totalStirrupKg: { label: 'Stirrups {size}, total', formula: 'Σ {stirrupKg}', unit: 'kg' },
            totalRebar: { label: 'Reinforcement {size}, total (sent to the BOQ)', formula: '{mainWeight} + {stirrupWeight}', unit: 'kg' },
        },
    },
};

export const ROOF_BEAM_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'rows');
