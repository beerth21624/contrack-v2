import { createApp } from './bootstrap';
import { loadEnv } from './shared/infrastructure/config/env';

async function main(): Promise<void> {
    const env = loadEnv();
    const app = await createApp({ env });
    await app.listen(env.PORT);
    console.log(`ConTrack API on :${env.PORT} (persistence=${env.PERSISTENCE}, realtime=${env.REALTIME_BUS})`);
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
