// ─── FileDto of a stored file, with a fresh signed link ───
import { Injectable } from '@nestjs/common';
import type { FileDto } from '@contrack/contract';
import { Clock } from '../../../../shared/application/ports';
import type { StoredFile } from '../../domain/entities/stored-file.entity';
import { FileLinkSigner } from '../ports/file-link-signer.port';

/**
 * Path of the content link as the browser sees it: the web app reaches the API through `/api/*` (Next rewrite),
 * so the link is relative and starts with /api.
 */
export function fileContentPath(fileId: string, exp: number, sig: string): string {
    return `/api/files/${fileId}/content?exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

@Injectable()
export class FileLinks {
    constructor(private readonly signer: FileLinkSigner, private readonly clock: Clock) {}

    toDto(file: StoredFile): FileDto {
        const link = this.signer.sign(file.id, this.clock.now());
        return {
            id: file.id,
            name: file.name,
            contentType: file.contentType,
            size: file.size,
            url: fileContentPath(file.id, link.exp, link.sig),
            createdAt: file.createdAt.toISOString(),
        };
    }
}
