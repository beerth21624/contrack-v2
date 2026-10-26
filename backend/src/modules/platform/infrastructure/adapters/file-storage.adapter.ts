// ─── File storage adapters: local disk (FILE_STORAGE=local) and in-process memory (tests, PERSISTENCE=memory) ───
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { FileStorage } from '../../application/ports/file-storage.port';

/** Keys are made by StoredFile (`2026/01/<uuid>`); anything else (`..`, absolute paths) is a bug. */
function assertSafeKey(key: string): void {
    if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(key)) throw new Error(`invalid storage key: ${key}`);
}

export class InMemoryFileStorage extends FileStorage {
    private readonly blobs = new Map<string, Uint8Array>();

    put(key: string, bytes: Uint8Array): Promise<void> {
        try {
            assertSafeKey(key);
        } catch (error: unknown) {
            return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
        this.blobs.set(key, new Uint8Array(bytes));
        return Promise.resolve();
    }

    get(key: string): Promise<Uint8Array | undefined> {
        const blob = this.blobs.get(key);
        return Promise.resolve(blob === undefined ? undefined : new Uint8Array(blob));
    }
}

/** Files under FILE_STORAGE_DIR (relative paths resolve from the working directory); folders are created as needed. */
export class LocalDiskFileStorage extends FileStorage {
    private readonly root: string;

    constructor(dir: string) {
        super();
        this.root = resolve(dir);
    }

    async put(key: string, bytes: Uint8Array): Promise<void> {
        const path = this.pathOf(key);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, bytes);
    }

    async get(key: string): Promise<Uint8Array | undefined> {
        try {
            return new Uint8Array(await readFile(this.pathOf(key)));
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
    }

    private pathOf(key: string): string {
        assertSafeKey(key);
        const path = resolve(this.root, ...key.split('/'));
        if (!path.startsWith(this.root + sep)) throw new Error(`storage key escapes the storage folder: ${key}`);
        return path;
    }
}
