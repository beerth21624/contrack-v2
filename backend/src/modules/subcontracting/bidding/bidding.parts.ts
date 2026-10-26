// ─── What the bidding work stream adds to SubcontractingModule (controllers + providers) ───
// Owned by the bidding work stream: list every controller and provider of this stream here. Providers of the ports this
// stream implements (see ../shared/ports.ts) must be registered here too, and listed in the exports.
import type { Provider, Type } from '@nestjs/common';
import { persistence } from '../../../shared/infrastructure/core.module';
import { BidDirectory } from '../shared/ports';
import { BiddingAccess } from './application/bidding-access';
import { BidPresenter } from './application/bid-presenter';
import { BidSubmission } from './application/bid-submission';
import { AwardRepository } from './application/ports/award.repository';
import { BidRepository } from './application/ports/bid.repository';
import { MessageRepository } from './application/ports/message.repository';
import { AwardPackageUseCase } from './application/use-cases/award-package.use-case';
import { EnterManualBidUseCase } from './application/use-cases/enter-manual-bid.use-case';
import { GetLevelingUseCase } from './application/use-cases/get-leveling.use-case';
import { GetMyBidStateUseCase } from './application/use-cases/get-my-bid-state.use-case';
import { GetVendorInboxUseCase } from './application/use-cases/get-vendor-inbox.use-case';
import { ListPackageBidsUseCase } from './application/use-cases/list-package-bids.use-case';
import { ListMessagesUseCase, SendMessageUseCase } from './application/use-cases/messages.use-case';
import { SaveBidDraftUseCase } from './application/use-cases/save-bid-draft.use-case';
import { SubmitBidUseCase } from './application/use-cases/submit-bid.use-case';
import { WithdrawBidUseCase } from './application/use-cases/withdraw-bid.use-case';
import { RepositoryBidDirectory } from './infrastructure/adapters/bid-directory.adapter';
import { DrizzleAwardRepository } from './infrastructure/adapters/drizzle-award.repository';
import { DrizzleBidRepository } from './infrastructure/adapters/drizzle-bid.repository';
import { DrizzleMessageRepository } from './infrastructure/adapters/drizzle-message.repository';
import { InMemoryAwardRepository } from './infrastructure/adapters/in-memory-award.repository';
import { InMemoryBidRepository } from './infrastructure/adapters/in-memory-bid.repository';
import { InMemoryMessageRepository } from './infrastructure/adapters/in-memory-message.repository';
import { BuyerBiddingController } from './presentation/buyer-bidding.controller';
import { VendorBiddingController } from './presentation/vendor-bidding.controller';

export const BIDDING_CONTROLLERS: Type[] = [VendorBiddingController, BuyerBiddingController];
export const BIDDING_PROVIDERS: Provider[] = [
    persistence(BidRepository, () => new InMemoryBidRepository(), ctx => new DrizzleBidRepository(ctx)),
    persistence(MessageRepository, () => new InMemoryMessageRepository(), ctx => new DrizzleMessageRepository(ctx)),
    persistence(AwardRepository, () => new InMemoryAwardRepository(), ctx => new DrizzleAwardRepository(ctx)),
    { provide: BidDirectory, useClass: RepositoryBidDirectory },
    BiddingAccess,
    BidPresenter,
    BidSubmission,
    GetVendorInboxUseCase,
    GetMyBidStateUseCase,
    SaveBidDraftUseCase,
    SubmitBidUseCase,
    WithdrawBidUseCase,
    ListPackageBidsUseCase,
    GetLevelingUseCase,
    EnterManualBidUseCase,
    ListMessagesUseCase,
    SendMessageUseCase,
    AwardPackageUseCase,
];
/** Ports from ../shared/ports.ts (or shared/application/ports.ts) this stream provides to the others. */
export const BIDDING_EXPORTS: (abstract new (...args: never[]) => unknown)[] = [BidDirectory];
