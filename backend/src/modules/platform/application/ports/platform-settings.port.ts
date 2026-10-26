import type { ModuleId } from '@contrack/contract';

/** Settings the platform use cases need (built from AppConfig in the module, literal in tests). */
export class PlatformSettings {
    constructor(
        /** Modules the platform offers (env MODULES_ENABLED). */
        readonly modulesEnabled: readonly ModuleId[],
        /** Public URL of the web app, without a trailing slash (env PUBLIC_APP_URL). */
        readonly publicAppUrl: string,
    ) {}
}
