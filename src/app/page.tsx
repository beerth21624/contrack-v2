import { CloudProviders } from '@/features/cloud/CloudProviders';
import { HomeRedirect } from '@/features/erp/hub/HomeRedirect';

/** `/`: /journey (release 1), /hub or /home when those modules are active (docs/erp/01-architecture.md §3.2). */
export default function Home() {
    return (
        <CloudProviders>
            <HomeRedirect />
        </CloudProviders>
    );
}
