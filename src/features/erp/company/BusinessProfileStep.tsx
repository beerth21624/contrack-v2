'use client';

// ─── Business types of the company (several allowed) and the project type a new project starts with ───
import { Checkbox, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { BUSINESS_PROFILES, PROJECT_TYPES, type BusinessProfile, type ProjectType } from '@/shared/contract';
import { defaultProjectTypeFor } from '@/domain/erp/profiles';

export interface BusinessProfileValue {
    businessProfiles: BusinessProfile[];
    defaultProjectType: ProjectType | null;
}

export function BusinessProfileStep({ value, onChange, disabled = false }: {
    value: BusinessProfileValue;
    onChange: (next: BusinessProfileValue) => void;
    disabled?: boolean;
}) {
    const t = useTranslations('company');
    const tEnums = useTranslations('enums');
    const effective = value.defaultProjectType ?? defaultProjectTypeFor(value.businessProfiles);

    const toggle = (profile: BusinessProfile, on: boolean) => {
        const set = new Set(value.businessProfiles);
        if (on) set.add(profile); else set.delete(profile);
        onChange({ ...value, businessProfiles: BUSINESS_PROFILES.filter(p => set.has(p)) });
    };

    return (
        <div className="flex flex-col gap-4">
            <p className="m-0 text-gray-500">{t('profiles.hint')}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {BUSINESS_PROFILES.map(profile => {
                    const checked = value.businessProfiles.includes(profile);
                    return (
                        <label
                            key={profile}
                            className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`}
                        >
                            <Checkbox checked={checked} disabled={disabled} onChange={e => toggle(profile, e.target.checked)}>
                                <span className="font-medium">{tEnums(`businessProfile.${profile}`)}</span>
                            </Checkbox>
                            <span className="text-xs text-gray-500">{t(`profiles.${profile}`)}</span>
                        </label>
                    );
                })}
            </div>
            <div className="flex flex-col gap-1">
                <span className="font-medium">{t('profiles.defaultProjectType')}</span>
                <Select<ProjectType | 'auto'>
                    className="w-full md:w-80"
                    disabled={disabled}
                    value={value.defaultProjectType ?? 'auto'}
                    onChange={v => onChange({ ...value, defaultProjectType: v === 'auto' ? null : v })}
                    options={[
                        { value: 'auto', label: t('profiles.auto') },
                        ...PROJECT_TYPES.map(p => ({ value: p, label: tEnums(`projectType.${p}`) })),
                    ]}
                />
                <span className="text-xs text-gray-500">{t('profiles.effective', { type: tEnums(`projectType.${effective}`) })}</span>
            </div>
        </div>
    );
}
