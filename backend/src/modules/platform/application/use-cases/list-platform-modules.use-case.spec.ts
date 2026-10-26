import { PlatformSettings } from '../ports/platform-settings.port';
import { ListPlatformModulesUseCase } from './list-platform-modules.use-case';

describe('ListPlatformModulesUseCase', () => {
    it('lists what the env offers, in MODULE_IDS order', () => {
        const useCase = new ListPlatformModulesUseCase(new PlatformSettings(['owner-leads', 'subcontracting'], 'https://app.test'));
        expect(useCase.execute()).toEqual(['subcontracting', 'owner-leads']);
    });

    it('is empty when the platform is plain BOQ estimation', () => {
        expect(new ListPlatformModulesUseCase(new PlatformSettings([], 'https://app.test')).execute()).toEqual([]);
    });
});
