// ─── Environment, validated once at start-up (the process refuses to start on a bad value) ───
import { z } from 'zod';
import { MODULE_IDS, type ModuleId } from '@contrack/contract';

const bool = z.enum(['true', 'false']).transform(v => v === 'true');

/**
 * MODULES_ENABLED: the business modules this server offers, comma-separated (`workforce`); empty = plain BOQ.
 * An unknown id refuses the start (a typo would otherwise switch a module off silently). Duplicates are dropped.
 */
const modulesEnabled = z.string().default('')
    .transform(v => v.split(',').map(s => s.trim()).filter(s => s !== ''))
    .superRefine((ids, ctx) => {
        for (const id of ids) {
            if (!(MODULE_IDS as readonly string[]).includes(id)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown module "${id}" (known: ${MODULE_IDS.join(', ')})` });
            }
        }
    })
    .transform((ids): ModuleId[] => MODULE_IDS.filter(m => ids.includes(m)));

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    PERSISTENCE: z.enum(['postgres', 'memory']).default('postgres'),
    DATABASE_URL: z.string().url().optional(),
    REALTIME_BUS: z.enum(['memory', 'postgres']).default('memory'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    INVITATION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    CORS_ORIGINS: z.string().default('http://localhost:3000')
        .transform(v => v.split(',').map(s => s.trim()).filter(s => s !== '')),
    COOKIE_SECURE: bool.default('false'),
    /** Path of the refresh cookie as the browser sees it (the web app reaches the API through `/api/*`). */
    REFRESH_COOKIE_PATH: z.string().startsWith('/').default('/api/auth'),
    MODULES_ENABLED: modulesEnabled,
}).superRefine((env, ctx) => {
    if (env.PERSISTENCE === 'postgres' && env.DATABASE_URL === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'required when PERSISTENCE=postgres' });
    }
    if (env.REALTIME_BUS === 'postgres' && env.PERSISTENCE !== 'postgres') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['REALTIME_BUS'], message: 'postgres bus needs PERSISTENCE=postgres' });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'must be true in production' });
    }
});

export type Env = z.infer<typeof envSchema>;

/** Typed configuration, injected where needed (`constructor(private readonly config: AppConfig)`). */
export class AppConfig {
    constructor(readonly env: Env) {}

    get persistence(): Env['PERSISTENCE'] {
        return this.env.PERSISTENCE;
    }

    get isProduction(): boolean {
        return this.env.NODE_ENV === 'production';
    }

    /** The business modules this server offers (in MODULE_IDS order). */
    get modulesEnabled(): readonly ModuleId[] {
        return this.env.MODULES_ENABLED;
    }

    isModuleEnabled(id: ModuleId): boolean {
        return this.env.MODULES_ENABLED.includes(id);
    }
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
    const parsed = envSchema.safeParse(source);
    if (!parsed.success) {
        const lines = parsed.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Invalid environment:\n${lines}`);
    }
    return parsed.data;
}

/** Configuration for tests and the in-memory e2e app: every business module on (`MODULES_ENABLED: ''` turns them off). */
export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
    return loadEnv({
        NODE_ENV: 'test',
        PERSISTENCE: 'memory',
        JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
        MODULES_ENABLED: MODULE_IDS.join(','),
        ...overrides,
    });
}
