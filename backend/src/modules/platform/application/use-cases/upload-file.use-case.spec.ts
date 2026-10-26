import { FILE_PURPOSES, MAX_FILE_BYTES } from '@contrack/contract';
import { asFileId } from '../../domain/platform-ids';
import { PlatformTestKit, errorOf, valueOf } from '../../testing/platform-test-kit';
import { UploadFileUseCase } from './upload-file.use-case';

describe('UploadFileUseCase', () => {
    let kit: PlatformTestKit;
    let useCase: UploadFileUseCase;

    beforeEach(() => {
        kit = new PlatformTestKit();
        useCase = new UploadFileUseCase(kit.files, kit.storage, kit.links, kit.settings, kit.clock, kit.ids);
    });

    const bytes = new Uint8Array([1, 2, 3, 4]);

    it('stores the bytes and the metadata and answers a FileDto with a signed relative /api link', async () => {
        const me = kit.newUserId();
        const dto = valueOf(await useCase.execute({ actorId: me, purpose: 'bid_photo', name: 'หน้างาน.jpg', contentType: 'image/jpeg', bytes }));
        expect(dto).toMatchObject({ name: 'หน้างาน.jpg', contentType: 'image/jpeg', size: 4, createdAt: '2026-01-01T00:00:00.000Z' });
        expect(dto.url).toMatch(new RegExp(`^/api/files/${dto.id}/content\\?exp=\\d+&sig=[A-Za-z0-9_-]+$`));
        const stored = await kit.files.findById(asFileId(dto.id));
        expect(stored?.toProps()).toMatchObject({ uploadedBy: me, purpose: 'bid_photo', storageKey: `2026/01/${dto.id}`, workspaceId: null });
        expect(await kit.storage.get(`2026/01/${dto.id}`)).toEqual(bytes);
    });

    it('keeps only the base name of a path the browser sent', async () => {
        const dto = valueOf(await useCase.execute({
            actorId: kit.newUserId(), purpose: 'package_attachment', name: 'C:\\plans\\แบบ A.pdf', contentType: 'application/pdf', bytes,
        }));
        expect(dto.name).toBe('แบบ A.pdf');
    });

    it('accepts a content type in any case', async () => {
        const dto = valueOf(await useCase.execute({ actorId: kit.newUserId(), purpose: 'claim_photo', name: 'a.png', contentType: 'IMAGE/PNG', bytes }));
        expect(dto.contentType).toBe('image/png');
    });

    it('refuses a type outside ALLOWED_CONTENT_TYPES (422) and stores nothing', async () => {
        const r = await useCase.execute({ actorId: kit.newUserId(), purpose: 'bid_photo', name: 'x.svg', contentType: 'image/svg+xml', bytes });
        expect(errorOf(r)).toMatchObject({ code: 'unprocessable', details: { contentType: 'image/svg+xml' } });
        expect(await kit.files.findMany([asFileId('00000000-0000-4000-8000-000000000001')])).toEqual([]);
    });

    it('refuses a file larger than MAX_FILE_BYTES (422)', async () => {
        const big = new Uint8Array(MAX_FILE_BYTES + 1);
        const r = await useCase.execute({ actorId: kit.newUserId(), purpose: 'bid_photo', name: 'big.jpg', contentType: 'image/jpeg', bytes: big });
        expect(errorOf(r)).toMatchObject({ code: 'unprocessable', details: { maxBytes: MAX_FILE_BYTES } });
    });

    it.each(FILE_PURPOSES)('refuses a %s upload with module_disabled when the platform offers no module for it, storing nothing', async purpose => {
        const plain = new PlatformTestKit([]);
        const off = new UploadFileUseCase(plain.files, plain.storage, plain.links, plain.settings, plain.clock, plain.ids);
        const r = await off.execute({ actorId: plain.newUserId(), purpose, name: 'a.jpg', contentType: 'image/jpeg', bytes });
        expect(errorOf(r).code).toBe('module_disabled');
        expect(await plain.files.findMany([asFileId('00000000-0000-4000-8000-000000000001')])).toEqual([]);
    });

    it('refuses an empty file (422)', async () => {
        const r = await useCase.execute({ actorId: kit.newUserId(), purpose: 'bid_photo', name: 'a.jpg', contentType: 'image/jpeg', bytes: new Uint8Array() });
        expect(errorOf(r).code).toBe('unprocessable');
    });
});
