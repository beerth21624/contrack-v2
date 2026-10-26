// ─── Builds the configured Nest application (used by main.ts and by the e2e tests) ───
import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { CoreOptions } from './shared/infrastructure/core.module';

export async function createApp(options: CoreOptions): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule.forRoot(options), {
        logger: options.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
    });
    app.use(cookieParser());
    app.enableCors({ origin: options.env.CORS_ORIGINS, credentials: true });
    app.useWebSocketAdapter(new IoAdapter(app));
    app.enableShutdownHooks();
    return app;
}
