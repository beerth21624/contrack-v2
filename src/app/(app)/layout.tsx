import { AppLayoutUI } from '@/components/AppLayoutUI';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayoutUI>{children}</AppLayoutUI>
  );
}
