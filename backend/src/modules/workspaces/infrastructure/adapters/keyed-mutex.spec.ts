import { KeyedMutex } from './keyed-mutex';

const tick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('KeyedMutex', () => {
    it('runs work for the same key one at a time, in order', async () => {
        const mutex = new KeyedMutex();
        const log: string[] = [];
        const job = (name: string) => mutex.run('k', async () => {
            log.push(`${name}:start`);
            await tick();
            log.push(`${name}:end`);
            return name;
        });

        expect(await Promise.all([job('a'), job('b'), job('c')])).toEqual(['a', 'b', 'c']);
        expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
    });

    it('does not serialise different keys', async () => {
        const mutex = new KeyedMutex();
        const log: string[] = [];
        const job = (key: string) => mutex.run(key, async () => {
            log.push(`${key}:start`);
            await tick();
            log.push(`${key}:end`);
        });

        await Promise.all([job('x'), job('y')]);
        expect(log.slice(0, 2)).toEqual(['x:start', 'y:start']);
    });

    it('releases the lock when work throws', async () => {
        const mutex = new KeyedMutex();
        await expect(mutex.run('k', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
        expect(await mutex.run('k', () => Promise.resolve(42))).toBe(42);
    });
});
