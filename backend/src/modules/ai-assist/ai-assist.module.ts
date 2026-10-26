// ─── AI assist (module `ai-assist`): typed decisions from a decision model, see ../../../../src/shared/contract/ai-assist.ts ───
// Always registered; every route is gated by the module flag (AiAccess → 404 module_disabled). The model never
// computes BOQ numbers: it flags rows for review and matches free text to catalogue items; the user confirms.
import { Module } from '@nestjs/common';
import { AppConfig } from '../../shared/infrastructure/config/env';
import { DecisionPort } from './application/ports/decision.port';
import { MatchItemsUseCase } from './application/use-cases/match-items.use-case';
import { ReviewBoqUseCase } from './application/use-cases/review-boq.use-case';
import { JevDecisionAdapter } from './infrastructure/adapters/jev-decision.adapter';
import { UnavailableDecisionAdapter } from './infrastructure/adapters/unavailable-decision.adapter';
import { AiAssistController } from './presentation/ai-assist.controller';
import { AiAccess } from './shared/ai-access';
import { FakeDecisionAdapter } from './testing/fake-decision.adapter';

/**
 * NODE_ENV=test → scripted fake (specs and the e2e app script it through `app.get(DecisionPort)`);
 * JEV_API_KEY set → Jev over HTTP; otherwise the API still boots and the routes answer 503 ai_unavailable.
 */
export function decisionPort(config: AppConfig): DecisionPort {
    const env = config.env;
    if (env.NODE_ENV === 'test') return new FakeDecisionAdapter();
    if (env.JEV_API_KEY !== undefined && env.JEV_API_KEY !== '') {
        return new JevDecisionAdapter({ apiKey: env.JEV_API_KEY, model: env.JEV_MODEL, baseUrl: env.JEV_BASE_URL });
    }
    return new UnavailableDecisionAdapter();
}

@Module({
    controllers: [AiAssistController],
    providers: [
        AiAccess,
        { provide: DecisionPort, inject: [AppConfig], useFactory: decisionPort },
        ReviewBoqUseCase,
        MatchItemsUseCase,
    ],
    exports: [DecisionPort],
})
export class AiAssistModule {}
