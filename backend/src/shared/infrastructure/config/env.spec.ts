import { AppConfig, loadEnv, testEnv } from './env';

const BASE = { JWT_ACCESS_SECRET: 'x'.repeat(32), PERSISTENCE: 'memory' };

describe('MODULES_ENABLED', () => {
    it('defaults to none (plain BOQ estimation)', () => {
        expect(loadEnv(BASE).MODULES_ENABLED).toEqual([]);
        expect(loadEnv({ ...BASE, MODULES_ENABLED: ' ' }).MODULES_ENABLED).toEqual([]);
    });

    it('a comma-separated list of known modules (spaces and duplicates ignored)', () => {
        expect(loadEnv({ ...BASE, MODULES_ENABLED: ' workforce , workforce,' }).MODULES_ENABLED).toEqual(['workforce']);
        const config = new AppConfig(loadEnv({ ...BASE, MODULES_ENABLED: 'workforce' }));
        expect(config.isModuleEnabled('workforce')).toBe(true);
        expect(new AppConfig(loadEnv(BASE)).isModuleEnabled('workforce')).toBe(false);
    });

    it('an unknown module refuses the start', () => {
        expect(() => loadEnv({ ...BASE, MODULES_ENABLED: 'workforce,subcontracting' })).toThrow(/unknown module "subcontracting"/);
    });

    it('testEnv switches every module on; an override can switch them off', () => {
        expect(testEnv().MODULES_ENABLED).toEqual(['workforce']);
        expect(testEnv({ MODULES_ENABLED: '' }).MODULES_ENABLED).toEqual([]);
    });
});
