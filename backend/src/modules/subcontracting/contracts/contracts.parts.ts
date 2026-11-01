// ─── What the contracts work stream adds to SubcontractingModule (controllers + providers) ───
// Owned by the contracts work stream: list every controller and provider of this stream here. Providers of the ports this
// stream implements (see ../shared/ports.ts) must be registered here too, and listed in the exports.
import type { Provider, Type } from '@nestjs/common';
import { persistence } from '../../../shared/infrastructure/core.module';
import { SubcontractCommitments } from '../../../shared/application/ports';
import { SubcontractCreator, SubcontractingSettingsReader, VendorLinkListener, VendorStats } from '../shared/ports';
import { ContractAccess } from './application/contract-access';
import { ContractNotices } from './application/contract-notices';
import { ContractViews } from './application/contract-views';
import { PackageFollowUp } from './application/package-follow-up';
import { ClaimRepository } from './application/ports/claim.repository';
import { ContractDocumentRepository } from './application/ports/contract-document.repository';
import { RatingRepository } from './application/ports/rating.repository';
import { RetentionRepository } from './application/ports/retention.repository';
import { ScSettingsRepository } from './application/ports/sc-settings.repository';
import { SubcontractRepository } from './application/ports/subcontract.repository';
import { VariationRepository } from './application/ports/variation.repository';
import { RetentionDueSweep } from './application/retention-due-sweep';
import {
    ApproveClaimUseCase, InspectClaimUseCase, ListClaimsUseCase, PayClaimUseCase, RejectClaimUseCase, RequestClaimUseCase,
} from './application/use-cases/claims.use-case';
import { CreateSubcontractUseCase } from './application/use-cases/create-subcontract.use-case';
import {
    ListProjectSubcontractsUseCase, ListVendorSubcontractsUseCase, ListWorkspaceRetentionUseCase,
} from './application/use-cases/lists.use-case';
import { GetOverviewUseCase, GetReportUseCase, ProjectFactsLoader } from './application/use-cases/overview.use-case';
import { ListRetentionUseCase, MoveRetentionUseCase } from './application/use-cases/retention.use-case';
import { GetScSettingsUseCase, GetTradeChecklistsUseCase, PutScSettingsUseCase } from './application/use-cases/settings.use-case';
import {
    AcceptSubcontractUseCase, AttachSignedScanUseCase, CancelSubcontractUseCase, CloseSubcontractUseCase,
    CompleteSubcontractUseCase, GetContractDocumentUseCase, GetSubcontractUseCase, RateSubcontractUseCase,
    RequestContractChangeUseCase, TerminateSubcontractUseCase, UpdateContractDocumentUseCase,
} from './application/use-cases/subcontract-lifecycle.use-case';
import { ListVariationsUseCase, ProposeVariationUseCase, RespondVariationUseCase } from './application/use-cases/variations.use-case';
import {
    RepositoryModuleUsage, RepositorySettingsReader, RepositoryVendorLinkListener, RepositoryVendorStats,
} from './infrastructure/adapters/contracts-ports.adapters';
import { DrizzleClaimRepository } from './infrastructure/adapters/drizzle-claim.repository';
import { DrizzleContractDocumentRepository } from './infrastructure/adapters/drizzle-contract-document.repository';
import { DrizzleRatingRepository } from './infrastructure/adapters/drizzle-rating.repository';
import { DrizzleRetentionRepository } from './infrastructure/adapters/drizzle-retention.repository';
import { DrizzleScSettingsRepository } from './infrastructure/adapters/drizzle-sc-settings.repository';
import { DrizzleSubcontractRepository } from './infrastructure/adapters/drizzle-subcontract.repository';
import { DrizzleVariationRepository } from './infrastructure/adapters/drizzle-variation.repository';
import { InMemoryClaimRepository } from './infrastructure/adapters/in-memory-claim.repository';
import { InMemoryContractDocumentRepository } from './infrastructure/adapters/in-memory-contract-document.repository';
import { InMemoryRatingRepository } from './infrastructure/adapters/in-memory-rating.repository';
import { InMemoryRetentionRepository } from './infrastructure/adapters/in-memory-retention.repository';
import { InMemoryScSettingsRepository } from './infrastructure/adapters/in-memory-sc-settings.repository';
import { InMemorySubcontractRepository } from './infrastructure/adapters/in-memory-subcontract.repository';
import { InMemoryVariationRepository } from './infrastructure/adapters/in-memory-variation.repository';
import { RepositorySubcontractCommitments } from './infrastructure/adapters/subcontract-commitments.adapter';
import {
    ProjectContractsController, SubcontractsController, VendorContractsController, WorkspaceContractsController,
} from './presentation/contracts.controller';

