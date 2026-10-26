// ─── Default settings of the subcontracting module for a workspace that never saved any ───
import type { SubcontractingSettingsDto } from '@contrack/contract';

export const DEFAULT_SUBCONTRACTING_SETTINGS: SubcontractingSettingsDto = {
    defaultRetentionPct: 0.05,
    defaultWarrantyMonths: 12,
    defaultWhtPct: 0.03,
    estimatorCanAward: false,
    estimatorCanApproveClaims: false,
    viewerSeesPrices: false,
    levelingThreshold: 0.2,
    fixesBlockNextClaim: true,
    contractTemplateHtml: '',
};
