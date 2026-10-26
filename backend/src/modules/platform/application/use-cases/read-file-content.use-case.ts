import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { isUuid } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { StoredFile } from '../../domain/entities/stored-file.entity';
import { asFileId } from '../../domain/platform-ids';
import { FileRepository } from '../ports/file.repository';
import { FileLinkSigner } from '../ports/file-link-signer.port';
import { FileStorage } from '../ports/file-storage.port';

export interface ReadFileContentInput {
    fileId: string;
    exp: string | undefined;
    sig: string | undefined;
}

export interface FileContent {
    file: StoredFile;
    bytes: Uint8Array;
    /** Seconds until the link stops working (for Cache-Control). */
    maxAgeSeconds: number;
}

/** The bytes behind a signed link. Bad / expired signature, unknown file or missing bytes all look the same: 404. */
@Injectable()
export class ReadFileContentUseCase {
    constructor(
        private readonly files: FileRepository,
        private readonly storage: FileStorage,
        private readonly signer: FileLinkSigner,
        private readonly clock: Clock,
    ) {}

    async execute(input: ReadFileContentInput): Promise<Result<FileContent, DomainError>> {
        const notFound = err(DomainError.notFound('File'));
        const now = this.clock.now();
        if (!isUuid(input.fileId) || input.sig === undefined || input.exp === undefined || !/^\d{1,12}$/.test(input.exp)) return notFound;
        const fileId = input.fileId.toLowerCase();
        const exp = Number(input.exp);
        if (!this.signer.verify(fileId, exp, input.sig, now)) return notFound;
        const file = await this.files.findById(asFileId(fileId));
        if (file === undefined) return notFound;
        const bytes = await this.storage.get(file.storageKey);
        if (bytes === undefined) return notFound;
        return ok({ file, bytes, maxAgeSeconds: Math.max(0, exp - Math.floor(now.getTime() / 1000)) });
    }
}
