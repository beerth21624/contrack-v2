// ─── Subcontracting (module 1, "จ้างช่วง"): docs/marketplace/01-module1-subcontracting-plan.md ───
// Always registered; every route is gated by the `subcontracting` module flag (ScAccess → 404 module_disabled), so
// switching the module off for the platform (env MODULES_ENABLED) or a workspace hides it without losing data.
// Three work streams contribute their controllers / providers through *.parts.ts; shared/ holds what they share.
import { Global, Module } from '@nestjs/common';
import { persistence } from '../../shared/infrastructure/core.module';
import { BIDDING_CONTROLLERS, BIDDING_EXPORTS, BIDDING_PROVIDERS } from './bidding/bidding.parts';
import { CONTRACTS_CONTROLLERS, CONTRACTS_EXPORTS, CONTRACTS_PROVIDERS } from './contracts/contracts.parts';
import { DrizzleScActivityLog, InMemoryScActivityLog } from './shared/activity-log.adapters';
import { ScActivityLog } from './shared/ports';
import { ScAccess } from './shared/sc-access';
import { SOURCING_CONTROLLERS, SOURCING_EXPORTS, SOURCING_PROVIDERS } from './sourcing/sourcing.parts';

@Global()
@Module({
    controllers: [...SOURCING_CONTROLLERS, ...BIDDING_CONTROLLERS, ...CONTRACTS_CONTROLLERS],
    providers: [
        ScAccess,
        persistence(ScActivityLog, () => new InMemoryScActivityLog(), ctx => new DrizzleScActivityLog(ctx)),
        ...SOURCING_PROVIDERS,
        ...BIDDING_PROVIDERS,
        ...CONTRACTS_PROVIDERS,
    ],
    exports: [ScAccess, ScActivityLog, ...SOURCING_EXPORTS, ...BIDDING_EXPORTS, ...CONTRACTS_EXPORTS],
})
export class SubcontractingModule {}
