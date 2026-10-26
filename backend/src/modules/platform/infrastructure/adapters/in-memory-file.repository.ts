import { FileRepository } from '../../application/ports/file.repository';
import { StoredFile, type StoredFileProps } from '../../domain/entities/stored-file.entity';
import type { FileId } from '../../domain/platform-ids';

/** Map-based; stores snapshots. */
export class InMemoryFileRepository extends FileRepository {
    private readonly rows = new Map<FileId, StoredFileProps>();

    findById(id: FileId): Promise<StoredFile | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : StoredFile.rehydrate(row));
    }

    findMany(ids: readonly FileId[]): Promise<StoredFile[]> {
        const out: StoredFile[] = [];
        for (const id of new Set(ids)) {
            const row = this.rows.get(id);
            if (row !== undefined) out.push(StoredFile.rehydrate(row));
        }
        return Promise.resolve(out);
    }

    insert(file: StoredFile): Promise<void> {
        if (this.rows.has(file.id)) return Promise.reject(new Error(`file ${file.id} already exists`));
        this.rows.set(file.id, file.toProps());
        return Promise.resolve();
    }
}
