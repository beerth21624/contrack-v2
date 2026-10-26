// ─── Shared port FileService: DTOs with fresh signed links, ownership checks, server-generated files ───
import { Injectable } from '@nestjs/common';
import type { FileDto, FilePurpose } from '@contrack/contract';
import { FileService } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import { type UserId, isUuid } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import { FileRepository } from '../../application/ports/file.repository';
import { FileLinks } from '../../application/services/file-links';
import { UploadFileUseCase } from '../../application/use-cases/upload-file.use-case';
import { type FileId, asFileId } from '../../domain/platform-ids';

const toFileIds = (ids: readonly string[]): FileId[] => ids.filter(isUuid).map(id => asFileId(id.toLowerCase()));

@Injectable()
export class RepositoryFileService extends FileService {
    constructor(
        private readonly files: FileRepository,
        private readonly links: FileLinks,
        private readonly upload: UploadFileUseCase,
    ) {
        super();
    }

    async describe(ids: readonly string[]): Promise<FileDto[]> {
        const found = new Map((await this.files.findMany(toFileIds(ids))).map(f => [f.id as string, f]));
        const out: FileDto[] = [];
        for (const id of ids) {
            const file = found.get(id.toLowerCase());
            if (file !== undefined) out.push(this.links.toDto(file));
        }
        return out;
    }

    async assertUploadedBy(ids: readonly string[], userId: UserId): Promise<Result<undefined, DomainError>> {
        if (ids.length === 0) return okVoid();
        const found = new Map((await this.files.findMany(toFileIds(ids))).map(f => [f.id as string, f]));
        const bad = ids.find(id => found.get(id.toLowerCase())?.uploadedBy !== userId);
        return bad === undefined ? okVoid() : err(DomainError.unprocessable('unknown file', { fileId: bad }));
    }

    async store(input: { name: string; contentType: string; bytes: Uint8Array; uploadedBy: UserId; purpose: FilePurpose }): Promise<FileDto> {
        const stored = await this.upload.execute({
            actorId: input.uploadedBy, purpose: input.purpose, name: input.name, contentType: input.contentType, bytes: input.bytes,
        });
        // A server-generated file of a type / size we refuse is a bug in the caller.
        if (!stored.ok) throw new Error(`FileService.store: ${stored.error.message}`);
        return stored.value;
    }
}
