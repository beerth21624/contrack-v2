// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
const file = fs.readFileSync('src/components/BOQSummaryTable.tsx', 'utf8');

const interfaceSectionRow = `
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
`;

const makeRowMatch = file.match(/function makeRow[\s\S]*?\}\n/);
let sectionsMatch = file.match(/const sections: Section\[\] = useMemo\(\(\) => \{([\s\S]*?)return \[\s+build\(0[\s\S]*?\}\);/);

if (!sectionsMatch) {
    // Let's match just the array
    sectionsMatch = file.match(/build\(0[\s\S]*?\}\);/);
}

// We just copy the logic.
// wait, we can just grab from 'function makeRow' up to '    }, [stepSaves, priceList, footingBOQ]);' 
// Actually since we want to be safe, I will just output a simple node script that reads BOQSummaryTable.tsx, regexes the useMemo block, and writes src/lib/boq-mapper.ts

const content = `
import { PriceItem, StepResult } from '@/types';

` + interfaceSectionRow + `

` + makeRowMatch[0] + `

export function buildBOQSections(
    stepSaves: Record<number, { inp?: unknown; res: StepResult } | undefined>,
    priceList: PriceItem[]
): Section[] {
` + file.substring(file.indexOf(`const build = (`), file.indexOf(`}, [stepSaves, priceList, footingBOQ]);`)) + `
    return [
` + file.substring(file.indexOf(`            build(0,`), file.indexOf(`        ];`, file.indexOf(`            build(0,`))) + `        ];
}
`;

fs.writeFileSync('src/lib/boq-mapper.ts', content);
