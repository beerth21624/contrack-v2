// ─── User: an account that signs in with e-mail + password, or with a phone + one-time code (phone-only users) ───
import type { UserId } from '../../../../shared/domain/ids';
import type { DisplayName } from '../value-objects/display-name.value-object';
import type { Email } from '../value-objects/email.value-object';
import { type Phone, isPhonePlaceholderEmail } from '../value-objects/phone.value-object';

export interface UserProps {
    id: UserId;
    /** Phone-only users have a placeholder ending in PHONE_EMAIL_DOMAIN. */
    email: Email;
    displayName: DisplayName;
    /** Self-describing hash produced by the PasswordHasher (never the password; unusable for phone-only users). */
    passwordHash: string;
    createdAt: Date;
    /** Verified E.164 phone (set by phone sign-in); null / absent for e-mail users. */
    phone?: Phone | null;
    phoneVerifiedAt?: Date | null;
}

interface StoredUserProps extends UserProps {
    phone: Phone | null;
    phoneVerifiedAt: Date | null;
}

const copyDate = (d: Date | null | undefined): Date | null => (d === null || d === undefined ? null : new Date(d.getTime()));

export class User {
    private constructor(private readonly props: StoredUserProps) {}

    static create(props: UserProps): User {
        if (props.passwordHash === '') throw new Error('User.create: passwordHash is empty');
        return new User(User.copy(props));
    }

    static rehydrate(props: UserProps): User {
        return new User(User.copy(props));
    }

    private static copy(props: UserProps): StoredUserProps {
        return {
            ...props,
            createdAt: new Date(props.createdAt.getTime()),
            phone: props.phone ?? null,
            phoneVerifiedAt: copyDate(props.phoneVerifiedAt),
        };
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

    get phone(): Phone | null {
        return this.props.phone;
    }

    get phoneVerifiedAt(): Date | null {
        return copyDate(this.props.phoneVerifiedAt);
    }

    /** Created by phone sign-in: has only a placeholder e-mail and can never sign in with a password. */
    get isPhoneOnly(): boolean {
        return isPhonePlaceholderEmail(this.props.email.value);
    }

    /** The same user with `phone` verified at `at`. */
    withVerifiedPhone(phone: Phone, at: Date): User {
        return new User({ ...this.props, phone, phoneVerifiedAt: new Date(at.getTime()) });
    }

    toProps(): UserProps {
        return User.copy(this.props);
    }
}
