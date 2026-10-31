import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicShell } from '@/features/erp/customer-links/PublicShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('customerLinks');
  return { title: t('pageTitle'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/** Public pages for customers (/c/[token]): no sign-in, no session, no app menu (docs/erp/01-architecture.md §3.2). */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
