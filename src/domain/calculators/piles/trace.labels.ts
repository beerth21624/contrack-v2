// ─── Dev-mode trace labels of the piling step (docs/dev-mode/README.md §5) ───
// Names follow the piling page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const PILES_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            pileType: 'ชนิดเสาเข็ม',
            section: 'หน้าตัด / รูปทรง',
            length: 'ความยาว',
            count: 'จำนวน (ต้น)',
            pricePerPile: 'ราคาเหมาต่อต้น',
            extraSpec: 'รายละเอียดเพิ่มเติม',
            totalCost: 'ค่าเสาเข็มรวม',
        },
        units: { length: 'ม.', count: 'ต้น', pricePerPile: 'บาท', totalCost: 'บาท' },
        steps: {
            pileCount: { label: 'จำนวนเสาเข็ม', formula: '{count}', unit: 'ต้น' },
            pilePrice: { label: 'ราคาเหมาต่อต้น', formula: '{pricePerPile}', unit: 'บาท' },
            totalCost: { label: 'ค่าเสาเข็มรวม', formula: '{count} × {pricePerPile}', unit: 'บาท' },
        },
    },
    en: {
        terms: {
            pileType: 'Pile type',
            section: 'Section / shape',
            length: 'Length',
            count: 'Number (piles)',
            pricePerPile: 'Lump-sum price per pile',
            extraSpec: 'Additional details',
            totalCost: 'Total pile cost',
        },
        units: { length: 'm', count: 'piles', pricePerPile: 'baht', totalCost: 'baht' },
        steps: {
            pileCount: { label: 'Number of piles', formula: '{count}', unit: 'piles' },
            pilePrice: { label: 'Lump-sum price per pile', formula: '{pricePerPile}', unit: 'baht' },
            totalCost: { label: 'Total pile cost', formula: '{count} × {pricePerPile}', unit: 'baht' },
        },
    },
};
