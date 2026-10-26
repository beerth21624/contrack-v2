import { Notification } from '../../domain/entities/notification.entity';
import { asNotificationId } from '../../domain/platform-ids';
import { PlatformTestKit, valueOf } from '../../testing/platform-test-kit';
import { ListNotificationsUseCase } from './list-notifications.use-case';
import { MarkNotificationsReadUseCase } from './mark-notifications-read.use-case';

describe('ListNotificationsUseCase / MarkNotificationsReadUseCase', () => {
    let kit: PlatformTestKit;
    let list: ListNotificationsUseCase;
    let markRead: MarkNotificationsReadUseCase;

    beforeEach(() => {
        kit = new PlatformTestKit();
        list = new ListNotificationsUseCase(kit.notifications);
        markRead = new MarkNotificationsReadUseCase(kit.notifications, kit.clock);
    });

    async function add(userId: ReturnType<PlatformTestKit['newUserId']>, title: string): Promise<string> {
        const id = kit.ids.newId();
        await kit.notifications.insertMany([Notification.create({
            id: asNotificationId(id), userId, template: 'sc.message', title, body: 'b', href: '/x', payload: {}, createdAt: kit.clock.now(),
        })]);
        kit.clock.advance(1000);
        return id;
    }

    it('lists only the caller\'s own notifications, newest first, with the unread count', async () => {
        const me = kit.newUserId();
        const other = kit.newUserId();
        await add(me, 'one');
        await add(other, 'theirs');
        await add(me, 'two');
        const out = valueOf(await list.execute({ actorId: me, limit: 30 }));
        expect(out.items.map(n => n.title)).toEqual(['two', 'one']);
        expect(out.unread).toBe(2);
    });

    it('respects the limit (clamped to 1…100) while counting every unread one', async () => {
        const me = kit.newUserId();
        for (const t of ['a', 'b', 'c']) await add(me, t);
        const out = valueOf(await list.execute({ actorId: me, limit: 2 }));
        expect(out.items.map(n => n.title)).toEqual(['c', 'b']);
        expect(out.unread).toBe(3);
        expect(valueOf(await list.execute({ actorId: me, limit: 0 })).items).toHaveLength(1);
    });

    it('marks given ids read (own only; other users\' ids and junk do nothing)', async () => {
        const me = kit.newUserId();
        const other = kit.newUserId();
        const mine = await add(me, 'mine');
        await add(me, 'mine too');
        const theirs = await add(other, 'theirs');
        valueOf(await markRead.execute({ actorId: me, ids: [mine.toUpperCase(), theirs, 'junk'] }));
        const out = valueOf(await list.execute({ actorId: me, limit: 30 }));
        expect(out.unread).toBe(1);
        expect(out.items.find(n => n.id === mine)?.readAt).toEqual(kit.clock.now());
        expect(valueOf(await list.execute({ actorId: other, limit: 30 })).unread).toBe(1);
    });

    it('marks everything read with all: true', async () => {
        const me = kit.newUserId();
        await add(me, 'a');
        await add(me, 'b');
        valueOf(await markRead.execute({ actorId: me, all: true }));
        expect(valueOf(await list.execute({ actorId: me, limit: 30 })).unread).toBe(0);
    });

    it('reading again keeps the first read time', async () => {
        const me = kit.newUserId();
        const id = await add(me, 'a');
        valueOf(await markRead.execute({ actorId: me, ids: [id] }));
        const first = kit.clock.now();
        kit.clock.advance(60_000);
        valueOf(await markRead.execute({ actorId: me, all: true }));
        expect(valueOf(await list.execute({ actorId: me, limit: 1 })).items[0]?.readAt).toEqual(first);
    });

    it('neither ids nor all is a validation error', async () => {
        const r = await markRead.execute({ actorId: kit.newUserId() });
        expect(r.ok ? 'ok' : r.error.code).toBe('validation_failed');
    });

    it('an empty ids list is fine', async () => {
        expect((await markRead.execute({ actorId: kit.newUserId(), ids: [] })).ok).toBe(true);
    });
});
