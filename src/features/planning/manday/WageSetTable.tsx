'use client';

// ─── The "อัตราค่าแรง" tab of Man-Day: every wage set as one table row ───
// ชุด | ชื่อชุด | ช่าง | คนงาน | ใช้ใน | actions, a toolbar above (add a set, pick from the company library) and the
// งานเหมา share below. Stays one compact table with 2 sets or 20; on a phone it scrolls sideways inside its card.
import { Button, Popconfirm, Tag } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { NumberCell, SHEET_COLORS, TextCell } from '@/components/sheet/NumberCell';
import { InputNumberField } from '@/components/sheet/SheetFields';
import {
    WAGE_SET_LIMITS, addWageSet, isBuiltInWageSet, removeWageSet, updateWageSet, wageSetUsage,
    type ManDayInput, type WageSet,
} from '@/domain/planning';
import { PickCompanyWageSet, SaveWageSetToCompany, type CompanyLibrary } from './CompanyWageSets';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-1 py-0.5 text-[13px] align-middle';

export function WageSetTable({ md, save, library, readOnly }: {
    md: ManDayInput; save: (next: ManDayInput) => void;
    /** The company library of a cloud project; undefined for a guest project. */
    library: CompanyLibrary | undefined;
    readOnly: boolean;
}) {
    const set = (id: WageSet['id'], patch: Partial<Omit<WageSet, 'id'>>) => save(updateWageSet(md, id, patch));
    const addSet = (init: Omit<WageSet, 'id'>) => {
        const { input, id } = addWageSet(md, init);
        save(input);
        return id;
    };
    const canAdd = md.wageSets.length < WAGE_SET_LIMITS.maxSets;

    return (
        <div className="flex flex-col gap-3">
            {canAdd && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="small" icon={<PlusOutlined />} onClick={() => save(addWageSet(md).input)}>เพิ่มชุดค่าแรง</Button>
                    {library !== undefined && !readOnly && <PickCompanyWageSet library={library} sets={md.wageSets} onAdd={addSet} />}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[800px]">
                    <thead>
                        <tr>
                            <th className={th} style={{ width: 112 }}>ชุด</th>
                            <th className={th} style={{ minWidth: 220 }}>ชื่อชุด</th>
                            <th className={th} style={{ width: 112 }}>ช่าง<br /><span className="font-normal">(บาท/วัน)</span></th>
                            <th className={th} style={{ width: 112 }}>คนงาน<br /><span className="font-normal">(บาท/วัน)</span></th>
                            <th className={th} style={{ width: 80 }}>ใช้ใน</th>
                            <th className={th} style={{ width: 176 }} aria-label="จัดการ" />
                        </tr>
                    </thead>
                    <tbody>
                        {md.wageSets.map(s => {
                            const builtIn = isBuiltInWageSet(s.id);
                            const usedBy = wageSetUsage(md, s.id).length;
                            return (
                                <tr key={s.id}>
                                    <td className={`${td} bg-white px-2`}>
                                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                                            <span className="font-medium text-gray-800">{s.id}</span>
                                            {builtIn && <Tag className="!m-0 !text-[11px] !leading-[18px]">ค่าตั้งต้นของระบบ</Tag>}
                                        </span>
                                    </td>
                                    <td className={td} style={{ background: SHEET_COLORS.input }}>
                                        <TextCell value={s.name} placeholder="ตั้งชื่อชุด" ariaLabel={`ชื่อชุดค่าแรง ${s.id}`}
                                            onCommit={v => set(s.id, { name: (v ?? '').slice(0, WAGE_SET_LIMITS.maxNameLength) })} />
                                    </td>
                                    <td className={td}>
                                        <NumberCell value={s.skilled} digits={0} ariaLabel={`ค่าแรงช่าง ชุด ${s.id}`}
                                            onCommit={v => set(s.id, { skilled: v ?? 0 })} />
                                    </td>
                                    <td className={td}>
                                        <NumberCell value={s.labourer} digits={0} ariaLabel={`ค่าแรงคนงาน ชุด ${s.id}`}
                                            onCommit={v => set(s.id, { labourer: v ?? 0 })} />
                                    </td>
                                    <td className={`${td} bg-white px-2 text-right tabular-nums ${usedBy === 0 ? 'text-gray-400' : 'text-gray-700'}`}>
                                        {usedBy === 0 ? '–' : `${String(usedBy)} งาน`}
                                    </td>
                                    <td className={`${td} bg-white px-2`}>
                                        {!builtIn && (
                                            <span className="flex items-center justify-end gap-1">
                                                {library !== undefined && <SaveWageSetToCompany library={library} set={s} />}
                                                <Popconfirm title={`ลบชุดค่าแรง ${s.id}?`} okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
                                                    description={usedBy > 0 ? `มี ${String(usedBy)} งานใช้ชุดนี้ จะเปลี่ยนไปใช้ชุด A` : undefined}
                                                    onConfirm={() => save(removeWageSet(md, s.id))}>
                                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`ลบชุดค่าแรง ${s.id}`} />
                                                </Popconfirm>
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-gray-100 pt-2">
                <div className="max-w-[440px]">
                    <InputNumberField label="งานเหมา: ค่าแรง % ของยอดรวม" percent value={md.subcontractLabourShare}
                        onChange={v => save({ ...md, subcontractLabourShare: v })} />
                </div>
                <div className="text-[12px] text-gray-500">
                    งานที่ BOQ ไม่แยกค่าแรง (งานเหมา) ใช้ % นี้ของยอดรวมเป็นค่าแรง เพื่อคำนวณวัน
                </div>
            </div>
        </div>
    );
}
