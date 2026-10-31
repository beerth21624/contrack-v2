// ─── Customer links (ERP foundation, docs/erp/02-domain-model.md §1.8) ───
// A public, no-sign-in page for one document. The owner module of each subject registers a CustomerLinkHandlers entry
// (core). Team routes are gated by `project-hub`; the public routes check it in the use case (same 404 as a wrong token).
// Needs ModuleAccess / ModuleFlags / AppLinks (platform), CompanyProfiles (company), AuditLog (audit).
import { Global, Module } from '@nestjs/common';
import { Clock } from '../../shared/application/ports';
import { persistence } from '../../shared/infrastructure/core.module';
import { CustomerLinkRepository, LinkRateLimiter } from './application/ports/customer-link.repository';
import { CreateCustomerLinkUseCase, ListCustomerLinksUseCase, RevokeCustomerLinkUseCase } from './application/use-cases/customer-links.use-cases';
import { PublicLinkResolver, RespondPublicLinkUseCase, ViewPublicLinkUseCase } from './application/use-cases/public-links.use-cases';
import { DrizzleCustomerLinkRepository } from './infrastructure/adapters/drizzle-customer-link.repository';
import { InMemoryCustomerLinkRepository } from './infrastructure/adapters/in-memory-customer-link.repository';
import { InMemoryLinkRateLimiter } from './infrastructure/adapters/in-memory-link-rate-limiter.adapter';
import { CustomerLinksController } from './presentation/customer-links.controller';
import { PublicLinksController } from './presentation/public-links.controller';

@Global()
@Module({
    controllers: [CustomerLinksController, PublicLinksController],
    providers: [
        persistence(CustomerLinkRepository, () => new InMemoryCustomerLinkRepository(), ctx => new DrizzleCustomerLinkRepository(ctx)),
        { provide: LinkRateLimiter, inject: [Clock], useFactory: (clock: Clock): LinkRateLimiter => new InMemoryLinkRateLimiter(clock) },
        CreateCustomerLinkUseCase,
        ListCustomerLinksUseCase,
        RevokeCustomerLinkUseCase,
        PublicLinkResolver,
        ViewPublicLinkUseCase,
        RespondPublicLinkUseCase,
    ],
})
export class CustomerLinksModule {}
