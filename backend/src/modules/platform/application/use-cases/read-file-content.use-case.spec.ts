import type { FileDto } from '@contrack/contract';
import { InMemoryFileStorage } from '../../infrastructure/adapters/file-storage.adapter';
import { PlatformTestKit, outcome, valueOf } from '../../testing/platform-test-kit';
import { ReadFileContentUseCase } from './read-file-content.use-case';
import { UploadFileUseCase } from './upload-file.use-case';

function linkParts(dto: FileDto): { exp: string; sig: string } {
    const url = new URL(dto.url, 'https://app.test');
    return { exp: url.searchParams.get('exp') ?? '', sig: url.searchParams.get('sig') ?? '' };
}

describe('ReadFileContentUseCase', () => {
    let kit: PlatformTestKit;
    let useCase: ReadFileContentUseCase;
    let dto: FileDto;

    beforeEach(async () => {
        kit = new PlatformTestKit();
        useCase = new ReadFileContentUseCase(kit.files, kit.storage, kit.signer, kit.clock);
        const upload = new UploadFileUseCase(kit.files, kit.storage, kit.links, kit.settings, kit.clock, kit.ids);
        dto = valueOf(await upload.execute({
            actorId: kit.newUserId(), purpose: 'contract_scan', name: 'สัญญา.pdf', contentType: 'application/pdf', bytes: new Uint8Array([9, 8, 7]),
        }));
    });

    it('answers the bytes of a valid link (with the seconds left for caching)', async () => {
        const content = valueOf(await useCase.execute({ fileId: dto.id, ...linkParts(dto) }));
        expect(content.bytes).toEqual(new Uint8Array([9, 8, 7]));
        expect(content.file.contentType).toBe('application/pdf');
        expect(content.maxAgeSeconds).toBeGreaterThanOrEqual(3600);
    });

    it('accepts the id in upper case', async () => {
        expect(outcome(await useCase.execute({ fileId: dto.id.toUpperCase(), ...linkParts(dto) }))).toBe('ok');
    });

    it('a tampered signature is not_found', async () => {
        const { exp, sig } = linkParts(dto);
        const flipped = `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
        expect(outcome(await useCase.execute({ fileId: dto.id, exp, sig: flipped }))).toBe('not_found');
    });

    it('a later exp with the old signature is not_found', async () => {
        const { exp, sig } = linkParts(dto);
        expect(outcome(await useCase.execute({ fileId: dto.id, exp: String(Number(exp) + 3600), sig }))).toBe('not_found');
    });

    it('an expired link is not_found', async () => {
        kit.clock.advance(2 * 3600 * 1000);
        expect(outcome(await useCase.execute({ fileId: dto.id, ...linkParts(dto) }))).toBe('not_found');
    });

    it('the signature of one file does not open another', async () => {
        const other = '00000000-0000-4000-8000-00000000abcd';
        expect(outcome(await useCase.execute({ fileId: other, ...linkParts(dto) }))).toBe('not_found');
    });

    it('a signed link to a file without metadata is not_found', async () => {
        const ghost = '00000000-0000-4000-8000-00000000beef';
        const link = kit.signer.sign(ghost, kit.clock.now());
        expect(outcome(await useCase.execute({ fileId: ghost, exp: String(link.exp), sig: link.sig }))).toBe('not_found');
    });

    it('missing bytes are not_found', async () => {
        const empty = new ReadFileContentUseCase(kit.files, new InMemoryFileStorage(), kit.signer, kit.clock);
        expect(outcome(await empty.execute({ fileId: dto.id, ...linkParts(dto) }))).toBe('not_found');
    });

    it.each([
        ['no signature', { exp: '1', sig: undefined }],
        ['no exp', { exp: undefined, sig: 'abc' }],
        ['a non-numeric exp', { exp: '12abc', sig: 'abc' }],
    ])('%s is not_found', async (_label, parts) => {
        expect(outcome(await useCase.execute({ fileId: dto.id, ...parts }))).toBe('not_found');
    });

    it('a malformed id is not_found', async () => {
        expect(outcome(await useCase.execute({ fileId: '../etc/passwd', ...linkParts(dto) }))).toBe('not_found');
    });
});
