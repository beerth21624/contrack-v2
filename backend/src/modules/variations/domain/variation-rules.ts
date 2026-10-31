// ─── Rules of variation orders that need no IO ───
import type { ContractVariationBilling, MainContractBillingMode } from '@contrack/contract';

/** Label of the milestone a `separate_milestone` VO adds to the contract (stored data in both document languages). */
export const variationMilestoneLabel = (number: string): { th: string; en: string } => ({
    th: `งานเพิ่ม-ลด ${number}`,
    en: `Variation ${number}`,
});

/** Billing of a new VO when none is given: with the next claim on a progress-billed contract, else spread (D-251). */
export const defaultVariationBilling = (mode: MainContractBillingMode): ContractVariationBilling =>
    mode === 'progress' ? 'next_claim' : 'spread';
