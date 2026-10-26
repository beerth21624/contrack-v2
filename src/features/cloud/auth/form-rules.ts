// ─── antd form rules built from the contract's zod schemas (same rules as the server, Thai messages) ───
import type { FormRule } from 'antd';
import type { ZodTypeAny } from 'zod';
import {
    PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, displayNameSchema, emailSchema, passwordSchema, projectNameSchema,
    revisionLabelSchema, workspaceNameSchema,
} from '@/shared/contract';

export function zodRule(schema: ZodTypeAny, message: string): FormRule {
    return {
        validator: (_rule, value: unknown) =>
            schema.safeParse(value ?? '').success ? Promise.resolve() : Promise.reject(new Error(message)),
    };
}

export const RULES = {
    email: [{ required: true, message: 'กรอกอีเมล' }, zodRule(emailSchema, 'รูปแบบอีเมลไม่ถูกต้อง เช่น somchai@gmail.com')],
    loginPassword: [{ required: true, message: 'กรอกรหัสผ่าน' }],
    newPassword: [
        { required: true, message: 'ตั้งรหัสผ่าน' },
        zodRule(passwordSchema, `รหัสผ่านต้องยาว ${String(PASSWORD_MIN_LENGTH)}–${String(PASSWORD_MAX_LENGTH)} ตัวอักษร`),
    ],
    displayName: [{ required: true, message: 'กรอกชื่อที่ให้ทีมเห็น' }, zodRule(displayNameSchema, 'ชื่อยาวได้ไม่เกิน 80 ตัวอักษร')],
    projectName: [{ required: true, message: 'ตั้งชื่อโครงการ' }, zodRule(projectNameSchema, 'ชื่อโครงการยาวได้ไม่เกิน 160 ตัวอักษร')],
    workspaceName: [{ required: true, message: 'ตั้งชื่อบริษัท/ทีม' }, zodRule(workspaceNameSchema, 'ชื่อยาวได้ไม่เกิน 120 ตัวอักษร')],
    revisionLabel: [{ required: true, message: 'ตั้งชื่อฉบับแก้ไข เช่น Rev.01' }, zodRule(revisionLabelSchema, 'ชื่อฉบับแก้ไข ยาวได้ไม่เกิน 40 ตัวอักษร')],
} satisfies Record<string, FormRule[]>;

/** A same-site path to go to after signing in (never another origin). */
export function safeNext(next: string | null | undefined, fallback = '/projects'): string {
    if (next?.startsWith('/') !== true || next.startsWith('//') || next.startsWith('/\\')) return fallback;
    return next;
}
