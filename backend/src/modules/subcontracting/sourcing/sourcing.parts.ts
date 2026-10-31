// ─── What the sourcing work stream adds to SubcontractingModule (controllers + providers) ───
// Owned by the sourcing work stream: list every controller and provider of this stream here. Providers of the ports this
// stream implements (see ../shared/ports.ts) must be registered here too, and listed in the exports.
import type { Provider, Type } from '@nestjs/common';
import { Clock, PhoneSignInHook, ScVendorDirectory } from '../../../shared/application/ports';
import { persistence } from '../../../shared/infrastructure/core.module';
import { PackageDirectory, VendorDirectory } from '../shared/ports';
import {
    InvitationRepository, QuestionRepository, VendorListRepository, VendorProfileRepository, WorkPackageRepository,
} from './application/ports/sourcing.repositories';
import { SmsRateLimiter } from './application/ports/sms-rate-limiter.port';
import { PackageLineGuard } from './application/services/package-line-guard.service';
import { PackageSnapshots } from './application/services/package-snapshots.service';
import { SourcingAccess } from './application/services/sourcing-access.service';
import { SourcingNotices } from './application/services/sourcing-notices.service';
import { SourcingViews } from './application/services/sourcing-views.service';
import { VendorLinker } from './application/services/vendor-linker.service';
import { VendorProfileViews } from './application/services/vendor-profile-views.service';
import { AddPortfolioItemUseCase } from './application/use-cases/add-portfolio-item.use-case';
import { AnswerQuestionUseCase } from './application/use-cases/answer-question.use-case';
import { AskQuestionUseCase } from './application/use-cases/ask-question.use-case';
import { AttachPackageFileUseCase } from './application/use-cases/attach-package-file.use-case';
import { CancelPackageUseCase } from './application/use-cases/cancel-package.use-case';
import { ClaimInvitationUseCase } from './application/use-cases/claim-invitation.use-case';
import { CreateInvitationsUseCase } from './application/use-cases/create-invitations.use-case';
import { CreatePackageUseCase } from './application/use-cases/create-package.use-case';
import { CreateVendorListEntryUseCase } from './application/use-cases/create-vendor-list-entry.use-case';
import { DeclineInvitationUseCase } from './application/use-cases/decline-invitation.use-case';
import { DeletePackageUseCase } from './application/use-cases/delete-package.use-case';
import { DeletePortfolioItemUseCase } from './application/use-cases/delete-portfolio-item.use-case';
import { DeleteVendorListEntryUseCase } from './application/use-cases/delete-vendor-list-entry.use-case';
import { ExtendDeadlineUseCase } from './application/use-cases/extend-deadline.use-case';
import { GetPackageUseCase } from './application/use-cases/get-package.use-case';
import { GetVendorCardUseCase } from './application/use-cases/get-vendor-card.use-case';
import { GetVendorProfileUseCase } from './application/use-cases/get-vendor-profile.use-case';
import { ImportVendorListUseCase } from './application/use-cases/import-vendor-list.use-case';
import { IssueAddendumUseCase } from './application/use-cases/issue-addendum.use-case';
import { LinkVendorOnPhoneSignInUseCase } from './application/use-cases/link-vendor-on-phone-sign-in.use-case';
import { ListInvitationsUseCase } from './application/use-cases/list-invitations.use-case';
import { ListMyVendorsUseCase } from './application/use-cases/list-my-vendors.use-case';
import { ListPackagesUseCase } from './application/use-cases/list-packages.use-case';
import { ListQuestionsUseCase } from './application/use-cases/list-questions.use-case';
import { ListVendorListUseCase } from './application/use-cases/list-vendor-list.use-case';
import { PutVendorProfileUseCase } from './application/use-cases/put-vendor-profile.use-case';
import { RemovePackageFileUseCase } from './application/use-cases/remove-package-file.use-case';
import { ResendInvitationUseCase } from './application/use-cases/resend-invitation.use-case';
import { RunSourcingSweepUseCase } from './application/use-cases/run-sourcing-sweep.use-case';
import { UpdatePackageUseCase } from './application/use-cases/update-package.use-case';
import { UpdateVendorListEntryUseCase } from './application/use-cases/update-vendor-list-entry.use-case';
import { ViewInvitationUseCase } from './application/use-cases/view-invitation.use-case';
import { WithdrawInvitationUseCase } from './application/use-cases/withdraw-invitation.use-case';
import {
    DrizzleInvitationRepository, DrizzleQuestionRepository, DrizzleVendorListRepository, DrizzleVendorProfileRepository,
    DrizzleWorkPackageRepository,
} from './infrastructure/adapters/drizzle-sourcing.repositories';
import {
    InMemoryInvitationRepository, InMemoryQuestionRepository, InMemoryVendorListRepository, InMemoryVendorProfileRepository,
    InMemoryWorkPackageRepository,
} from './infrastructure/adapters/in-memory-sourcing.repositories';
import { SourcingPackageDirectory } from './infrastructure/adapters/package-directory.adapter';
import { InMemorySmsRateLimiter } from './infrastructure/adapters/in-memory-sms-rate-limiter.adapter';
import { SourcingPhoneSignInHook } from './infrastructure/adapters/phone-sign-in-hook.adapter';
import { SourcingSweepRunner } from './infrastructure/adapters/sourcing-sweep.runner';
import { SourcingScVendorDirectory } from './infrastructure/adapters/sc-vendor-directory.adapter';
import { SourcingVendorDirectory } from './infrastructure/adapters/vendor-directory.adapter';
import { GuestController } from './presentation/guest.controller';
import { PackagesController } from './presentation/packages.controller';
import { ScInvitationsController } from './presentation/sc-invitations.controller';
import { VendorListController } from './presentation/vendor-list.controller';
import { VendorController } from './presentation/vendor.controller';

