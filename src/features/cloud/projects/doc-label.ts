// ─── Plain Thai name of a document, for notices ("ขั้นตอนฐานราก", "ข้อมูลโครงการ" …) ───
import { parseDocKey } from '@/domain/sync';
import { JOURNEY_LEVELS } from '@/domain/journey';
import { CALCULATORS } from '@/domain/calculators/registry';

const PLANNING_LABEL = { manday: 'แผนแรงงาน (Man-Day)', schedule: 'แผนงาน (S-Curve)', cashflow: 'กระแสเงินสด (Cash Flow)' } as const;

export function docLabel(docKey: string): string {
    const parsed = parseDocKey(docKey);
    if (!parsed) return 'ข้อมูลโครงการ';
    switch (parsed.kind) {
        case 'meta': return 'ข้อมูลโครงการ';
        case 'journey': return 'สถานะขั้นตอน';
        case 'planning': return PLANNING_LABEL[parsed.sheet];
        case 'boq': return 'รายการใน BOQ';
        case 'calc': {
            const level = JOURNEY_LEVELS.find(l => l.kind.type === 'calc' && l.kind.calc === parsed.calcId);
            if (level) return `ขั้นตอน "${level.title}"`;
            const def = CALCULATORS.find(c => c.id === parsed.calcId);
            return def ? `"${def.title}"` : 'ข้อมูลเครื่องคำนวณ';
        }
    }
}
