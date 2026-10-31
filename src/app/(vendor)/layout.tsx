import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CloudProviders } from '@/features/cloud/CloudProviders';
import { VendorShell } from '@/features/vendor/ui/VendorShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: t('vendorMetaTitle'), description: t('vendorMetaDescription') };
}

/** Crew (subcontractor) screens: their own light, phone-first layout — no contractor menu or project runtime. */
export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CloudProviders>
      <VendorShell>{children}</VendorShell>
    </CloudProviders>
  );
}
