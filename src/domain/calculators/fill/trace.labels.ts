// ─── Dev-mode trace labels of the soil fill step (docs/dev-mode/README.md §5) ───
// Names follow the fill page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const FILL_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            material: 'วัสดุถม · ผู้จัดหา',
            width: 'ขนาดที่ดิน กว้าง',
            length: 'ขนาดที่ดิน ยาว',
            height: 'ถมดินสูง',
            settlementPct: 'เผื่อดินยุบตัว',
            area: 'พื้นที่ที่ต้องถม',
            factor: 'ตัวคูณเผื่อดินยุบตัว',
            volume: 'ปริมาณดินที่ต้องสั่ง',
        },
        units: { width: 'ม.', length: 'ม.', height: 'ม.', settlementPct: '%', area: 'ตร.ม.', volume: 'ลบ.ม.' },
        steps: {
            area: { label: 'พื้นที่ที่ต้องถม', formula: '{width} × {length}', unit: 'ตร.ม.' },
            factor: { label: 'ตัวคูณเผื่อดินยุบตัว', formula: '1 + {settlementPct} ÷ 100', unit: '' },
            volume: { label: 'ปริมาณดินที่ต้องสั่ง', formula: '{width} × {length} × {height} × {factor}', unit: 'ลบ.ม.' },
        },
    },
    en: {
        terms: {
            material: 'Fill material · supplied by',
            width: 'Land size, width',
            length: 'Land size, length',
            height: 'Fill height',
            settlementPct: 'Settlement allowance',
            area: 'Area to fill',
            factor: 'Settlement allowance factor',
            volume: 'Soil quantity to order',
        },
        units: { width: 'm', length: 'm', height: 'm', settlementPct: '%', area: 'sq.m', volume: 'cu.m' },
        steps: {
            area: { label: 'Area to fill', formula: '{width} × {length}', unit: 'sq.m' },
            factor: { label: 'Settlement allowance factor', formula: '1 + {settlementPct} ÷ 100', unit: '' },
            volume: { label: 'Soil quantity to order', formula: '{width} × {length} × {height} × {factor}', unit: 'cu.m' },
        },
    },
};
