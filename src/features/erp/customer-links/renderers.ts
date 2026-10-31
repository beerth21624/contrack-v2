// ─── Registry subjectType → component that renders the document's payload on the public page ───
// Owner modules register their renderer (WP-25 quotation, WP-32 invoice, WP-34 variation) from a module imported by
// src/app/(public)/c/[token]/page.tsx. A subject without one shows only the header and the answer form.
import type { ComponentType } from 'react';
import type { CustomerLinkSubject, CustomerLinkViewDto } from '@/shared/contract';
import type { CustomerLinkTranslator } from './translator';

export interface CustomerLinkRendererProps<S extends CustomerLinkSubject = CustomerLinkSubject> {
    view: Extract<CustomerLinkViewDto, { subjectType: S }>;
    /** Text in the document's language (namespace customerLinks); the renderer may use its own documentTranslator too. */
    t: CustomerLinkTranslator;
}

type AnyRenderer = ComponentType<CustomerLinkRendererProps>;

const renderers = new Map<CustomerLinkSubject, AnyRenderer>();

export function registerCustomerLinkRenderer<S extends CustomerLinkSubject>(subjectType: S, component: ComponentType<CustomerLinkRendererProps<S>>): void {
    renderers.set(subjectType, component as unknown as AnyRenderer);
}

export function customerLinkRenderer(subjectType: CustomerLinkSubject): AnyRenderer | undefined {
    return renderers.get(subjectType);
}
