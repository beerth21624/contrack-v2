// ─── Dev-mode trace labels of the electrical cable step (docs/dev-mode/README.md §5) ───
// Names follow the cable page's field names. Circuits and their lengths come from the conduit step.
// Never mention the spreadsheet here (no sheet names, column letters or row numbers).
import type { CalcTraceLabels } from '../../trace/types';

export const ELECTRICAL_CABLE_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (per circuit; {0} = the circuit's id)
            'wiring.*.mainSize': 'วงจร {0} · ขนาดสายเมนวงจร',
            'wiring.*.deviceSize': 'วงจร {0} · ขนาดสายเข้าโคม / จุด',
            'wiring.*.conductors': 'วงจร {0} · จำนวนสาย',
            // intermediate values used in formulas
            mainLength: 'ความยาวสาย วงจรย่อย (สายเมน) จากขั้นตอนท่อร้อยสายไฟ',
            deviceLength: 'ความยาวสาย เข้าอุปกรณ์ จากขั้นตอนท่อร้อยสายไฟ',
            conductors: 'จำนวนสาย',
            unassignedMain: 'ความยาวสายเมน ที่ยังไม่ได้เลือกขนาดสาย',
            unassignedDevice: 'ความยาวสายเข้าอุปกรณ์ ที่ยังไม่ได้เลือกขนาดสาย',
            wireLength: 'ความยาวสาย (ต่อวงจร)',
            // outputs (and the same names inside formulas)
            unassigned: 'สายที่ยังไม่ถูกคิดเงิน (ยังไม่ได้เลือกขนาดสายหรือจำนวนสาย)',
            'circuit.count': 'จำนวนวงจร',
            'size|THW 1.5': 'สายไฟ THW 1.5 ตร.มม. รวม',
            'size|THW 2.5': 'สายไฟ THW 2.5 ตร.มม. รวม',
            'size|THW 4': 'สายไฟ THW 4 ตร.มม. รวม',
            'size|THW 6': 'สายไฟ THW 6 ตร.มม. รวม',
            R193: 'สายไฟ THW 1.5 ตร.มม. ที่ส่งเข้า BOQ',
            R194: 'สายไฟ THW 2.5 ตร.มม. ที่ส่งเข้า BOQ',
            R195: 'สายไฟ THW 4 ตร.มม. ที่ส่งเข้า BOQ',
        },
        units: {
            mainLength: 'ม.', deviceLength: 'ม.', conductors: 'เส้น', unassignedMain: 'ม.', unassignedDevice: 'ม.', wireLength: 'ม.',
            unassigned: 'ม.', 'circuit.count': 'วงจร',
            'size|THW 1.5': 'ม.', 'size|THW 2.5': 'ม.', 'size|THW 4': 'ม.', 'size|THW 6': 'ม.',
            R193: 'ม.', R194: 'ม.', R195: 'ม.',
        },
        steps: {
            wireBoth: { label: 'สาย {size} ความยาว', formula: '{mainLength} × {conductors} + {deviceLength} × {conductors}', unit: 'ม.' },
            wireMain: { label: 'สาย {size} ความยาว (สายเมนวงจร)', formula: '{mainLength} × {conductors}', unit: 'ม.' },
            wireDevice: { label: 'สาย {size} ความยาว (สายเข้าโคม / จุด)', formula: '{deviceLength} × {conductors}', unit: 'ม.' },
            unassignedAll: { label: 'สายที่ยังไม่ถูกคิดเงิน (ยังไม่ได้เลือกจำนวนสาย)', formula: '{mainLength} + {deviceLength}', unit: 'ม.' },
            unassignedPart: { label: 'สายที่ยังไม่ถูกคิดเงิน (ยังไม่ได้เลือกขนาดสาย)', formula: '{unassignedMain} + {unassignedDevice}', unit: 'ม.' },
            circuitCount: { label: 'จำนวนวงจร (ทุกวงจรของขั้นตอนท่อร้อยสายไฟ)', formula: 'นับวงจร', unit: 'วงจร' },
            totalUnassigned: { label: 'สายที่ยังไม่ถูกคิดเงิน รวม', formula: 'Σ {unassigned}', unit: 'ม.' },
            totalSize: { label: 'สายไฟ {size} ความยาว รวม', formula: 'Σ {wireLength}', unit: 'ม.' },
        },
    },
    en: {
        terms: {
            'wiring.*.mainSize': 'Circuit {0} · main cable size',
            'wiring.*.deviceSize': 'Circuit {0} · cable size to luminaire / point',
            'wiring.*.conductors': 'Circuit {0} · number of wires',
            mainLength: 'Branch circuit cable length (main) from the conduit step',
            deviceLength: 'Cable length to equipment from the conduit step',
            conductors: 'Number of wires',
            unassignedMain: 'Main cable length with no cable size chosen',
            unassignedDevice: 'Cable length to equipment with no cable size chosen',
            wireLength: 'Cable length (per circuit)',
            unassigned: 'Cable not priced (no cable size or number of wires chosen)',
            'circuit.count': 'Number of circuits',
            'size|THW 1.5': 'THW 1.5 mm² cable, total',
            'size|THW 2.5': 'THW 2.5 mm² cable, total',
            'size|THW 4': 'THW 4 mm² cable, total',
            'size|THW 6': 'THW 6 mm² cable, total',
            R193: 'THW 1.5 mm² cable sent to the BOQ',
            R194: 'THW 2.5 mm² cable sent to the BOQ',
            R195: 'THW 4 mm² cable sent to the BOQ',
        },
        units: {
            mainLength: 'm', deviceLength: 'm', conductors: 'wires', unassignedMain: 'm', unassignedDevice: 'm', wireLength: 'm',
            unassigned: 'm', 'circuit.count': 'circuits',
            'size|THW 1.5': 'm', 'size|THW 2.5': 'm', 'size|THW 4': 'm', 'size|THW 6': 'm',
            R193: 'm', R194: 'm', R195: 'm',
        },
        steps: {
            wireBoth: { label: 'Cable {size} length', formula: '{mainLength} × {conductors} + {deviceLength} × {conductors}', unit: 'm' },
            wireMain: { label: 'Cable {size} length (main cable)', formula: '{mainLength} × {conductors}', unit: 'm' },
            wireDevice: { label: 'Cable {size} length (to luminaire / point)', formula: '{deviceLength} × {conductors}', unit: 'm' },
            unassignedAll: { label: 'Cable not priced (number of wires not chosen)', formula: '{mainLength} + {deviceLength}', unit: 'm' },
            unassignedPart: { label: 'Cable not priced (cable size not chosen)', formula: '{unassignedMain} + {unassignedDevice}', unit: 'm' },
            circuitCount: { label: 'Number of circuits (every circuit of the conduit step)', formula: 'count of circuits', unit: 'circuits' },
            totalUnassigned: { label: 'Cable not priced, total', formula: 'Σ {unassigned}', unit: 'm' },
            totalSize: { label: 'Cable {size} length, total', formula: 'Σ {wireLength}', unit: 'm' },
        },
    },
};
