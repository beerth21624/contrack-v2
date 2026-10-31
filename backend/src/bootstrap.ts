// ─── Builds the configured Nest application (used by main.ts and by the e2e tests) ───
import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import type { CoreOptions } from './shared/infrastructure/core.module';

/**
 * Largest JSON request body. Express' default (100 kB) is below MAX_DOC_BYTES (256 kB), so a valid document could
 * not be saved; this leaves room for one maximal document and for the upload of a guest project (many documents).
 */
export const JSON_BODY_LIMIT = '8mb';

/** Socket.IO with this app's CORS origins (per app instance, so e2e apps with different settings stay apart). */
class CorsIoAdapter extends IoAdapter {
    constructor(app: INestApplication, private readonly origins: string[]) {
        super(app);
    }

    override createIOServer(port: number, options?: ServerOptions): unknown {
        return super.createIOServer(port, { ...options, cors: { origin: this.origins, credentials: true } });
    }
}

/** JSON.parse reviver: a string value or key containing U+0000 makes the body invalid (400 from the body parser). */
export function rejectNulCharacters(key: string, value: unknown): unknown {
    if (key.includes('\u0000') || (typeof value === 'string' && value.includes('\u0000'))) {
        throw new SyntaxError('Text must not contain the NUL character (U+0000)');
    }
    return value;
}

export async function createApp(options: CoreOptions): Promise<INestApplication> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), {
        logger: options.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
    });
    // PostgreSQL text and jsonb cannot store U+0000: a NUL in any string (or key) of a JSON body used to reach the
    // database and answer 500. Refused while parsing instead, so every route answers 400 validation_failed.
    app.useBodyParser('json', { limit: JSON_BODY_LIMIT, reviver: rejectNulCharacters });
    // The web app reaches the API through the Next rewrite (/api → backend). X-Forwarded-For is believed only from the
    // proxies env TRUST_PROXY names (default: loopback, the local Next server), so `req.ip` is the browser's address
    // behind that proxy and a client talking to the API directly cannot pick its own (per-IP rate limits).
    app.set('trust proxy', options.env.TRUST_PROXY);
    app.use(cookieParser());
    app.enableCors({ origin: options.env.CORS_ORIGINS, credentials: true });
    app.useWebSocketAdapter(new CorsIoAdapter(app, options.env.CORS_ORIGINS));
    app.enableShutdownHooks();
    return app;
}
