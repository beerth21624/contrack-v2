// ─── DecisionPort when no model is configured (no JEV_API_KEY): the API boots, the routes answer 503 ai_unavailable ───
import { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err } from '../../../../shared/domain/result';
import { type DecisionOutcome, DecisionPort, type DecisionQuestion } from '../../application/ports/decision.port';

export class UnavailableDecisionAdapter extends DecisionPort {
    decide(_state: unknown, _questions: Record<string, DecisionQuestion>): Promise<Result<DecisionOutcome, DomainError>> {
        return Promise.resolve(err(new DomainError('ai_unavailable', 'AI assist is not configured on this server (JEV_API_KEY)')));
    }
}
