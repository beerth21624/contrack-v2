// ─── StoredFile: metadata of an uploaded / generated file (the bytes live in the file storage) ───
import { ALLOWED_CONTENT_TYPES, type FilePurpose, MAX_FILE_BYTES } from '@contrack/contract';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import type { FileId } from '../platform-ids';

export interface StoredFileProps {
    id: FileId;
    uploadedBy: UserId;
    workspaceId: WorkspaceId | null;
    purpose: FilePurpose;
    name: string;
    contentType: string;
    size: number;
    storageKey: string;
    createdAt: Date;
}

export interface NewFileInput {
    id: FileId;
    uploadedBy: UserId;
    workspaceId?: WorkspaceId | null;
    purpose: FilePurpose;
    name: string;
    contentType: string;
    size: number;
    now: Date;
}

const MAX_NAME_LENGTH = 200;

/** Base name only (no folders a browser may send), no control characters, at most 200 characters. */
export function cleanFileName(raw: string): string {
    const base = raw.split(/[\\/]/).pop() ?? '';
    // eslint-disable-next-line no-control-regex
    const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (cleaned === '') return 'file';
    return cleaned.length > MAX_NAME_LENGTH ? cleaned.slice(cleaned.length - MAX_NAME_LENGTH) : cleaned;
}

const ALLOWED = new Set<string>(ALLOWED_CONTENT_TYPES);

export class StoredFile {
    private constructor(private readonly props: StoredFileProps) {}

    /** Checks type and size; the storage key spreads files over month folders (`2026/01/<id>`). */
    static create(input: NewFileInput): Result<StoredFile, DomainError> {
        const contentType = input.contentType.toLowerCase();
        if (!ALLOWED.has(contentType)) {
            return err(DomainError.unprocessable('This file type is not allowed', { contentType, allowed: ALLOWED_CONTENT_TYPES }));
        }
        if (input.size <= 0) return err(DomainError.unprocessable('The file is empty'));
        if (input.size > MAX_FILE_BYTES) return err(DomainError.unprocessable('The file is too large', { maxBytes: MAX_FILE_BYTES }));
        const year = input.now.getUTCFullYear().toString();
        const month = (input.now.getUTCMonth() + 1).toString().padStart(2, '0');
        return ok(new StoredFile({
            id: input.id,
            uploadedBy: input.uploadedBy,
            workspaceId: input.workspaceId ?? null,
            purpose: input.purpose,
            name: cleanFileName(input.name),
            contentType,
            size: input.size,
            storageKey: `${year}/${month}/${input.id}`,
            createdAt: new Date(input.now.getTime()),
        }));
    }

    static rehydrate(props: StoredFileProps): StoredFile {
        return new StoredFile({ ...props });
    }

    get id(): FileId {
        return this.props.id;
    }

    get uploadedBy(): UserId {
        return this.props.uploadedBy;
    }

    get name(): string {
        return this.props.name;
    }

    get contentType(): string {
        return this.props.contentType;
    }

    get size(): number {
        return this.props.size;
    }

    get storageKey(): string {
        return this.props.storageKey;
    }

    get createdAt(): Date {
        return new Date(this.props.createdAt.getTime());
    }

    toProps(): StoredFileProps {
        return { ...this.props, createdAt: this.createdAt };
    }
}
