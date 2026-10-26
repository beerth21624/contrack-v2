// ─── Contract requests → package fields / selection (dates parsed, per-line supply only for 'per_line') ───
import type { CreatePackageRequest, MaterialBy, SupplyMode, UpdatePackageRequest } from '@contrack/contract';
import type { PackageFields, PackagePatch, PackageSelection } from '../../domain/entities/work-package.entity';

export function fieldsOf(body: CreatePackageRequest): PackageFields {
    return {
        title: body.title,
        trade: body.trade,
        supplyMode: body.supplyMode,
        pricingMode: body.pricingMode,
        sourcingMode: body.sourcingMode,
        terms: body.terms,
        schedule: body.schedule,
        installments: body.installments,
        location: body.location,
        hideOwnerIdentity: body.hideOwnerIdentity,
        bidDeadline: new Date(body.bidDeadline),
        priceValidUntil: body.priceValidUntil,
        description: body.description,
    };
}

export function patchOf(body: UpdatePackageRequest): PackagePatch {
    const { lineKeys: _k, customLines: _c, materialByLine: _m, bidDeadline, ...rest } = body;
    return { ...rest, ...(bidDeadline === undefined ? {} : { bidDeadline: new Date(bidDeadline) }) };
}

export function selectionOf(
    lineKeys: readonly string[], customLines: PackageSelection['customLines'], materialByLine: Readonly<Record<string, MaterialBy>>,
    supplyMode: SupplyMode,
): PackageSelection {
    const keys = [...new Set(lineKeys)];
    const perLine = supplyMode === 'per_line'
        ? Object.fromEntries(Object.entries(materialByLine).filter(([k]) => keys.includes(k)))
        : {};
    return { lineKeys: keys, customLines: customLines.map(c => ({ ...c })), materialByLine: perLine };
}

/** The request changes what the snapshot is made of. */
export function touchesLines(body: UpdatePackageRequest): boolean {
    return body.lineKeys !== undefined || body.customLines !== undefined || body.materialByLine !== undefined || body.supplyMode !== undefined;
}
