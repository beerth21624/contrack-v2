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

export async function createApp(options: CoreOptions): Promise<INestApplication> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), {
        logger: options.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
    });
    app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
    app.use(cookieParser());
    app.enableCors({ origin: options.env.CORS_ORIGINS, credentials: true });
    app.useWebSocketAdapter(new CorsIoAdapter(app, options.env.CORS_ORIGINS));
    app.enableShutdownHooks();
    return app;
}
