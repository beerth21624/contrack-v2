// ─── Environment, validated once at start-up (the process refuses to start on a bad value) ───
import { isIP } from 'node:net';
import { z } from 'zod';
import { MODULE_IDS, MODULE_REGISTRY, type ModuleId } from '@contrack/contract';

/** ERP modules (docs/erp/01-architecture.md §4.1, `kind: 'erp'` in the registry); testEnv() offers them all. */
const ERP_MODULE_IDS: readonly ModuleId[] = MODULE_IDS.filter(m => MODULE_REGISTRY[m].kind === 'erp');

const bool = z.enum(['true', 'false']).transform(v => v === 'true');

/** Names Express understands in a `trust proxy` list. */
const TRUST_PROXY_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

/** One `trust proxy` list entry: a name above, an IP address, or an IP subnet (CIDR). */
function isTrustProxyEntry(entry: string): boolean {
    if (TRUST_PROXY_NAMES.has(entry)) return true;
    const [address = '', prefix, ...rest] = entry.split('/');
    const family = isIP(address);
    if (family === 0 || rest.length > 0) return false;
    if (prefix === undefined) return true;
    if (!/^\d{1,3}$/.test(prefix)) return false;
    return Number(prefix) <= (family === 4 ? 32 : 128);
}

/**
 * Which proxies may set X-Forwarded-For (Express `trust proxy`): `false` (none), a hop count, or a comma separated
 * list of names (loopback, linklocal, uniquelocal), addresses and subnets. `true` (trust every sender) is refused:
 * any client could then pick its own address and dodge the per-IP rate limits.
 */
const trustProxy = z.string().default('loopback').transform((raw, ctx): TrustProxy => {
    const value = raw.trim();
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return Number(value);
    const entries = value.split(',').map(s => s.trim()).filter(s => s !== '');
    const bad = entries.filter(e => !isTrustProxyEntry(e));
    if (entries.length === 0 || bad.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: value === 'true'
                ? 'true would trust every client; name the proxy (loopback, an address / subnet) or a hop count'
                : `expected false, a hop count, or loopback / linklocal / uniquelocal / IP / CIDR entries (bad: ${bad.length > 0 ? bad.join(', ') : 'empty'})`,
        });
        return z.NEVER;
    }
    return entries;
});

/** Value for `app.set('trust proxy', …)`. */
export type TrustProxy = false | number | string[];

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
    /** Proxies whose X-Forwarded-For is believed (req.ip for rate limits). Default: only the local Next server. */
    TRUST_PROXY: trustProxy,
    /**
     * Business modules this server offers (layer 1 of 4, docs/erp/01-architecture.md §4.3), comma separated.
     * Legacy: subcontracting, materials, owner-leads, ai-assist, workforce.
     * ERP: project-hub, portal, boq-control, quotations, contracts, billing, variations, procurement, site-diary,
     * labour, job-cost, payables, handover.
     * Empty = ConTrack is plain BOQ estimation (release 1). A workspace can switch on only what is listed here; an ERP
     * module also needs an entitlement (ENTITLEMENTS) and its dependencies (src/shared/contract/module-registry.ts).
     */
    MODULES_ENABLED: z.string().default('')
        .transform(v => v.split(',').map(s => s.trim()).filter(s => s !== ''))
        .pipe(z.array(z.enum(MODULE_IDS))),
    /**
     * Layer 2: `enforce` = an ERP module is active only with an unexpired purchased / trial / beta grant
     * (workspace_entitlements); `open` = every module counts as entitled (development, tests).
     * Default: enforce when NODE_ENV=production, else open. Legacy modules never need a grant.
     */
    ENTITLEMENTS: z.enum(['enforce', 'open']).optional(),
    /** Platform admins (grant module entitlements): comma separated e-mails, compared lower case. Default none. */
    PLATFORM_ADMIN_EMAILS: z.string().default('')
        .transform(v => v.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== ''))
        .pipe(z.array(z.string().email())),
    /** Public URL of the web app, for links in SMS / LINE / e-mail (invitations, notifications). */
    PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
    /** Uploaded files: local = FILE_STORAGE_DIR on disk; memory = in-process (tests, PERSISTENCE=memory). */
    FILE_STORAGE: z.enum(['local', 'memory']).default('local'),
    FILE_STORAGE_DIR: z.string().default('.data/files'),
    FILE_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(7 * 86_400).default(3600),
    /** console = print messages to the server log (development); thaibulksms = real SMS. */
    SMS_PROVIDER: z.enum(['console', 'thaibulksms']).default('console'),
    SMS_API_KEY: z.string().optional(),
    SMS_API_SECRET: z.string().optional(),
    SMS_SENDER: z.string().optional(),
    /** LINE Messaging API channel token (LINE OA); unset = LINE delivery off. */
    LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
    OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
    /** Decision model (module `ai-assist`, Jev by TypeSafe AI). The key is required when the module is offered. */
    JEV_API_KEY: z.string().optional(),
    JEV_MODEL: z.string().min(1).default('jev-1.14.0'),
    JEV_BASE_URL: z.string().url().default('https://jevtypesafeai.com/api/v1'),
}).superRefine((env, ctx) => {
    if (env.MODULES_ENABLED.includes('ai-assist') && env.NODE_ENV !== 'test' && (env.JEV_API_KEY === undefined || env.JEV_API_KEY === '')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JEV_API_KEY'], message: 'required when MODULES_ENABLED includes ai-assist' });
    }
    if (env.PERSISTENCE === 'postgres' && env.DATABASE_URL === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'required when PERSISTENCE=postgres' });
    }
    if (env.REALTIME_BUS === 'postgres' && env.PERSISTENCE !== 'postgres') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['REALTIME_BUS'], message: 'postgres bus needs PERSISTENCE=postgres' });
    }
    if (env.SMS_PROVIDER === 'thaibulksms' && (env.SMS_API_KEY === undefined || env.SMS_API_SECRET === undefined)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SMS_API_KEY'], message: 'SMS_API_KEY and SMS_API_SECRET are required for thaibulksms' });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'must be true in production' });
    }
}).transform(env => ({
    ...env,
    ENTITLEMENTS: env.ENTITLEMENTS ?? (env.NODE_ENV === 'production' ? 'enforce' as const : 'open' as const),
}));

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

    /** Layer 2 of the module flags: `open` treats every module as entitled. */
    get entitlements(): Env['ENTITLEMENTS'] {
        return this.env.ENTITLEMENTS;
    }

    /** Lower-case e-mails of the platform admins (used by WP-07). */
    get platformAdminEmails(): readonly string[] {
        return this.env.PLATFORM_ADMIN_EMAILS;
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

/**
 * Configuration for tests and the in-memory e2e app: the legacy modules that exist (subcontracting, ai-assist,
 * workforce) and every ERP module offered, entitlements open (`MODULES_ENABLED: ''` turns them all off).
 */
export function testEnv(overrides: Partial<Record<keyof Env, string>> = {}): Env {
    return loadEnv({
        NODE_ENV: 'test',
        PERSISTENCE: 'memory',
        JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
        MODULES_ENABLED: ['subcontracting', 'ai-assist', 'workforce', ...ERP_MODULE_IDS].join(','),
        ENTITLEMENTS: 'open',
        FILE_STORAGE: 'memory',
        ...overrides,
    });
}
