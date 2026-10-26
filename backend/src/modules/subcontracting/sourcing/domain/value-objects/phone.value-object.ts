// ─── Thai phone number, normalised to E.164 (+66…) with the contract's rules ───
import { phoneSchema } from '@contrack/contract';
import { DomainError } from '../../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../../shared/domain/result';

export class Phone {
    private constructor(readonly value: string) {}

    static create(raw: string): Result<Phone, DomainError> {
        const parsed = phoneSchema.safeParse(raw);
        return parsed.success ? ok(new Phone(parsed.data)) : err(DomainError.validation('เบอร์โทรไม่ถูกต้อง', { phone: raw }));
    }

    static rehydrate(value: string): Phone {
        return new Phone(value);
    }

    /** Every digit but the last 4 replaced ("+66812345678" → "xxx-xxx-5678"). */
    masked(): string {
        return maskPhone(this.value);
    }
}

export function maskPhone(e164: string): string {
    const local = e164.startsWith('+66') ? `0${e164.slice(3)}` : e164.replace(/\D/g, '');
    if (local.length <= 4) return local;
    const head = local.slice(0, -4).replace(/\d/g, 'x');
    const tail = local.slice(-4);
    return local.length === 10 ? `${head.slice(0, 3)}-${head.slice(3)}-${tail}` : `${head}-${tail}`;
}
