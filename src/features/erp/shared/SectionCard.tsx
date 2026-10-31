// ─── A white card of an ERP screen with an optional title row (title left, actions right) ───
import type { ReactNode } from 'react';

export function SectionCard({ title, extra, children, className, bodyClassName }: {
    title?: ReactNode;
    extra?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={`bg-white border border-gray-200 rounded-card p-5 max-md:p-4 shadow-card min-w-0 ${className ?? ''}`}>
            {(title !== undefined || extra !== undefined) && (
                <div className="flex flex-wrap items-center gap-2 mb-3 min-h-8">
                    <h2 className="text-section font-semibold text-gray-900 flex-1 min-w-0 m-0">{title}</h2>
                    {extra}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}
