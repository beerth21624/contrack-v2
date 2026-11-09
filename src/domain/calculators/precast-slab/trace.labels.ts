// ─── Dev-mode trace labels of the precast slab step (docs/dev-mode/README.md §5) ───
// Names follow the precast slab page's field names. Formulas use {term} placeholders: each is a term below (an
// input field, a constant, or another step of the same row) and is shown once by name and once with its number.
// Never mention the spreadsheet here (no sheet names, column letters or row numbers).
import type { CalcTraceLabels } from '../../trace/types';

export const PRECAST_SLAB_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            width: 'ความกว้างช่วง',
            length: 'ความยาวช่วง',
            keySize: 'เหล็กล็อคหัวแผ่น · ขนาด',
            keySpacing: 'เหล็กล็อคหัวแผ่น · ระยะห่าง',
            keyBarLength: 'เหล็กล็อคหัวแผ่น · ยาวเส้นละ',
            topping: 'คอนกรีตทับหน้า หนา',
            // hard-coded constants
            kgPerM: 'น้ำหนักเหล็ก {size} ต่อเมตร',
            // intermediate values used in formulas
            area: 'แผ่นพื้น',
            wiremesh: 'ไวร์เมช',
            keyCount: 'เหล็กล็อคหัวแผ่น จำนวน',
            keyTotalLength: 'เหล็กล็อคหัวแผ่น ความยาว รวม',
            keyWeight: 'เหล็กล็อคหัวแผ่น น้ำหนัก',
            perimeter: 'เส้นรอบรูป',
            // outputs (and the same names inside formulas)
            formwork: 'ไม้แบบ',
            concrete: 'คอนกรีต ทับหน้า',
            'rebar.*': 'เหล็กล็อคหัวแผ่น {0} รวม',
        },
        units: {
            width: 'ม.', length: 'ม.', keySpacing: 'ม.', keyBarLength: 'ม.', topping: 'ม.', kgPerM: 'กก./ม.',
            area: 'ตร.ม.', wiremesh: 'ตร.ม.', keyCount: 'เส้น', keyTotalLength: 'ม.', keyWeight: 'กก.', perimeter: 'ม.',
            formwork: 'ตร.ม.', concrete: 'ลบ.ม.', 'rebar.*': 'กก.',
        },
        steps: {
            area: { label: 'แผ่นพื้น (พื้นที่)', formula: '{width} × {length}', unit: 'ตร.ม.' },
            wiremesh: { label: 'ไวร์เมช (เท่ากับพื้นที่แผ่นพื้น)', formula: '{area}', unit: 'ตร.ม.' },
            keyCount: { label: 'เหล็กล็อคหัวแผ่น จำนวน (ปัดขึ้น)', formula: 'ปัดขึ้น(2 × {width} ÷ {keySpacing})', unit: 'เส้น' },
            keyTotalLength: { label: 'เหล็กล็อคหัวแผ่น ความยาว รวม', formula: '{keyCount} × {keyBarLength}', unit: 'ม.' },
            keyWeight: { label: 'เหล็กล็อคหัวแผ่น {size} น้ำหนัก', formula: '{keyTotalLength} × {kgPerM}', unit: 'กก.' },
            perimeter: { label: 'เส้นรอบรูป', formula: '2 × ({width} + {length})', unit: 'ม.' },
            formwork: { label: 'ไม้แบบขอบ', formula: '{perimeter} × {topping}', unit: 'ตร.ม.' },
            concrete: { label: 'คอนกรีต ทับหน้า', formula: '{area} × {topping}', unit: 'ลบ.ม.' },
            totalArea: { label: 'แผ่นพื้น รวมทุกช่วง', formula: 'Σ {area}', unit: 'ตร.ม.' },
            totalWiremesh: { label: 'ไวร์เมช รวมทุกช่วง', formula: 'Σ {wiremesh}', unit: 'ตร.ม.' },
            totalFormwork: { label: 'ไม้แบบ รวมทุกช่วง', formula: 'Σ {formwork}', unit: 'ตร.ม.' },
            totalConcrete: { label: 'คอนกรีต ทับหน้า รวมทุกช่วง', formula: 'Σ {concrete}', unit: 'ลบ.ม.' },
            totalKeyWeight: { label: 'เหล็กล็อคหัวแผ่น {size} รวม', formula: 'Σ {keyWeight} (ช่วงที่ใช้ {size})', unit: 'กก.' },
        },
    },
    en: {
        terms: {
            width: 'Span width',
            length: 'Span length',
            keySize: 'Slab-end lock bars · size',
            keySpacing: 'Slab-end lock bars · spacing',
            keyBarLength: 'Slab-end lock bars · length per bar',
            topping: 'Topping concrete thickness',
            kgPerM: 'Weight of {size} bar per metre',
            area: 'Precast slab',
            wiremesh: 'Wire mesh',
            keyCount: 'Slab-end lock bars, number',
            keyTotalLength: 'Slab-end lock bars, total length',
            keyWeight: 'Slab-end lock bars, weight',
            perimeter: 'Perimeter',
            formwork: 'Formwork',
            concrete: 'Topping concrete',
            'rebar.*': 'Slab-end lock bars {0}, total',
        },
        units: {
            width: 'm', length: 'm', keySpacing: 'm', keyBarLength: 'm', topping: 'm', kgPerM: 'kg/m',
            area: 'm²', wiremesh: 'm²', keyCount: 'bars', keyTotalLength: 'm', keyWeight: 'kg', perimeter: 'm',
            formwork: 'm²', concrete: 'm³', 'rebar.*': 'kg',
        },
        steps: {
            area: { label: 'Precast slab (area)', formula: '{width} × {length}', unit: 'm²' },
            wiremesh: { label: 'Wire mesh (equals the slab area)', formula: '{area}', unit: 'm²' },
            keyCount: { label: 'Slab-end lock bars, number (rounded up)', formula: 'round up(2 × {width} ÷ {keySpacing})', unit: 'bars' },
            keyTotalLength: { label: 'Slab-end lock bars, total length', formula: '{keyCount} × {keyBarLength}', unit: 'm' },
            keyWeight: { label: 'Slab-end lock bars {size}, weight', formula: '{keyTotalLength} × {kgPerM}', unit: 'kg' },
            perimeter: { label: 'Perimeter', formula: '2 × ({width} + {length})', unit: 'm' },
            formwork: { label: 'Edge formwork', formula: '{perimeter} × {topping}', unit: 'm²' },
            concrete: { label: 'Topping concrete', formula: '{area} × {topping}', unit: 'm³' },
            totalArea: { label: 'Precast slab, all spans', formula: 'Σ {area}', unit: 'm²' },
            totalWiremesh: { label: 'Wire mesh, all spans', formula: 'Σ {wiremesh}', unit: 'm²' },
            totalFormwork: { label: 'Formwork, all spans', formula: 'Σ {formwork}', unit: 'm²' },
            totalConcrete: { label: 'Topping concrete, all spans', formula: 'Σ {concrete}', unit: 'm³' },
            totalKeyWeight: { label: 'Slab-end lock bars {size}, total', formula: 'Σ {keyWeight} (spans using {size})', unit: 'kg' },
        },
    },
};
