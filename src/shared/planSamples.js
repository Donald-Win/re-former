/**
 * planSamples.js — sample data for the DEV-only 🧪 fill button.
 *
 * Every export is null outside development. The bundler drops the object
 * literals in production builds, so none of this sample data ships to field
 * devices. Each sample must fit inside its form's plan box (planLayouts.js).
 */
import { WAY_COUNT, POSITION_COUNT, rowUsed } from './distPanelRows'

const DEV = import.meta.env.DEV

// 360S014EC Pole Record — box is 510.5 × 368 pt, no north arrow.
export const POLE_SAMPLE_PLAN = DEV ? {
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
} : null

// 360S014EB Electrical Distribution Record — box is 522.5 × 238 pt.
export const EB_SAMPLE_PLAN = DEV ? {
  v: 1, north: 40, northSet: true,
  els: [
    { id: 's1', t: 'pt', kind: 'circle', x: 220, y: 120, w: 14, color: 'blue', labelPos: 'top', label: 'Pole 4521' },
    { id: 's2', t: 'pt', kind: 'rect', x: 330, y: 140, w: 40, h: 26, color: 'black', labelPos: 'bottom', label: 'Pit' },
    { id: 's3', t: 'pt', kind: 'dot', x: 400, y: 140, color: 'red', labelPos: 'right', label: 'Joint' },
    { id: 's4', t: 'pt', kind: 'text', x: 440, y: 70, color: 'blue', label: 'Footpath' },
    { id: 'l1', t: 'ln', pattern: 'solid', color: 'black', weight: 'normal', x1: 220, y1: 120, x2: 330, y2: 140, label: 'UG cable' },
    { id: 'l2', t: 'ln', pattern: 'dashed', color: 'blue', weight: 'thick', x1: 330, y1: 140, x2: 470, y2: 140, label: 'Duct' },
    { id: 'l3', t: 'ln', pattern: 'dashdot', color: 'green', weight: 'heavy', x1: 40, y1: 215, x2: 500, y2: 215, label: 'Boundary' },
    { id: 'd1', t: 'dim', color: 'black', orient: 'horizontal', x1: 220, y1: 120, x2: 330, y2: 120, offset: 16, label: '11.0m' },
    { id: 'd2', t: 'dim', color: 'black', orient: 'vertical', x1: 330, y1: 140, x2: 330, y2: 215, offset: 18, label: '7.5m' },
  ],
} : null

// 360S014EA LV Connection Record — box is 510.5 × 266.5 pt.
export const LV_SAMPLE_PLAN = DEV ? {
  v: 1, north: 40, northSet: true,
  els: [
    { id: 's1', t: 'pt', kind: 'circle', x: 200, y: 120, w: 14, color: 'blue', labelPos: 'top', label: 'Pole 1234' },
    { id: 's2', t: 'pt', kind: 'rect', x: 300, y: 150, w: 40, h: 24, color: 'black', labelPos: 'bottom', label: 'LV box' },
    { id: 's3', t: 'pt', kind: 'dot', x: 240, y: 190, color: 'red', labelPos: 'right', label: 'LV open point (connected this side)' },
    { id: 's4', t: 'pt', kind: 'text', x: 430, y: 60, color: 'blue', label: 'Footpath' },
    { id: 'l1', t: 'ln', pattern: 'solid', color: 'black', weight: 'normal', x1: 200, y1: 120, x2: 300, y2: 150, label: 'Service' },
    { id: 'l2', t: 'ln', pattern: 'dashed', color: 'blue', weight: 'thick', x1: 300, y1: 150, x2: 430, y2: 150, label: 'Duct' },
    { id: 'd1', t: 'dim', color: 'black', orient: 'horizontal', x1: 200, y1: 120, x2: 300, y2: 120, offset: 16, label: '12.0m' },
    { id: 'd2', t: 'dim', color: 'black', orient: 'vertical', x1: 300, y1: 150, x2: 300, y2: 240, offset: 18, label: '9.0m' },
  ],
} : null

// 360S014EL Cable Test Report — box is 515.4 × 121 pt.
export const CABLE_TEST_SAMPLE_PLAN = DEV ? {
  v: 1, north: 0, northSet: false,
  els: [
    { id: 's1', t: 'pt', kind: 'rect', x: 80,  y: 60, w: 50, h: 30, color: 'blue', labelPos: 'center', label: 'Feeder' },
    { id: 's2', t: 'pt', kind: 'dot',  x: 300, y: 60, color: 'red', labelPos: 'top', label: 'Joint' },
    { id: 'l1', t: 'ln', pattern: 'dashed', color: 'black', weight: 'normal', x1: 105, y1: 60, x2: 300, y2: 60, label: '11kV cable' },
    { id: 'd1', t: 'dim', color: 'black', orient: 'horizontal', x1: 80, y1: 60, x2: 300, y2: 60, offset: -20, label: '22.0m' },
  ],
} : null

// 360S014EI Distribution Panel — fuse rows for the DEV fill.
export const DIST_PANEL_SAMPLE_SLOTS = DEV
  ? Array.from({ length: POSITION_COUNT }, (_, k) => {
      const n = k + 1
      if (n % 2 === 1) return { full: true, a: false, b: false }
      if (n === 4)     return { full: false, a: true, b: false }
      return { full: false, a: true, b: true }
    })
  : null

export const DIST_PANEL_SAMPLE_WAYS = DEV
  ? Array.from({ length: WAY_COUNT }, (_, i) => (
      rowUsed(DIST_PANEL_SAMPLE_SLOTS, i)
        ? {
            destination: `Feeder ${i + 1}`,
            manufacturer: 'ABB',
            model: `Model-${i + 1}`,
            linkFuse: i % 2 === 0 ? 'Link' : 'Fuse',
            openClose: i % 3 === 0 ? 'Open' : 'Closed',
            fuseSize: ['100A', '63A', '40A'][i % 3],
            holderRating: ['100A', '63A', '40A'][i % 3],
            cableDesc: `95mm² Cu ${i + 1}`,
          }
        : { destination: '', manufacturer: '', model: '', linkFuse: '', openClose: '', fuseSize: '', holderRating: '', cableDesc: '' }
    ))
  : null
