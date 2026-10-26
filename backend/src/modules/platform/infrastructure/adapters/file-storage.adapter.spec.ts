import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemoryFileStorage, LocalDiskFileStorage } from './file-storage.adapter';

describe('file storage adapters', () => {
    describe('LocalDiskFileStorage', () => {
        let dir: string;

        beforeEach(async () => {
            dir = await mkdtemp(join(tmpdir(), 'contrack-files-'));
        });

        afterEach(async () => {
            await rm(dir, { recursive: true, force: true });
        });

        it('writes under the folder (creating sub-folders) and reads the bytes back', async () => {
            const storage = new LocalDiskFileStorage(join(dir, 'nested'));
            await storage.put('2026/01/abc', new Uint8Array([1, 2, 3]));
            expect((await stat(join(dir, 'nested', '2026', '01', 'abc'))).size).toBe(3);
            expect(await storage.get('2026/01/abc')).toEqual(new Uint8Array([1, 2, 3]));
        });

        it('answers undefined for a key with nothing stored', async () => {
            expect(await new LocalDiskFileStorage(dir).get('2026/01/missing')).toBeUndefined();
        });

        it.each(['../escape', '/abs', '2026/../../x', 'a\\b', ''])('refuses the unsafe key %p', async key => {
            const storage = new LocalDiskFileStorage(dir);
            await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow(/storage key/);
        });
    });

    describe('InMemoryFileStorage', () => {
        it('round-trips copies of the bytes', async () => {
            const storage = new InMemoryFileStorage();
            const bytes = new Uint8Array([5, 6]);
            await storage.put('2026/01/x', bytes);
            bytes[0] = 0;
            expect(await storage.get('2026/01/x')).toEqual(new Uint8Array([5, 6]));
            expect(await storage.get('2026/01/y')).toBeUndefined();
        });

        it('refuses unsafe keys too', async () => {
            await expect(new InMemoryFileStorage().put('../x', new Uint8Array([1]))).rejects.toThrow(/storage key/);
        });
    });
});
