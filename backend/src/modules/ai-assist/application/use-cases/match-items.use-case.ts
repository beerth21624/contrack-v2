// ─── Use case: which catalogue item does a free text the user typed mean? (one `choice` per input, one call) ───
// Criteria keys are the trimmed catalogue texts (the model sees them as options); the answer carries the ORIGINAL
// catalogue text so the client can select exactly the option it has. `none` → item null.
import { Injectable } from '@nestjs/common';
import type { ItemMatch, MatchItemsRequest, MatchItemsResponse } from '@contrack/contract';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../shared/domain';
import { AiAccess } from '../../shared/ai-access';
import { DecisionPort, type DecisionQuestion, MAX_CHOICE_OPTIONS, answerOf } from '../ports/decision.port';

/** The `choice` option meaning "nothing in the catalogue matches". */
export const NO_MATCH = 'none';
export const NO_MATCH_LABEL = 'ไม่มีรายการใดในแคตตาล็อกตรงกับข้อความนี้';

export interface MatchItemsInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    request: MatchItemsRequest;
}

export const itemQuestionName = (i: number): string => `item${i}`;

export interface CatalogueCriteria {
    /** Trimmed text → trimmed text (what the model picks from), plus `none`. */
    criteria: Record<string, string>;
    /** Trimmed text → the catalogue text as given (first occurrence wins when trimming collides). */
    originalOf: Map<string, string>;
}

/**
 * Criteria for a catalogue. Entries may carry stray spaces: keys are trimmed, duplicates (after trimming) and
 * blanks are dropped. `none` is reserved; with it the options never exceed the model's limit.
 */
export function catalogueCriteria(catalogue: readonly string[]): CatalogueCriteria {
    const originalOf = new Map<string, string>();
    const criteria: Record<string, string> = {};
    for (const text of catalogue) {
        const key = text.trim();
        if (key === '' || key === NO_MATCH || originalOf.has(key)) continue;
        if (originalOf.size >= MAX_CHOICE_OPTIONS - 1) break;
        originalOf.set(key, text);
        criteria[key] = key;
    }
    criteria[NO_MATCH] = NO_MATCH_LABEL;
    return { criteria, originalOf };
}

export function matchQuestions(inputs: readonly string[], criteria: Record<string, string>): Record<string, DecisionQuestion> {
    const questions: Record<string, DecisionQuestion> = {};
    inputs.forEach((_, i) => {
        questions[itemQuestionName(i)] = {
            type: 'choice',
            instructions: `ข้อความอิสระที่ผู้ใช้พิมพ์คือ state.inputs[${i}] : รายการใดในแคตตาล็อกที่หมายถึงสิ่งเดียวกัน (เลือก none ถ้าไม่มีรายการใดตรง)`,
            criteria,
        };
    });
    return questions;
}

@Injectable()
export class MatchItemsUseCase {
    constructor(private readonly access: AiAccess, private readonly decisions: DecisionPort) {}

    async execute(input: MatchItemsInput): Promise<Result<MatchItemsResponse, DomainError>> {
        const access = await this.access.member(input.actorId, input.workspaceId);
        if (!access.ok) return access;
        const { catalogue, inputs } = input.request;
        const { criteria, originalOf } = catalogueCriteria(catalogue);
        const outcome = await this.decisions.decide({ inputs }, matchQuestions(inputs, criteria));
        if (!outcome.ok) return outcome;
        const matches: ItemMatch[] = inputs.map((text, i) => {
            const answer = answerOf(outcome.value.answers, itemQuestionName(i), 'choice');
            if (answer === undefined) return { input: text, item: null, confidence: 0 };
            // `none`, or an option the model invented, both mean "no catalogue item".
            return { input: text, item: originalOf.get(answer.choice) ?? null, confidence: answer.confidence };
        });
        return ok({ model: outcome.value.model, matches });
    }
}
