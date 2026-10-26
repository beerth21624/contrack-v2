import { eq, inArray } from 'drizzle-orm';
import { FILE_PURPOSES, type FilePurpose } from '@contrack/contract';
import { asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { files } from '../../../../shared/infrastructure/database/schema-platform';
import { FileRepository } from '../../application/ports/file.repository';
import { StoredFile } from '../../domain/entities/stored-file.entity';
import { type FileId, asFileId } from '../../domain/platform-ids';

type Row = typeof files.$inferSelect;

const PURPOSES = new Set<string>(FILE_PURPOSES);

const toEntity = (row: Row): StoredFile => StoredFile.rehydrate({
    id: asFileId(row.id),
    uploadedBy: asUserId(row.uploadedBy),
    workspaceId: row.workspaceId === null ? null : asWorkspaceId(row.workspaceId),
    // A purpose this code no longer lists still reads as a plain attachment.
    purpose: PURPOSES.has(row.purpose) ? row.purpose as FilePurpose : 'package_attachment',
    name: row.name,
    contentType: row.contentType,
    size: row.size,
    storageKey: row.storageKey,
    createdAt: row.createdAt,
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. Lookups are by file id (callers check access). */
export class DrizzleFileRepository extends FileRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findById(id: FileId): Promise<StoredFile | undefined> {
        const [row] = await this.ctx.executor.select().from(files).where(eq(files.id, id)).limit(1);
        return row === undefined ? undefined : toEntity(row);
    }

    async findMany(ids: readonly FileId[]): Promise<StoredFile[]> {
        if (ids.length === 0) return [];
        const rows = await this.ctx.executor.select().from(files).where(inArray(files.id, [...new Set(ids)]));
        return rows.map(toEntity);
    }

    async insert(file: StoredFile): Promise<void> {
        const p = file.toProps();
        await this.ctx.executor.insert(files).values({
            id: p.id,
            uploadedBy: p.uploadedBy,
            workspaceId: p.workspaceId,
            purpose: p.purpose,
            name: p.name,
            contentType: p.contentType,
            size: p.size,
            storageKey: p.storageKey,
            createdAt: p.createdAt,
        });
    }
}
