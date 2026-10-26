import type { Metadata } from 'next';
import { CloudProviders } from '@/features/cloud/CloudProviders';
import { VendorShell } from '@/features/vendor/ui/VendorShell';

export const metadata: Metadata = {
  title: 'ConTrack ผู้รับเหมาช่วง',
  description: 'รับงาน เสนอราคา และติดตามสัญญาจ้างช่วง',
};

/** Crew (subcontractor) screens: their own light, phone-first layout — no contractor menu or project runtime. */
export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CloudProviders>
      <VendorShell>{children}</VendorShell>
    </CloudProviders>
  );
}
