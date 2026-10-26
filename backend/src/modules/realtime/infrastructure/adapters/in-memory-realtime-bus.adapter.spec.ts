import type { BusMessage } from '../../application/ports/realtime-bus.port';
import { InMemoryRealtimeBus } from './in-memory-realtime-bus.adapter';

const hello = (origin: string): BusMessage => ({ kind: 'presence.hello', origin });

describe('InMemoryRealtimeBus', () => {
    it('delivers every message to every subscriber, the publisher included', async () => {
        const bus = new InMemoryRealtimeBus();
        const a: BusMessage[] = [];
        const b: BusMessage[] = [];
        bus.subscribe(m => { a.push(m); });
        bus.subscribe(m => { b.push(m); });

        await bus.publish(hello('i1'));

        expect(a).toEqual([hello('i1')]);
        expect(b).toEqual([hello('i1')]);
    });

    it('gives each subscriber its own copy', async () => {
        const bus = new InMemoryRealtimeBus();
        const message = hello('i1');
        let received: BusMessage | undefined;
        bus.subscribe(m => { received = m; });
        await bus.publish(message);
        expect(received).toEqual(message);
        expect(received).not.toBe(message);
    });

    it('waits for async subscribers', async () => {
        const bus = new InMemoryRealtimeBus();
        let done = false;
        bus.subscribe(async () => {
            await Promise.resolve();
            done = true;
        });
        await bus.publish(hello('i1'));
        expect(done).toBe(true);
    });

    it('stops delivering after unsubscribe', async () => {
        const bus = new InMemoryRealtimeBus();
        const received: BusMessage[] = [];
        const unsubscribe = bus.subscribe(m => { received.push(m); });
        unsubscribe();
        await bus.publish(hello('i1'));
        expect(received).toEqual([]);
    });

    it('keeps delivering to the others when a subscriber fails', async () => {
        const bus = new InMemoryRealtimeBus();
        const received: BusMessage[] = [];
        bus.subscribe(() => { throw new Error('boom'); });
        bus.subscribe(m => { received.push(m); });
        await expect(bus.publish(hello('i1'))).resolves.toBeUndefined();
        expect(received).toHaveLength(1);
    });

    it('delivers nothing once closed', async () => {
        const bus = new InMemoryRealtimeBus();
        const received: BusMessage[] = [];
        bus.subscribe(m => { received.push(m); });
        await bus.close();
        await bus.publish(hello('i1'));
        expect(received).toEqual([]);
    });
});
