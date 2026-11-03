/**
 * planSamples.js — sample plans for the DEV-only 🧪 fill button. Each form's
 * sample must fit inside that form's own plan box (see planLayouts.js).
 * Dead-code eliminated in production together with devFillState.js.
 */

// 360S014EC Pole Record — box is 510.5 × 368 pt, no north arrow.
export const POLE_SAMPLE_PLAN = {
  v: 1, north: 0, northSet: false,
  els: [
    { id: 's1', t: 'pt', kind: 'circle', x: 110, y: 180, w: 14, color: 'blue',  labelPos: 'top',    label: 'Old pole' },
    { id: 's2', t: 'pt', kind: 'circle', x: 330, y: 180, w: 14, color: 'blue',  labelPos: 'top',    label: 'New pole' },
    { id: 's3', t: 'pt', kind: 'dot',    x: 225, y: 230,       color: 'red',   labelPos: 'bottom', label: 'LV break' },
    { id: 's4', t: 'pt', kind: 'rect',   x: 430, y: 120, w: 60, h: 40, color: 'green', labelPos: 'center', label: 'Tx' },
    { id: 's5', t: 'pt', kind: 'text',   x: 60,  y: 60,        color: 'blue',  label: 'Road' },
    { id: 'l1', t: 'ln', pattern: 'solid',  color: 'black', weight: 'normal', x1: 110, y1: 180, x2: 330, y2: 180, label: 'Circuit 1' },
    { id: 'l2', t: 'ln', pattern: 'dashed', color: 'red',   weight: 'thick',  x1: 225, y1: 230, x2: 225, y2: 300, label: 'LV' },
    { id: 'l3', t: 'ln', pattern: 'solid',  color: 'black', weight: 'heavy',  x1: 20,  y1: 330, x2: 490, y2: 330, label: 'Kerb' },
    { id: 'd1', t: 'dim', color: 'black', orient: 'horizontal', x1: 110, y1: 180, x2: 330, y2: 180, offset: 22, label: '21.0m' },
    { id: 'd2', t: 'dim', color: 'green', orient: 'aligned',    x1: 330, y1: 180, x2: 430, y2: 120, offset: -10, label: '12.4m' },
  ],
}
