/** Where the bytes of files live (local disk, memory; S3-compatible later). Keys come from StoredFile.storageKey. */
export abstract class FileStorage {
    abstract put(key: string, bytes: Uint8Array): Promise<void>;
    /** undefined when nothing is stored under `key`. */
    abstract get(key: string): Promise<Uint8Array | undefined>;
}
