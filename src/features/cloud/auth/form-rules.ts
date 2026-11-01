// ─── antd form rules built from the contract's zod schemas (same rules as the server; messages from messages/*/auth.json) ───
import type { FormRule } from 'antd';
import type { ZodTypeAny } from 'zod';
import {
    PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, displayNameSchema, emailSchema, passwordSchema, projectNameSchema,
    revisionLabelSchema, workspaceNameSchema,
} from '@/shared/contract';
import type thAuth from '@/i18n/messages/th/auth.json';

export function zodRule(schema: ZodTypeAny, message: string): FormRule {
    return {
        validator: (_rule, value: unknown) =>
            schema.safeParse(value ?? '').success ? Promise.resolve() : Promise.reject(new Error(message)),
    };
}

type RulesTranslator = (key: keyof typeof thAuth.rules, values?: Record<string, string>) => string;

/** The antd form rules in the language of `t` (= `useTranslations('auth.rules')`). */
export function buildRules(t: RulesTranslator) {
    return {
        email: [{ required: true, message: t('emailRequired') }, zodRule(emailSchema, t('emailInvalid'))],
        loginPassword: [{ required: true, message: t('passwordRequired') }],
        newPassword: [
            { required: true, message: t('passwordSet') },
            zodRule(passwordSchema, t('passwordLength', { min: String(PASSWORD_MIN_LENGTH), max: String(PASSWORD_MAX_LENGTH) })),
        ],
        displayName: [{ required: true, message: t('displayNameRequired') }, zodRule(displayNameSchema, t('displayNameMax'))],
        projectName: [{ required: true, message: t('projectNameRequired') }, zodRule(projectNameSchema, t('projectNameMax'))],
        workspaceName: [{ required: true, message: t('workspaceNameRequired') }, zodRule(workspaceNameSchema, t('workspaceNameMax'))],
        revisionLabel: [{ required: true, message: t('revisionRequired') }, zodRule(revisionLabelSchema, t('revisionMax'))],
    } satisfies Record<string, FormRule[]>;
}

/** A same-site path to go to after signing in (never another origin). */
export function safeNext(next: string | null | undefined, fallback = '/projects'): string {
    if (next?.startsWith('/') !== true || next.startsWith('//') || next.startsWith('/\\')) return fallback;
    return next;
}
