// ─── Expected failures of the sourcing work stream (codes from the contract) ───
import { DomainError } from '../../../../shared/domain/domain-error';

export const SourcingErrors = {
    packageNotFound: (): DomainError => DomainError.notFound('Package'),
    invitationNotFound: (): DomainError => DomainError.notFound('Invitation'),
    entryNotFound: (): DomainError => DomainError.notFound('Vendor-list entry'),
    questionNotFound: (): DomainError => DomainError.notFound('Question'),
    profileNotFound: (): DomainError => DomainError.notFound('Vendor profile'),
    portfolioNotFound: (): DomainError => DomainError.notFound('Portfolio item'),
    vendorNotFound: (): DomainError => DomainError.notFound('Vendor'),
    projectNotFound: (): DomainError => DomainError.notFound('Project'),
    /** Expired, withdrawn or unknown invitation link. */
    invitationInvalid: (): DomainError => new DomainError('invitation_invalid', 'This invitation link is no longer valid'),
    openSourcingUnsupported: (): DomainError => DomainError.unprocessable('Open sourcing (public board) is not available yet'),
    unknownLines: (unknownKeys: string[]): DomainError => DomainError.unprocessable('Some BOQ lines do not exist', { unknownKeys }),
    noLines: (): DomainError => DomainError.unprocessable('Choose at least one line'),
    projectArchived: (): DomainError => DomainError.unprocessable('The project is archived'),
    notDraft: (): DomainError => DomainError.conflict('Only a draft package can be changed this way'),
    notSent: (): DomainError => DomainError.conflict('The package has not been sent'),
    finished: (): DomainError => DomainError.conflict('The package is already awarded, closed or cancelled'),
    onlyDescriptionAndDeadline: (fields: string[]): DomainError =>
        DomainError.unprocessable('After sending, only the description and a later bid deadline can change', { fields }),
    deadlineNotLater: (): DomainError => DomainError.unprocessable('The new bid deadline must be later than now and than the current one'),
    deadlinePassed: (): DomainError => DomainError.unprocessable('The bid deadline has passed'),
    tooManyInvitees: (max: number): DomainError => DomainError.unprocessable(`At most ${max} invitees for this sourcing mode`, { max }),
    alreadyInvited: (vendorListEntryId: string): DomainError => DomainError.conflict('This crew is already invited', { vendorListEntryId }),
    unknownEntry: (vendorListEntryId: string): DomainError => DomainError.unprocessable('Unknown vendor-list entry', { vendorListEntryId }),
    invitationClosed: (): DomainError => DomainError.conflict('The invitation cannot change any more'),
    duplicatePhone: (): DomainError => DomainError.conflict('This phone is already in the vendor list'),
    entryInUse: (): DomainError => DomainError.conflict('This crew has invitations: hide it instead'),
    linkedElsewhere: (): DomainError => DomainError.conflict('The invitation is linked to another crew'),
    /** The crew's verified phone is not the invited phone: the buyer has to invite this number. */
    phoneMismatch: (): DomainError =>
        DomainError.conflict('This invitation was sent to another phone number', { reason: 'phone_mismatch' }),
    /** An addendum after the bid deadline: extend the deadline first. */
    addendumAfterDeadline: (): DomainError =>
        DomainError.conflict('The bid deadline has passed: extend it before issuing an addendum', { reason: 'deadline_passed' }),
    /** BOQ lines already in another live package (draft / open / reviewing / awarded) of the project. */
    linesInOtherPackage: (lineKeys: string[]): DomainError =>
        DomainError.conflict('Some BOQ lines are already in another package', { lineKeys }),
    rateLimited: (): DomainError => new DomainError('rate_limited', 'Too many messages, please wait and try again later'),
    fileNotAttached: (): DomainError => DomainError.notFound('File'),
};