export const CONTRACTS_CONTROLLERS: Type[] = [
    WorkspaceContractsController, ProjectContractsController, VendorContractsController, SubcontractsController,
];

export const CONTRACTS_PROVIDERS: Provider[] = [
    // repositories
    persistence(SubcontractRepository, () => new InMemorySubcontractRepository(), ctx => new DrizzleSubcontractRepository(ctx)),
    persistence(ContractDocumentRepository, () => new InMemoryContractDocumentRepository(), ctx => new DrizzleContractDocumentRepository(ctx)),
    persistence(VariationRepository, () => new InMemoryVariationRepository(), ctx => new DrizzleVariationRepository(ctx)),
    persistence(ClaimRepository, () => new InMemoryClaimRepository(), ctx => new DrizzleClaimRepository(ctx)),
    persistence(RetentionRepository, () => new InMemoryRetentionRepository(), ctx => new DrizzleRetentionRepository(ctx)),
    persistence(RatingRepository, () => new InMemoryRatingRepository(), ctx => new DrizzleRatingRepository(ctx)),
    persistence(ScSettingsRepository, () => new InMemoryScSettingsRepository(), ctx => new DrizzleScSettingsRepository(ctx)),
    // ports provided to the other streams / modules
    { provide: SubcontractingSettingsReader, useClass: RepositorySettingsReader },
    { provide: SubcontractCreator, useClass: CreateSubcontractUseCase },
    { provide: VendorStats, useClass: RepositoryVendorStats },
    { provide: VendorLinkListener, useClass: RepositoryVendorLinkListener },
    { provide: SubcontractCommitments, useClass: RepositorySubcontractCommitments },
    // registers the running-work counter of the module in ModuleWorkRegistry (onModuleInit)
    RepositoryModuleUsage,
    // application services
    ContractAccess, ContractViews, ContractNotices, PackageFollowUp, ProjectFactsLoader, RetentionDueSweep,
    // use cases
    GetScSettingsUseCase, PutScSettingsUseCase, GetTradeChecklistsUseCase,
    GetOverviewUseCase, GetReportUseCase,
    ListProjectSubcontractsUseCase, ListVendorSubcontractsUseCase, ListWorkspaceRetentionUseCase,
    GetSubcontractUseCase, GetContractDocumentUseCase, UpdateContractDocumentUseCase, AcceptSubcontractUseCase,
    RequestContractChangeUseCase, CancelSubcontractUseCase, TerminateSubcontractUseCase, CompleteSubcontractUseCase,
    CloseSubcontractUseCase, AttachSignedScanUseCase, RateSubcontractUseCase,
    ListVariationsUseCase, ProposeVariationUseCase, RespondVariationUseCase,
    ListClaimsUseCase, RequestClaimUseCase, InspectClaimUseCase, ApproveClaimUseCase, PayClaimUseCase, RejectClaimUseCase,
    ListRetentionUseCase, MoveRetentionUseCase,
];

/** Ports from ../shared/ports.ts (or shared/application/ports.ts) this stream provides to the others. */
export const CONTRACTS_EXPORTS: (abstract new (...args: never[]) => unknown)[] = [
    SubcontractCreator, SubcontractingSettingsReader, VendorStats, VendorLinkListener, SubcontractCommitments,
];
