// ─── Notification: one in-app message for one user (the bell) ───
import type { UserId } from '../../../../shared/domain/ids';
import type { NotificationId } from '../platform-ids';

export interface NotificationProps {
    id: NotificationId;
    userId: UserId;
    template: string;
    title: string;
    body: string;
    /** In-app path ('' when there is nothing to open). */
    href: string;
    payload: Record<string, string | number>;
    createdAt: Date;
    readAt: Date | null;
}

export class Notification {
    private constructor(private props: NotificationProps) {}

    static create(props: Omit<NotificationProps, 'readAt'>): Notification {
        return new Notification({ ...props, payload: { ...props.payload }, createdAt: new Date(props.createdAt.getTime()), readAt: null });
    }

    static rehydrate(props: NotificationProps): Notification {
        return new Notification({ ...props, payload: { ...props.payload } });
    }

    get id(): NotificationId {
        return this.props.id;
    }

    get userId(): UserId {
        return this.props.userId;
    }

    get template(): string {
        return this.props.template;
    }

    get title(): string {
        return this.props.title;
    }

    get body(): string {
        return this.props.body;
    }

    get href(): string {
        return this.props.href;
    }

    get createdAt(): Date {
        return new Date(this.props.createdAt.getTime());
    }

    get readAt(): Date | null {
        return this.props.readAt === null ? null : new Date(this.props.readAt.getTime());
    }

    get isRead(): boolean {
        return this.props.readAt !== null;
    }

    toProps(): NotificationProps {
        return { ...this.props, payload: { ...this.props.payload }, createdAt: this.createdAt, readAt: this.readAt };
    }
}
