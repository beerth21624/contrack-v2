import { it } from 'vitest';
import { loadV5Oracle } from '../../../test-utils/excel-oracle';

it('explore timing', async () => {
    const o = await loadV5Oracle('all');
    const time = (label: string, v: Record<string, number>) => {
        const t = Date.now();
        o.replaceInputs(v);
        console.log(label, Date.now() - t);
    };
    time('noop', {});
    time('Z18', { 'CashFLOW_Basic!Z18': 900000 });
    time('Y21', { 'CashFLOW_Basic!Y21': 0.5 });
    time('BF14', { 'S-Curve_Plan_Basic!BF14': 0.5 });
    time('G15 actual cost', { 'S-Curve_Plan_Basic!G15': 9000 });
    time('E16 one start', { 'S-Curve_Plan_Basic!E16': 46035 });
    time('T37 one duration', { 'Man-Day_Basic!T37': 12 });
    time('O37 crew', { 'Man-Day_Basic!O37': 2 });
    time('BOQ K38', { 'BOQ (Home)!K38': 150 });
    time('E14', { 'S-Curve_Plan_Basic!E14': 46035 });
    const t = Date.now();
    o.hf.batch(() => { o.hf.setCellContents({ sheet: o.hf.getSheetId('S-Curve_Plan_Basic') ?? 0, row: 15, col: 4 }, 46040); });
    console.log('raw hf E16', Date.now() - t);
}, 300_000);
