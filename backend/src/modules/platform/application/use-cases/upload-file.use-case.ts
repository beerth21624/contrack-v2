import { Injectable } from '@nestjs/common';
import type { FileDto, FilePurpose } from '@contrack/contract';
import { Clock, IdGenerator } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { FILE_PURPOSE_MODULE } from '../../domain/file-purposes';
import { StoredFile } from '../../domain/entities/stored-file.entity';
import { asFileId } from '../../domain/platform-ids';
import { FileRepository } from '../ports/file.repository';
import { FileStorage } from '../ports/file-storage.port';
import { PlatformSettings } from '../ports/platform-settings.port';
import { FileLinks } from '../services/file-links';

export interface UploadFileInput {
    actorId: UserId;
    purpose: FilePurpose;
    name: string;
    contentType: string;
    bytes: Uint8Array;
    workspaceId?: WorkspaceId | null;
}

/**
 * Stores an upload (or a server-generated file). The platform must offer the module the purpose belongs to (else 404
 * module_disabled: plain BOQ takes no uploads); type in ALLOWED_CONTENT_TYPES and ≤ MAX_FILE_BYTES, else 422.
 */
@Injectable()
export class UploadFileUseCase {
    constructor(
        private readonly files: FileRepository,
        private readonly storage: FileStorage,
        private readonly links: FileLinks,
        private readonly settings: PlatformSettings,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: UploadFileInput): Promise<Result<FileDto, DomainError>> {
        const module = FILE_PURPOSE_MODULE[input.purpose];
        if (!this.settings.modulesEnabled.includes(module)) {
            return err(new DomainError('module_disabled', `Uploads for ${input.purpose} need the ${module} module`));
        }
        const created = StoredFile.create({
            id: asFileId(this.ids.newId()),
            uploadedBy: input.actorId,
            workspaceId: input.workspaceId ?? null,
            purpose: input.purpose,
            name: input.name,
            contentType: input.contentType,
            size: input.bytes.byteLength,
            now: this.clock.now(),
        });
        if (!created.ok) return err(created.error);
        const file = created.value;
        // Bytes first: a metadata row never points at missing bytes (an orphaned blob is harmless).
        await this.storage.put(file.storageKey, input.bytes);
        await this.files.insert(file);
        return ok(this.links.toDto(file));
    }
}