export const SOURCING_CONTROLLERS: Type[] = [
    VendorListController, PackagesController, ScInvitationsController, GuestController, VendorController,
];

/** Use cases of the stream (also what the specs' test kit wires). */
export const SOURCING_USE_CASES: Type[] = [
    ListVendorListUseCase, CreateVendorListEntryUseCase, ImportVendorListUseCase, UpdateVendorListEntryUseCase,
    DeleteVendorListEntryUseCase, GetVendorCardUseCase,
    ListPackagesUseCase, CreatePackageUseCase, GetPackageUseCase, UpdatePackageUseCase, DeletePackageUseCase,
    AttachPackageFileUseCase, RemovePackageFileUseCase, IssueAddendumUseCase, ExtendDeadlineUseCase, CancelPackageUseCase,
    ListInvitationsUseCase, CreateInvitationsUseCase, ResendInvitationUseCase, WithdrawInvitationUseCase,
    ListQuestionsUseCase, AnswerQuestionUseCase, AskQuestionUseCase, DeclineInvitationUseCase, ViewInvitationUseCase,
    ClaimInvitationUseCase, ListMyVendorsUseCase, GetVendorProfileUseCase, PutVendorProfileUseCase, AddPortfolioItemUseCase,
    DeletePortfolioItemUseCase, LinkVendorOnPhoneSignInUseCase, RunSourcingSweepUseCase,
];

/** Application services shared by the use cases. */
export const SOURCING_SERVICES: Type[] = [
    SourcingAccess, SourcingViews, SourcingNotices, PackageSnapshots, VendorLinker, VendorProfileViews, PackageLineGuard,
];

export const SOURCING_PROVIDERS: Provider[] = [
    persistence(VendorProfileRepository, () => new InMemoryVendorProfileRepository(), ctx => new DrizzleVendorProfileRepository(ctx)),
    persistence(VendorListRepository, () => new InMemoryVendorListRepository(), ctx => new DrizzleVendorListRepository(ctx)),
    persistence(WorkPackageRepository, () => new InMemoryWorkPackageRepository(), ctx => new DrizzleWorkPackageRepository(ctx)),
    persistence(InvitationRepository, () => new InMemoryInvitationRepository(), ctx => new DrizzleInvitationRepository(ctx)),
    persistence(QuestionRepository, () => new InMemoryQuestionRepository(), ctx => new DrizzleQuestionRepository(ctx)),
    // In process memory: one server instance (a shared store is needed before running several).
    { provide: SmsRateLimiter, inject: [Clock], useFactory: (clock: Clock): SmsRateLimiter => new InMemorySmsRateLimiter(clock) },
    ...SOURCING_SERVICES,
    ...SOURCING_USE_CASES,
    { provide: PackageDirectory, useClass: SourcingPackageDirectory },
    { provide: VendorDirectory, useClass: SourcingVendorDirectory },
    { provide: PhoneSignInHook, useClass: SourcingPhoneSignInHook },
    { provide: ScVendorDirectory, useClass: SourcingScVendorDirectory },
    SourcingSweepRunner,
];

/** Ports from ../shared/ports.ts (or shared/application/ports.ts) this stream provides to the others. */
export const SOURCING_EXPORTS: (abstract new (...args: never[]) => unknown)[] = [
    PackageDirectory, VendorDirectory, PhoneSignInHook, ScVendorDirectory,
];
