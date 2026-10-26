// ─── Builds the configured Nest application (used by main.ts and by the e2e tests) ───
import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import type { ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import type { CoreOptions } from './shared/infrastructure/core.module';

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
    const app = await NestFactory.create(AppModule.forRoot(options), {
        logger: options.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
    });
    app.use(cookieParser());
    app.enableCors({ origin: options.env.CORS_ORIGINS, credentials: true });
    app.useWebSocketAdapter(new CorsIoAdapter(app, options.env.CORS_ORIGINS));
    app.enableShutdownHooks();
    return app;
}
