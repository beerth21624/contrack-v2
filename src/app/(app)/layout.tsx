import { AppLayoutUI } from '@/components/AppLayoutUI';
import { CloudProviders } from '@/features/cloud/CloudProviders';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CloudProviders>
      <AppLayoutUI>{children}</AppLayoutUI>
    </CloudProviders>
  );
}
