// ─── Plain name of a document in the UI language, for notices  ───
import { parseDocKey } from '@/domain/sync';
import { JOURNEY_LEVELS } from '@/domain/journey';
import { levelTitleIn } from '@/domain/journey/levels.en';
import { CALCULATORS } from '@/domain/calculators/registry';
import { readLocaleCookie } from '@/i18n/locale-cookie';
import { cloudText } from '../text';

export function docLabel(docKey: string): string {
    const t = cloudText();
    const locale = readLocaleCookie();
    const parsed = parseDocKey(docKey);
    if (!parsed) return t('docLabel.project');
    switch (parsed.kind) {
        case 'meta': return t('docLabel.project');
        case 'journey': return t('docLabel.journey');
        case 'planning': return t(`docLabel.${parsed.sheet}`);
        case 'boq': return t('docLabel.boq');
        case 'flag': return t('docLabel.flag');
        case 'calc': {
            const level = JOURNEY_LEVELS.find(l => l.kind.type === 'calc' && l.kind.calc === parsed.calcId);
            if (level) return t('docLabel.level', { title: levelTitleIn(level, locale) });
            const def = CALCULATORS.find(c => c.id === parsed.calcId);
            return def ? t('docLabel.calc', { title: locale === 'th' ? def.title : def.titleEn }) : t('docLabel.calcFallback');
        }
    }
}
