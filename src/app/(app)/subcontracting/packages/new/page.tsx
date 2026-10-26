'use client';

import { Suspense } from 'react';
import { Spin } from 'antd';
import { PackageWizardPage } from '@/features/subcontracting/buyer/wizard/WizardPage';

export default function NewPackageRoute() {
    return (
        <Suspense fallback={<div className="flex justify-center p-20"><Spin size="large" /></div>}>
            <PackageWizardPage />
        </Suspense>
    );
}
