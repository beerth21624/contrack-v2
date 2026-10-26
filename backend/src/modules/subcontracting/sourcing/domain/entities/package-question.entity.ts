// ─── Question of an invitee about a package; the answer is shown to every invitee without the asker's name ───
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId, QuestionId, ScInvitationId } from '../../../shared/ids';

export interface PackageQuestionProps {
    id: QuestionId;
    packageId: PackageId;
    buyerWorkspaceId: WorkspaceId;
    invitationId: ScInvitationId;
    question: string;
    answer: string | null;
    answeredBy: UserId | null;
    askedAt: Date;
    answeredAt: Date | null;
}

export class PackageQuestion {
    private constructor(private p: PackageQuestionProps) {}

    static create(input: { id: QuestionId; packageId: PackageId; buyerWorkspaceId: WorkspaceId; invitationId: ScInvitationId; question: string; now: Date }): PackageQuestion {
        return new PackageQuestion({
            id: input.id, packageId: input.packageId, buyerWorkspaceId: input.buyerWorkspaceId, invitationId: input.invitationId,
            question: input.question.trim(), answer: null, answeredBy: null, askedAt: input.now, answeredAt: null,
        });
    }

    static rehydrate(props: PackageQuestionProps): PackageQuestion {
        return new PackageQuestion({ ...props });
    }

    get props(): Readonly<PackageQuestionProps> {
        return this.p;
    }

    get id(): QuestionId {
        return this.p.id;
    }

    get packageId(): PackageId {
        return this.p.packageId;
    }

    /** Answering again replaces the answer. */
    answerWith(answer: string, by: UserId, now: Date): void {
        this.p = { ...this.p, answer: answer.trim(), answeredBy: by, answeredAt: now };
    }

    toProps(): PackageQuestionProps {
        return structuredClone(this.p);
    }
}
