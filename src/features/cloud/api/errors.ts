// ─── Errors of the backend API, mapped to one shape ───
import { errorResponseSchema, type ErrorCode } from '@/shared/contract';

/** Codes the client adds on top of the server's: no answer at all, or an answer that does not match the contract. */
export type ClientErrorCode = 'network_error' | 'invalid_response';
export type ApiErrorCode = ErrorCode | ClientErrorCode;

export class ApiError extends Error {
    override readonly name = 'ApiError';

    constructor(
        /** HTTP status; 0 when the request never got an answer (offline, server down, CORS). */
        readonly status: number,
        readonly code: ApiErrorCode,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
    }

    /** No answer from the server: try again later. */
    get isNetwork(): boolean {
        return this.code === 'network_error';
    }
}

export function isApiError(e: unknown): e is ApiError {
    return e instanceof ApiError;
}

/** Errors worth retrying later (no connection, server busy or broken, rate limit). */
export function isRetryable(e: unknown): boolean {
    if (!isApiError(e)) return true;
    return e.status === 0 || e.status >= 500 || e.status === 429 || e.status === 401;
}

/** Builds an ApiError from a non-2xx response body (an ErrorResponse, or anything else). */
export function errorFromBody(status: number, body: unknown, fallback: string): ApiError {
    const parsed = errorResponseSchema.safeParse(body);
    if (parsed.success) return new ApiError(status, parsed.data.code, parsed.data.message, parsed.data.details);
    return new ApiError(status, status >= 500 ? 'internal' : 'validation_failed', fallback);
}

/** Plain Thai message for people, by error code. */
export function thaiErrorMessage(e: unknown): string {
    if (!isApiError(e)) return 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
    switch (e.code) {
        case 'network_error': return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
        case 'invalid_response': return 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง';
        case 'validation_failed': return 'ข้อมูลไม่ถูกต้อง ตรวจสอบแล้วลองใหม่';
        case 'unauthenticated':
        case 'invalid_token': return 'กรุณาเข้าสู่ระบบอีกครั้ง';
        case 'invalid_credentials': return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        case 'email_taken': return 'อีเมลนี้มีบัญชีอยู่แล้ว ลองเข้าสู่ระบบแทน';
        case 'forbidden': return 'คุณไม่มีสิทธิ์ทำรายการนี้';
        case 'not_found': return 'ไม่พบข้อมูลนี้ (อาจถูกลบหรือคุณไม่ได้เป็นสมาชิก)';
        case 'conflict': return 'ทำรายการนี้ไม่ได้ เพราะข้อมูลขัดกัน (เช่น ชื่อซ้ำ หรือโครงการถูกเก็บถาวร)';
        case 'version_conflict': return 'มีคนอื่นแก้ข้อมูลนี้ก่อนหน้า';
        case 'invitation_invalid': return 'ลิงก์เชิญนี้ใช้ไม่ได้แล้ว (หมดอายุ ถูกยกเลิก หรือใช้ไปแล้ว)';
        case 'last_owner': return 'ต้องมีเจ้าของอย่างน้อย 1 คนเสมอ';
        case 'personal_workspace': return 'พื้นที่ส่วนตัวทำรายการนี้ไม่ได้ สร้างพื้นที่ของบริษัทก่อน';
        case 'unprocessable': return 'ข้อมูลนี้ใช้คำนวณไม่ได้ ระบบจึงไม่บันทึก';
        case 'rate_limited': return 'ทำรายการถี่เกินไป รอสักครู่แล้วลองใหม่';
        case 'internal': return 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง';
        case 'ai_unavailable': return 'ผู้ช่วย AI ใช้งานไม่ได้ในขณะนี้ ลองใหม่อีกครั้งภายหลัง';
        case 'ai_quota': return 'เครดิตผู้ช่วย AI หมด ติดต่อผู้ดูแลระบบ';
    }
}
