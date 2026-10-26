import type { Role } from '@contrack/contract';
import { DEFAULT_SUBCONTRACTING_SETTINGS } from '../../../shared/settings';
import { BUYER, BUYER_WS, OUTSIDER, VENDOR, VENDOR_WS, codeOf, contractsKit, must } from '../../testing/contracts-test-kit';

describe('Subcontracting settings', () => {
    it('GET returns the defaults until saved; PUT sanitizes the template', async () => {
        const kit = contractsKit();
        expect(must(await kit.getSettings.execute({ userId: BUYER.viewer, workspaceId: BUYER_WS }))).toEqual(DEFAULT_SUBCONTRACTING_SETTINGS);
        const saved = must(await kit.putSettings.execute({
            userId: BUYER.admin, workspaceId: BUYER_WS,
            settings: { ...DEFAULT_SUBCONTRACTING_SETTINGS, defaultRetentionPct: 0.1, contractTemplateHtml: '<p style="x">{{contractNo}}</p><script>alert(1)</script>' },
        }));
        expect(saved.contractTemplateHtml).toBe('<p>{{contractNo}}</p>');
        expect(must(await kit.getSettings.execute({ userId: BUYER.estimator, workspaceId: BUYER_WS }))).toMatchObject({ defaultRetentionPct: 0.1, contractTemplateHtml: '<p>{{contractNo}}</p>' });
    });

    it.each<[Role, string]>([['owner', 'ok'], ['admin', 'ok'], ['estimator', 'forbidden'], ['viewer', 'forbidden']])(
        '%s saves settings: %s', async (role, code) => {
            const kit = contractsKit();
            expect(codeOf(await kit.putSettings.execute({ userId: BUYER[role], workspaceId: BUYER_WS, settings: DEFAULT_SUBCONTRACTING_SETTINGS }))).toBe(code);
        },
    );

    it('non-member → not_found; module off → module_disabled', async () => {
        const kit = contractsKit();
        expect(codeOf(await kit.getSettings.execute({ userId: OUTSIDER, workspaceId: BUYER_WS }))).toBe('not_found');
        expect(codeOf(await kit.getSettings.execute({ userId: VENDOR.owner, workspaceId: BUYER_WS }))).toBe('not_found');
        kit.flags.set(BUYER_WS, 'subcontracting', false);
        expect(codeOf(await kit.getSettings.execute({ userId: BUYER.owner, workspaceId: BUYER_WS }))).toBe('module_disabled');
        expect(codeOf(await kit.getSettings.execute({ userId: VENDOR.owner, workspaceId: VENDOR_WS }))).toBe('ok');
    });

    it('checklists come from the trades', () => {
        const kit = contractsKit();
        const lists = must(kit.checklists.execute());
        expect(Object.keys(lists)).toHaveLength(14);
        expect(lists.structure).toContain('บ่มคอนกรีตตามกำหนด');
    });

    it('checklists need the platform to offer the module', () => {
        const kit = contractsKit();
        kit.flags.platform.clear();
        expect(codeOf(kit.checklists.execute())).toBe('module_disabled');
    });
});
