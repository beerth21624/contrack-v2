// ─── Who is looking at which project right now (pure; one roster per server instance) ───
// The roster holds one entry per connection (browser tab), local or reported by another server instance.
// What clients see is the snapshot: one line per user, with the level of their most recently seen tab.
import type { PresenceEntry } from '@contrack/contract';
import type { ProjectId, UserId } from '../../../../shared/domain/ids';

export interface PresenceConnection {
    readonly userId: UserId;
    readonly displayName: string;
    /** Only the level id travels (never document data). null = not on a level page. */
    readonly levelId: string | null;
    /** Last heartbeat of this connection. */
    readonly seenAt: Date;
    /** Socket id, unique within its server instance. */
    readonly connectionId: string;
    /** Server instance holding the socket. */
    readonly instanceId: string;
}

export interface PresenceChange {
    readonly levelId: string | null;
    readonly seenAt: Date;
}

const keyOf = (instanceId: string, connectionId: string): string => `${instanceId}/${connectionId}`;

export class PresenceRoster {
    private readonly projects = new Map<ProjectId, Map<string, PresenceConnection>>();

    private constructor() {
        // use PresenceRoster.create()
    }

    static create(): PresenceRoster {
        return new PresenceRoster();
    }

    /** Adds a connection to a project (or replaces it when the connection is already there). */
    join(projectId: ProjectId, connection: PresenceConnection): void {
        let entries = this.projects.get(projectId);
        if (entries === undefined) {
            entries = new Map();
            this.projects.set(projectId, entries);
        }
        entries.set(keyOf(connection.instanceId, connection.connectionId), { ...connection });
    }

    /** Heartbeat / level change of a known connection. false when the connection is not in the project. */
    update(projectId: ProjectId, instanceId: string, connectionId: string, change: PresenceChange): boolean {
        const entries = this.projects.get(projectId);
        const key = keyOf(instanceId, connectionId);
        const current = entries?.get(key);
        if (entries === undefined || current === undefined) return false;
        entries.set(key, { ...current, levelId: change.levelId, seenAt: change.seenAt });
        return true;
    }

    /** Removes a connection from a project. false when it was not there. */
    leave(projectId: ProjectId, instanceId: string, connectionId: string): boolean {
        const entries = this.projects.get(projectId);
        if (entries === undefined) return false;
        const removed = entries.delete(keyOf(instanceId, connectionId));
        if (entries.size === 0) this.projects.delete(projectId);
        return removed;
    }

    /** Forgets every connection of a project, on every instance (the project was deleted). */
    removeProject(projectId: ProjectId): void {
        this.projects.delete(projectId);
    }

    /** Removes a connection from every project (socket closed). Returns the projects it was in. */
    leaveAll(instanceId: string, connectionId: string): ProjectId[] {
        const affected: ProjectId[] = [];
        for (const projectId of [...this.projects.keys()]) {
            if (this.leave(projectId, instanceId, connectionId)) affected.push(projectId);
        }
        return affected;
    }

    /** Replaces everything one instance reported for a project (presence shared by another server instance). */
    replaceInstance(projectId: ProjectId, instanceId: string, connections: readonly PresenceConnection[]): void {
        const entries = this.projects.get(projectId) ?? new Map<string, PresenceConnection>();
        for (const [key, entry] of entries) {
            if (entry.instanceId === instanceId) entries.delete(key);
        }
        for (const connection of connections) {
            entries.set(keyOf(instanceId, connection.connectionId), { ...connection, instanceId });
        }
        if (entries.size === 0) this.projects.delete(projectId);
        else this.projects.set(projectId, entries);
    }

    /** Connections one instance holds in a project. */
    connectionsOf(projectId: ProjectId, instanceId: string): PresenceConnection[] {
        return [...(this.projects.get(projectId)?.values() ?? [])].filter(e => e.instanceId === instanceId);
    }

    /** Projects in which an instance holds at least one connection. */
    projectsOf(instanceId: string): ProjectId[] {
        return [...this.projects.entries()]
            .filter(([, entries]) => [...entries.values()].some(e => e.instanceId === instanceId))
            .map(([projectId]) => projectId);
    }

    /** Forgets connections not seen for longer than `ttlMs`. Returns the projects that lost a connection. */
    expire(now: Date, ttlMs: number): ProjectId[] {
        const cutoff = now.getTime() - ttlMs;
        const affected: ProjectId[] = [];
        for (const [projectId, entries] of [...this.projects.entries()]) {
            let removed = false;
            for (const [key, entry] of entries) {
                if (entry.seenAt.getTime() < cutoff) {
                    entries.delete(key);
                    removed = true;
                }
            }
            if (entries.size === 0) this.projects.delete(projectId);
            if (removed) affected.push(projectId);
        }
        return affected;
    }

    /** One entry per user (the most recently seen connection wins), sorted by display name. */
    snapshot(projectId: ProjectId): PresenceEntry[] {
        const latest = new Map<UserId, PresenceConnection>();
        for (const entry of this.projects.get(projectId)?.values() ?? []) {
            const known = latest.get(entry.userId);
            if (known === undefined || entry.seenAt.getTime() >= known.seenAt.getTime()) latest.set(entry.userId, entry);
        }
        return [...latest.values()]
            .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.userId.localeCompare(b.userId))
            .map(e => ({ userId: e.userId, displayName: e.displayName, levelId: e.levelId, seenAt: e.seenAt.toISOString() }));
    }
}
