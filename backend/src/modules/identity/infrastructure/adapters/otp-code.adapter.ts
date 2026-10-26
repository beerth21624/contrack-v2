// ─── One-time codes: random 6 digits (crypto.randomInt) and HMAC-SHA256 hashes with a server key ───
import { createHmac, randomInt } from 'node:crypto';
import { OTP_LENGTH } from '@contrack/contract';
import { safeEqual } from '../../../../shared/infrastructure/crypto';
import { OtpGenerator, OtpHasher } from '../../application/ports/otp-code.port';

export class RandomOtpGenerator extends OtpGenerator {
    newCode(): string {
        return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    }
}

export class HmacOtpHasher extends OtpHasher {
    constructor(private readonly key: string) {
        super();
        if (key.length < 16) throw new Error('HmacOtpHasher: key is too short');
    }

    hash(phone: string, code: string): string {
        return createHmac('sha256', this.key).update(`${phone}:${code}`, 'utf8').digest('hex');
    }

    matches(hash: string, phone: string, code: string): boolean {
        return safeEqual(this.hash(phone, code), hash);
    }
}
