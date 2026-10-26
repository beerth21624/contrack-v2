import { Injectable } from '@nestjs/common';
import { MODULE_IDS, type ModuleId } from '@contrack/contract';
import { PlatformSettings } from '../ports/platform-settings.port';

/** What this server offers at all (env MODULES_ENABLED), in MODULE_IDS order. Public: the web app hides menus with it. */
@Injectable()
export class ListPlatformModulesUseCase {
    constructor(private readonly settings: PlatformSettings) {}

    execute(): ModuleId[] {
        const offered = new Set(this.settings.modulesEnabled);
        return MODULE_IDS.filter(m => offered.has(m));
    }
}
