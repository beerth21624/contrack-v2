import { CloudProviders } from '@/features/cloud/CloudProviders';
import { PrintShell } from '@/features/erp/shared/PrintShell';

/** Printed ERP documents (/print/<doc>/[id]): query client + session, grey backdrop, no app menu (docs/erp/01-architecture.md §15). */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
    return (
        <CloudProviders>
            <PrintShell>{children}</PrintShell>
        </CloudProviders>
    );
}
