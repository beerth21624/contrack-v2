'use client';

import type { ReactNode } from 'react';

/** Small grey hint under a field label. */
export function Hint({ children }: { children: ReactNode }) {
    return <div className="text-[11px] leading-tight text-gray-500">{children}</div>;
}

/** Label + hint cell content of a journey table. */
export function LabelWithHint({ label, hint }: { label: ReactNode; hint?: ReactNode }) {
    return (
        <div className="px-1 py-0.5">
            <div className="text-[13px] text-gray-800">{label}</div>
            {hint !== undefined && <Hint>{hint}</Hint>}
        </div>
    );
}
