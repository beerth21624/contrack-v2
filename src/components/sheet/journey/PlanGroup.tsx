'use client';

import type { ReactNode } from 'react';

/**
 * A titled group of fields inside an element card (like `JGroup`), with a layout for its content: `fields` for
 * number boxes (2–4 a row), `wide` for bar groups and choice buttons (1–2 a row).
 */
export function PlanGroup({ title, hint, layout = 'fields', children }: {
    title: string;
    /** Grey line next to the title, e.g. where on the plan these values are. */
    hint?: ReactNode;
    layout?: 'fields' | 'wide';
    children: ReactNode;
}) {
    const grid = layout === 'wide'
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4'
        : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3';
    return (
        <div className="mt-4 first:mt-0">
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[12px] font-semibold text-gray-500">{title}</span>
                {hint !== undefined && <span className="text-[11px] text-gray-400">{hint}</span>}
            </div>
            <div className={grid}>{children}</div>
        </div>
    );
}
