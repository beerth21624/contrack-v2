// ─── Identity of this server instance on the realtime bus (random per process) ───

export class RealtimeInstance {
    constructor(readonly id: string) {}
}
