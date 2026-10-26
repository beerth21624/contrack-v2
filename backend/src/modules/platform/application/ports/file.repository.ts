import type { StoredFile } from '../../domain/entities/stored-file.entity';
import type { FileId } from '../../domain/platform-ids';

/** File metadata. Files are not tenant rows (an upload may precede the workspace it ends up in); callers check access. */
export abstract class FileRepository {
    abstract findById(id: FileId): Promise<StoredFile | undefined>;
    /** The files that exist among `ids` (any order). */
    abstract findMany(ids: readonly FileId[]): Promise<StoredFile[]>;
    abstract insert(file: StoredFile): Promise<void>;
}
