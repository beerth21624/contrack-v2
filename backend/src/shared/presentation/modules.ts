// ─── Business modules that can be switched on and off (env MODULES_ENABLED, contract: modules.ts) ───
// `@RequiresModule('workforce')` on a controller makes every route of it answer 404 `module_disabled` while the module
// is off. ModuleGuard is registered as a global guard BEFORE the AuthGuard, so a switched-off module answers the same
// for everyone (signed in or not) and reveals nothing else. The module's data is kept. GET /platform/modules is the
// platform module's (src/modules/platform).
import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ModuleId } from '@contrack/contract';
import { DomainError } from '../domain/domain-error';
import { AppConfig } from '../infrastructure/config/env';
import { DomainHttpException } from './http';

const REQUIRES_MODULE = 'contrack:requires-module';

/** Marks a controller (or a route) as part of a business module. */
export const RequiresModule = (id: ModuleId): MethodDecorator & ClassDecorator => SetMetadata(REQUIRES_MODULE, id);

export function moduleDisabled(id: ModuleId): DomainError {
    return new DomainError('module_disabled', `The module "${id}" is not enabled on this server`);
}

@Injectable()
export class ModuleGuard implements CanActivate {
    constructor(private readonly reflector: Reflector, private readonly config: AppConfig) {}

    canActivate(context: ExecutionContext): boolean {
        const id = this.reflector.getAllAndOverride<ModuleId | undefined>(REQUIRES_MODULE, [context.getHandler(), context.getClass()]);
        if (id !== undefined && !this.config.isModuleEnabled(id)) throw new DomainHttpException(moduleDisabled(id));
        return true;
    }
}
