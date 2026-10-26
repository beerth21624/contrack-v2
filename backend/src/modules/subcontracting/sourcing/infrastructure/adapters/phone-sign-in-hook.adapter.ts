// ─── PhoneSignInHook (shared port) called by identity inside the phone sign-in transaction ───
import { Injectable } from '@nestjs/common';
import { type PhoneSignInEvent, PhoneSignInHook } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import { LinkVendorOnPhoneSignInUseCase } from '../../application/use-cases/link-vendor-on-phone-sign-in.use-case';

@Injectable()
export class SourcingPhoneSignInHook extends PhoneSignInHook {
    constructor(private readonly link: LinkVendorOnPhoneSignInUseCase) {
        super();
    }

    afterSignIn(event: PhoneSignInEvent): Promise<{ vendorWorkspaceId: WorkspaceId | null }> {
        return this.link.execute(event);
    }
}
