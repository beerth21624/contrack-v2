// ─── Business profiles, project types and their commercial defaults (docs/erp/00-vision.md §4) ───
// Pure. Order of precedence of a project's terms: project settings > company overrides > PROJECT_TYPE_DEFAULTS.
import {
    BUSINESS_PROFILES, PROJECT_TYPES, type BusinessProfile, type CompanyDefaults, type MilestoneTemplateItem,
    type ProjectCommercialSettings, type ProjectSettingsOverride, type ProjectType,
} from '../../shared/contract/erp/company';

export { BUSINESS_PROFILES, PROJECT_TYPES };
export type { BusinessProfile, CompanyDefaults, MilestoneTemplateItem, ProjectCommercialSettings, ProjectSettingsOverride, ProjectType };

const sign = (labelTh: string, labelEn: string, pct: number): MilestoneTemplateItem => ({ labelTh, labelEn, pct, trigger: 'signing' });
const step = (n: number, pct: number, progressAt: number): MilestoneTemplateItem => ({
    labelTh: `งวดที่ ${n}`, labelEn: `Installment ${n}`, pct, trigger: 'progress', progressAt,
});
const handover = (n: number, pct: number): MilestoneTemplateItem => ({
    labelTh: `งวดที่ ${n} (ส่งมอบงาน)`, labelEn: `Installment ${n} (handover)`, pct, trigger: 'handover',
});

/** Deposit 20% at signing + 8 x 10% (progress 12.5%, 25% … 87.5%; the 8th on handover), like the old CashFlow. */
const RESIDENTIAL_NEW_TEMPLATE: readonly MilestoneTemplateItem[] = [
    sign('มัดจำเมื่อเซ็นสัญญา', 'Deposit on signing', 0.2),
    ...[1, 2, 3, 4, 5, 6, 7].map(n => step(n, 0.1, n * 0.125)),
    handover(8, 0.1),
];

const RESIDENTIAL_RENOVATION_TEMPLATE: readonly MilestoneTemplateItem[] = [
    sign('มัดจำเมื่อเซ็นสัญญา', 'Deposit on signing', 0.3),
    step(1, 0.4, 0.5),
    step(2, 0.2, 0.9),
    handover(3, 0.1),
];

const GOVERNMENT_TEMPLATE: readonly MilestoneTemplateItem[] = [
    step(1, 0.25, 0.25),
    step(2, 0.25, 0.5),
    step(3, 0.25, 0.75),
    handover(4, 0.25),
];

const RESIDENTIAL_BASE = {
    priceSource: 'market',
    quotationFormat: 'lump_sum_by_category',
    detailLevel: 'per_category',
    billingMode: 'milestone',
    advancePct: 0,
    retentionPct: 0,
    customerWhtRate: 0,
    escalation: false,
    penaltyRatePerDay: 0,
    guaranteePct: 0,
    paymentTermDays: 30,
    documentLanguage: 'th',
} as const;

/** The built-in terms of each project type (00-vision.md §4). A company can override any field. */
export const PROJECT_TYPE_DEFAULTS: Readonly<Record<ProjectType, ProjectCommercialSettings>> = {
    residential_new: { ...RESIDENTIAL_BASE, milestoneTemplate: RESIDENTIAL_NEW_TEMPLATE.map(m => ({ ...m })), warrantyMonths: 12 },
    residential_renovation: { ...RESIDENTIAL_BASE, milestoneTemplate: RESIDENTIAL_RENOVATION_TEMPLATE.map(m => ({ ...m })), warrantyMonths: 6 },
    government: {
        priceSource: 'government',
        quotationFormat: 'government',
        detailLevel: 'full',
        billingMode: 'milestone',
        milestoneTemplate: GOVERNMENT_TEMPLATE.map(m => ({ ...m })),
        advancePct: 0.15,
        retentionPct: 0.05,
        customerWhtRate: 0.01,
        escalation: true,
        penaltyRatePerDay: 0.001,
        guaranteePct: 0.05,
        warrantyMonths: 24,
        paymentTermDays: 30,
        documentLanguage: 'th',
    },
    commercial: {
        priceSource: 'market',
        quotationFormat: 'detailed',
        detailLevel: 'full',
        billingMode: 'progress',
        milestoneTemplate: [],
        advancePct: 0.1,
        retentionPct: 0.05,
        customerWhtRate: 0.03,
        escalation: false,
        penaltyRatePerDay: 0.001,
        guaranteePct: 0.05,
        warrantyMonths: 12,
        paymentTermDays: 30,
        documentLanguage: 'th',
    },
};

/** Copy of `base` with every field `over` defines (undefined fields are ignored); the template is copied, not shared. */
function overlay(base: ProjectCommercialSettings, over: ProjectSettingsOverride | undefined): ProjectCommercialSettings {
    const out: ProjectCommercialSettings = { ...base, milestoneTemplate: base.milestoneTemplate.map(m => ({ ...m })) };
    if (over === undefined) return out;
    const target = out as unknown as Record<string, unknown>;
    for (const [key, raw] of Object.entries(over)) {
        const value: unknown = raw;
        if (value === undefined) continue;
        target[key] = key === 'milestoneTemplate' ? (value as MilestoneTemplateItem[]).map(m => ({ ...m })) : value;
    }
    return out;
}

/** Terms of a project: its own settings win over the company's overrides for the type, which win over the built-in defaults. */
export function resolveSettings(type: ProjectType, company: CompanyDefaults, project: ProjectSettingsOverride): ProjectCommercialSettings {
    return overlay(overlay(PROJECT_TYPE_DEFAULTS[type], company[type]), project);
}

/**
 * The project type a new project starts with, from the company's business profiles: the first profile in the order
 * residential → government → commercial that is selected; none selected → `residential_new`.
 */
export function defaultProjectTypeFor(businessProfiles: readonly BusinessProfile[]): ProjectType {
    if (businessProfiles.includes('residential')) return 'residential_new';
    if (businessProfiles.includes('government')) return 'government';
    if (businessProfiles.includes('commercial')) return 'commercial';
    return 'residential_new';
}
