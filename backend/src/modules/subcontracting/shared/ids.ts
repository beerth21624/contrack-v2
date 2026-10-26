// ─── Branded ids of the subcontracting module ───
import type { Brand } from '../../../shared/domain/ids';

export type PackageId = Brand<string, 'PackageId'>;
export type ScInvitationId = Brand<string, 'ScInvitationId'>;
export type VendorListEntryId = Brand<string, 'VendorListEntryId'>;
export type PortfolioItemId = Brand<string, 'PortfolioItemId'>;
export type QuestionId = Brand<string, 'QuestionId'>;
export type BidId = Brand<string, 'BidId'>;
export type MessageId = Brand<string, 'MessageId'>;
export type AwardId = Brand<string, 'AwardId'>;
export type SubcontractId = Brand<string, 'SubcontractId'>;
export type VariationId = Brand<string, 'VariationId'>;
export type ClaimId = Brand<string, 'ClaimId'>;
export type RetentionEntryId = Brand<string, 'RetentionEntryId'>;
export type RatingId = Brand<string, 'RatingId'>;

export const asPackageId = (v: string): PackageId => v as PackageId;
export const asScInvitationId = (v: string): ScInvitationId => v as ScInvitationId;
export const asVendorListEntryId = (v: string): VendorListEntryId => v as VendorListEntryId;
export const asPortfolioItemId = (v: string): PortfolioItemId => v as PortfolioItemId;
export const asQuestionId = (v: string): QuestionId => v as QuestionId;
export const asBidId = (v: string): BidId => v as BidId;
export const asMessageId = (v: string): MessageId => v as MessageId;
export const asAwardId = (v: string): AwardId => v as AwardId;
export const asSubcontractId = (v: string): SubcontractId => v as SubcontractId;
export const asVariationId = (v: string): VariationId => v as VariationId;
export const asClaimId = (v: string): ClaimId => v as ClaimId;
export const asRetentionEntryId = (v: string): RetentionEntryId => v as RetentionEntryId;
export const asRatingId = (v: string): RatingId => v as RatingId;
