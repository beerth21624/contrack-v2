// ─── Presence: who has which project open (and on which level), shared between server instances ───
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PRESENCE_HEARTBEAT_MS, PRESENCE_TTL_MS, type PresenceEntry } from '@contrack/contract';
import { Clock } from '../../../../shared/application/ports';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';
import { type PresenceConnection, PresenceRoster } from '../../domain/entities/presence-roster.entity';
import { projectRoom } from '../../domain/policies/room-naming.policy';
import { Broadcaster } from '../ports/broadcaster.port';
import { IntervalScheduler, type ScheduledTask } from '../ports/interval-scheduler.port';
import {
    type BusMessage, type PresenceSyncMessage, RealtimeBus, type SharedPresence, type Unsubscribe,
} from '../ports/realtime-bus.port';
import { RealtimeInstance } from '../ports/realtime-instance.port';
import { errorMessage } from './error-message';

/** How often stale connections are looked for (a third of a heartbeat). */
export const PRESENCE_SWEEP_MS = PRESENCE_HEARTBEAT_MS / 3;

/** One socket of a signed-in user. */
export interface PresenceViewer {
    readonly connectionId: string;
    readonly userId: UserId;
    readonly displayName: string;
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PresenceService.name);
    private readonly roster = PresenceRoster.create();
    /** What each room was last told (without times), so heartbeats that change nothing are not broadcast. */
    private readonly shown = new Map<ProjectId, string>();
    private sweeper: ScheduledTask | undefined;
    private unsubscribe: Unsubscribe | undefined;

    constructor(
        private readonly clock: Clock,
        private readonly broadcaster: Broadcaster,
        private readonly bus: RealtimeBus,
        private readonly instance: RealtimeInstance,
        private readonly scheduler: IntervalScheduler,
    ) {}

    onModuleInit(): Promise<void> {
        return this.start();
    }

    onModuleDestroy(): void {
        this.stop();
    }

    /** Listens to the other instances, starts the sweeper and asks the others for their presence. */
    async start(): Promise<void> {
        if (this.unsubscribe !== undefined) return;
        this.unsubscribe = this.bus.subscribe(message => this.receive(message));
        this.sweeper = this.scheduler.every(PRESENCE_SWEEP_MS, () => {
            void this.sweep();
        });
        await this.share({ kind: 'presence.hello', origin: this.instance.id });
    }

    stop(): void {
        this.sweeper?.cancel();
        this.sweeper = undefined;
        this.unsubscribe?.();
        this.unsubscribe = undefined;
    }

    /** A socket joined the project room: always tells the room (the new socket needs the state). */
    async join(viewer: PresenceViewer, projectId: ProjectId): Promise<void> {
        this.roster.join(projectId, this.localConnection(viewer, null));
        this.broadcast(projectId, true);
        await this.shareProject(projectId);
    }

    /** Heartbeat, possibly with another level. Re-adds the connection when the sweeper had forgotten it. */
    async update(viewer: PresenceViewer, projectId: ProjectId, levelId: string | null): Promise<void> {
        const updated = this.roster.update(projectId, this.instance.id, viewer.connectionId, {
            levelId, seenAt: this.clock.now(),
        });
        if (!updated) this.roster.join(projectId, this.localConnection(viewer, levelId));
        this.broadcast(projectId);
        await this.shareProject(projectId);
    }

    async leave(connectionId: string, projectId: ProjectId): Promise<void> {
        if (!this.roster.leave(projectId, this.instance.id, connectionId)) return;
        this.broadcast(projectId);
        await this.shareProject(projectId);
    }

    /** The socket closed: it leaves every project it was in. */
    async disconnect(connectionId: string): Promise<void> {
        const affected = this.roster.leaveAll(this.instance.id, connectionId);
        for (const projectId of affected) this.broadcast(projectId);
        await Promise.all(affected.map(projectId => this.shareProject(projectId)));
    }

    /** Forgets connections without a heartbeat for PRESENCE_TTL_MS (called by the sweeper; tests call it directly). */
    async sweep(now: Date = this.clock.now()): Promise<void> {
        const affected = this.roster.expire(now, PRESENCE_TTL_MS);
        for (const projectId of affected) this.broadcast(projectId);
        await Promise.all(affected.map(projectId => this.shareProject(projectId)));
    }

    /**
     * The project was deleted: forgets its presence without broadcasting (its room is being emptied). Every instance
     * does this itself on the project.deleted bus message, so nothing is shared.
     */
    forgetProject(projectId: ProjectId): void {
        this.roster.removeProject(projectId);
        this.shown.delete(projectId);
    }

    snapshot(projectId: ProjectId): PresenceEntry[] {
        return this.roster.snapshot(projectId);
    }

    /** Presence from another instance. */
    async receive(message: BusMessage): Promise<void> {
        if (message.origin === this.instance.id) return;
        if (message.kind === 'presence.hello') {
            await Promise.all(this.roster.projectsOf(this.instance.id).map(projectId => this.shareProject(projectId)));
            return;
        }
        if (message.kind !== 'presence.sync') return;
        this.roster.replaceInstance(message.projectId, message.origin, this.remoteConnections(message));
        this.broadcast(message.projectId);
    }

    private broadcast(projectId: ProjectId, force = false): void {
        const users = this.roster.snapshot(projectId);
        const signature = users.map(u => `${u.userId}\u0000${u.displayName}\u0000${u.levelId ?? ''}`).join('\u0001');
        if (!force && this.shown.get(projectId) === signature) return;
        if (users.length === 0) this.shown.delete(projectId);
        else this.shown.set(projectId, signature);
        this.broadcaster.emit(projectRoom(projectId), 'presence.state', { projectId, users });
    }

    private async shareProject(projectId: ProjectId): Promise<void> {
        const connections: SharedPresence[] = this.roster.connectionsOf(projectId, this.instance.id).map(c => ({
            connectionId: c.connectionId,
            userId: c.userId,
            displayName: c.displayName,
            levelId: c.levelId,
            seenAt: c.seenAt.toISOString(),
        }));
        await this.share({ kind: 'presence.sync', origin: this.instance.id, projectId, connections });
    }

    private async share(message: BusMessage): Promise<void> {
        try {
            await this.bus.publish(message);
        } catch (error) {
            this.logger.error(`Could not share ${message.kind} on the realtime bus: ${errorMessage(error)}`);
        }
    }

    private localConnection(viewer: PresenceViewer, levelId: string | null): PresenceConnection {
        return {
            userId: viewer.userId,
            displayName: viewer.displayName,
            levelId,
            seenAt: this.clock.now(),
            connectionId: viewer.connectionId,
            instanceId: this.instance.id,
        };
    }

    private remoteConnections(message: PresenceSyncMessage): PresenceConnection[] {
        const now = this.clock.now();
        return message.connections.map(c => {
            const seenAt = new Date(c.seenAt);
            return {
                userId: c.userId,
                displayName: c.displayName,
                levelId: c.levelId,
                // A bad time would never expire: count it as seen now.
                seenAt: Number.isNaN(seenAt.getTime()) ? now : seenAt,
                connectionId: c.connectionId,
                instanceId: message.origin,
            };
        });
    }
}
