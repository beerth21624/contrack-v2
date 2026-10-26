/** Pushes a LINE message from the LINE OA (Messaging API). Throws when LINE refused it. */
export abstract class LineSender {
    /** False when no channel token is configured: no LINE deliveries are queued. */
    abstract get enabled(): boolean;
    abstract push(lineUserId: string, text: string): Promise<void>;
}
