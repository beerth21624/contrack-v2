// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const file = fs.readFileSync('src/components/BOQSummaryTable.tsx', 'utf8');
const start = file.indexOf('const build =');
const end = file.indexOf('}, [stepSaves, priceList, footingBOQ]);');

const content = `import { PriceItem, StepResult } from '@/types';

export interface SectionRow {
    key: string;
    name: string;
    qty: number | null;
    uom: string;
    matUnit: number | null;
    matTotal: number | null;
    labUnit: number | null;
    labTotal: number | null;
    total: number | null;
}

export interface Section {
    stepNo: number;
    title: string;
    titleEn: string;
    hasData: boolean;
    rows: SectionRow[];
    sectionTotal: number;
}

export function makeRow(
    priceList: PriceItem[],
    code: string,
    qty: number,
    key: string,
): SectionRow | null {
    const p = priceList.find(x => x.code === code);
    if (!p || qty <= 0) return null;
    const mat = qty * p.costMaterial;
    const lab = qty * p.costLabor;
    return {
        key, name: p.name, qty, uom: p.uom,
        matUnit: p.costMaterial, matTotal: mat,
        labUnit: p.costLabor, labTotal: lab,
        total: mat + lab,
    };
}

export function buildBOQSections(
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>,
    priceList: PriceItem[]
): Section[] {
` + file.substring(start, end) + `
}
`;
fs.writeFileSync('src/lib/boq-mapper.ts', content);
