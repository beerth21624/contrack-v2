import type { ModuleId } from '@contrack/contract';
import type { EntitlementMode } from '../../domain/module-activation';

/** Settings the platform use cases need (built from AppConfig in the module, literal in tests). */
export class PlatformSettings {
    constructor(
        /** Modules the platform offers (env MODULES_ENABLED). */
        readonly modulesEnabled: readonly ModuleId[],
        /** Public URL of the web app, without a trailing slash (env PUBLIC_APP_URL). */
        readonly publicAppUrl: string,
        /** env ENTITLEMENTS: `open` treats every module as entitled. */
        readonly entitlements: EntitlementMode = 'open',
    ) {}
}
