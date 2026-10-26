// ─── User: an account that signs in with e-mail + password ───
import type { UserId } from '../../../../shared/domain/ids';
import type { DisplayName } from '../value-objects/display-name.value-object';
import type { Email } from '../value-objects/email.value-object';

export interface UserProps {
    id: UserId;
    email: Email;
    displayName: DisplayName;
    /** Self-describing hash produced by the PasswordHasher (never the password). */
    passwordHash: string;
    createdAt: Date;
}

export class User {
    private constructor(private readonly props: UserProps) {}

    static create(props: UserProps): User {
        if (props.passwordHash === '') throw new Error('User.create: passwordHash is empty');
        return new User({ ...props, createdAt: new Date(props.createdAt.getTime()) });
    }

    static rehydrate(props: UserProps): User {
        return new User({ ...props, createdAt: new Date(props.createdAt.getTime()) });
    }

    get id(): UserId {
        return this.props.id;
    }

    get email(): Email {
        return this.props.email;
    }

    get displayName(): DisplayName {
        return this.props.displayName;
    }

    get passwordHash(): string {
        return this.props.passwordHash;
    }

    get createdAt(): Date {
        return new Date(this.props.createdAt.getTime());
    }
}
