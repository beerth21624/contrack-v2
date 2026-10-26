// ─── Socket.IO edge of realtime: handshake auth, project rooms, presence heartbeats ───
// Never trusts the client: joining checks projects.read (unknown project and other tenants look the same:
// not_found), heartbeats re-check access every ACCESS_RECHECK_MS, presence carries only the level id.
import {
    Ack, ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit,
    SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import {
    type Ack as AckReply, REALTIME_NAMESPACE, joinProjectSchema, leaveProjectSchema, presenceUpdateSchema, socketAuthSchema,
} from '@contrack/contract';
import { AccessTokenVerifier, Clock } from '../../../shared/application/ports';
import { type ProjectId, type UserId, parseId } from '../../../shared/domain/ids';
import { bearerToken } from '../../../shared/presentation/auth';
import { projectRoom } from '../domain/policies/room-naming.policy';
import { PresenceService, type PresenceViewer } from '../application/services/presence.service';
import { ProjectViewAccess } from '../application/services/project-view-access.service';
import type { RealtimeNamespace, RealtimeSocket } from './realtime-socket';
import { SocketIoBroadcaster } from './socket-io.broadcaster';

/** A heartbeat older than this since the last access check re-checks access. */
export const ACCESS_RECHECK_MS = 60_000;

type AckCallback = (reply: AckReply) => void;

const OK: AckReply = { ok: true };
const UNAUTHENTICATED: AckReply = { ok: false, code: 'unauthenticated' };
const NOT_FOUND: AckReply = { ok: false, code: 'not_found' };
const VALIDATION_FAILED: AckReply = { ok: false, code: 'validation_failed' };
const UNKNOWN_NAME = 'Unknown user';

function answer(ack: AckCallback | undefined, reply: AckReply): void {
    if (typeof ack === 'function') ack(reply);
}

function toProjectId(raw: string): ProjectId | undefined {
    const parsed = parseId<'ProjectId'>(raw, 'Project');
    return parsed.ok ? parsed.value : undefined;
}

/** Handshake token: `io(url, { auth: { token } })`, else an `Authorization: Bearer` header. */
function tokenOf(socket: RealtimeSocket): string | undefined {
    const auth = socketAuthSchema.safeParse(socket.handshake.auth);
    if (auth.success) return auth.data.token;
    return bearerToken(socket.handshake.headers.authorization);
}

// CORS (CORS_ORIGINS, credentials) is set per app by the Socket.IO adapter in bootstrap.ts.
@WebSocketGateway({ namespace: REALTIME_NAMESPACE })
export class RealtimeGateway implements OnGatewayInit<RealtimeNamespace>, OnGatewayConnection<RealtimeSocket>,
    OnGatewayDisconnect<RealtimeSocket> {
    constructor(
        private readonly verifier: AccessTokenVerifier,
        private readonly access: ProjectViewAccess,
        private readonly presence: PresenceService,
        private readonly broadcaster: SocketIoBroadcaster,
        private readonly clock: Clock,
    ) {}

    afterInit(namespace: RealtimeNamespace): void {
        this.broadcaster.attach(namespace);
        // Authenticate before the connection is accepted, so no event can arrive from an unknown socket.
        namespace.use((socket, next) => {
            this.authenticate(socket).then(
                authenticated => { next(authenticated ? undefined : new Error('unauthenticated')); },
                () => { next(new Error('unauthenticated')); },
            );
        });
    }

    /** Safety net behind the middleware: a socket without a verified user is disconnected at once. */
    async handleConnection(socket: RealtimeSocket): Promise<void> {
        if (socket.data.userId !== undefined) return;
        if (!(await this.authenticate(socket))) socket.disconnect(true);
    }

    async handleDisconnect(socket: RealtimeSocket): Promise<void> {
        await this.presence.disconnect(socket.id);
    }

    @SubscribeMessage('project.join')
    async onJoin(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() body: unknown, @Ack() ack?: AckCallback): Promise<void> {
        const userId = socket.data.userId;
        if (userId === undefined) {
            answer(ack, UNAUTHENTICATED);
            return;
        }
        const parsed = joinProjectSchema.safeParse(body);
        if (!parsed.success) {
            answer(ack, VALIDATION_FAILED);
            return;
        }
        const projectId = toProjectId(parsed.data.projectId);
        const viewer = projectId === undefined ? undefined : await this.access.authorize(userId, projectId);
        if (projectId === undefined || !viewer?.ok) {
            answer(ack, NOT_FOUND);
            return;
        }
        if (!socket.connected) return; // closed while we checked
        await socket.join(projectRoom(projectId));
        socket.data.displayName = viewer.value.displayName;
        this.checkedAtOf(socket).set(projectId, this.clock.now().getTime());
        answer(ack, OK);
        // After the ack, so the client is listening for the state that includes itself.
        await this.presence.join(this.viewerOf(socket, userId), projectId);
    }

    @SubscribeMessage('project.leave')
    async onLeave(@ConnectedSocket() socket: RealtimeSocket, @MessageBody() body: unknown, @Ack() ack?: AckCallback): Promise<void> {
        const joined = this.joinedProject(socket, leaveProjectSchema.safeParse(body));
        if (!joined.ok) {
            answer(ack, joined.reply);
            return;
        }
        await this.drop(socket, joined.projectId);
        answer(ack, OK);
    }

    /** Heartbeat that also carries the level the user is on. */
    @SubscribeMessage('presence.update')
    async onPresenceUpdate(
        @ConnectedSocket() socket: RealtimeSocket, @MessageBody() body: unknown, @Ack() ack?: AckCallback,
    ): Promise<void> {
        const parsed = presenceUpdateSchema.safeParse(body);
        const joined = this.joinedProject(socket, parsed);
        if (!joined.ok || !parsed.success) {
            answer(ack, joined.ok ? VALIDATION_FAILED : joined.reply);
            return;
        }
        if (!(await this.stillAllowed(socket, joined.userId, joined.projectId))) {
            await this.drop(socket, joined.projectId);
            answer(ack, NOT_FOUND);
            return;
        }
        if (!socket.connected) return;
        await this.presence.update(this.viewerOf(socket, joined.userId), joined.projectId, parsed.data.levelId);
        answer(ack, OK);
    }

    /** Verifies the handshake token and remembers the user on the socket. */
    private async authenticate(socket: RealtimeSocket): Promise<boolean> {
        const token = tokenOf(socket);
        if (token === undefined) return false;
        const user = await this.verifier.verify(token);
        if (user === undefined) return false;
        socket.data.userId = user.userId;
        return true;
    }

    /** Common checks of leave / heartbeat: signed in, valid payload, socket already in the project room. */
    private joinedProject(
        socket: RealtimeSocket,
        parsed: { success: true; data: { projectId: string } } | { success: false },
    ): { ok: true; userId: UserId; projectId: ProjectId } | { ok: false; reply: AckReply } {
        const userId = socket.data.userId;
        if (userId === undefined) return { ok: false, reply: UNAUTHENTICATED };
        if (!parsed.success) return { ok: false, reply: VALIDATION_FAILED };
        const projectId = toProjectId(parsed.data.projectId);
        if (projectId === undefined || !socket.rooms.has(projectRoom(projectId))) return { ok: false, reply: NOT_FOUND };
        return { ok: true, userId, projectId };
    }

    /** Re-checks access when the last check is older than ACCESS_RECHECK_MS. */
    private async stillAllowed(socket: RealtimeSocket, userId: UserId, projectId: ProjectId): Promise<boolean> {
        const checkedAt = this.checkedAtOf(socket);
        const now = this.clock.now().getTime();
        if (now - (checkedAt.get(projectId) ?? 0) < ACCESS_RECHECK_MS) return true;
        const allowed = await this.access.canView(userId, projectId);
        if (allowed) checkedAt.set(projectId, now);
        return allowed;
    }

    /** Takes the socket out of the project room and out of its presence. */
    private async drop(socket: RealtimeSocket, projectId: ProjectId): Promise<void> {
        await socket.leave(projectRoom(projectId));
        this.checkedAtOf(socket).delete(projectId);
        await this.presence.leave(socket.id, projectId);
    }

    private checkedAtOf(socket: RealtimeSocket): Map<ProjectId, number> {
        socket.data.checkedAt ??= new Map();
        return socket.data.checkedAt;
    }

    private viewerOf(socket: RealtimeSocket, userId: UserId): PresenceViewer {
        return { connectionId: socket.id, userId, displayName: socket.data.displayName ?? UNKNOWN_NAME };
    }
}
