/**
 * The painted trail on each level's default map illustration, as points in percent of the art
 * (x left to right, y top to bottom), traced from the start at the bottom edge to the end at the top.
 * Only valid for the default art in /public/illustrations/adventure; maps with custom artwork fall
 * back to a smooth curve through their checkpoints.
 */
export const MAP_TRAILS: Record<number, [number, number][]> = {
  1: [[55, 100], [56, 92], [58, 84], [61, 76], [63, 68], [69, 60], [76, 52], [79, 44], [77, 36], [71, 29], [61, 24], [50, 22], [41, 19], [36, 12], [36, 4]],
  2: [[45, 100], [52, 92], [60, 84], [57, 77], [48, 71], [39, 65], [42, 59], [50, 54], [45, 48], [35, 43], [30, 38], [34, 32], [42, 27], [40, 22], [33, 17], [34, 10], [30, 4]],
  3: [[45, 100], [47, 90], [52, 80], [60, 72], [52, 64], [42, 59], [38, 54], [44, 49], [57, 45], [65, 40], [66, 34], [62, 27], [56, 21], [52, 14], [50, 6]],
  4: [[46, 100], [48, 90], [50, 80], [48, 74], [40, 68], [33, 63], [33, 58], [42, 54], [54, 50], [60, 45], [57, 40], [62, 35], [73, 31], [78, 27], [73, 21], [60, 17], [51, 13], [50, 8]],
  5: [[48, 100], [47, 93], [43, 86], [42, 80], [42, 75], [36, 70], [31, 65], [34, 60], [46, 57], [57, 53], [53, 48], [45, 45], [40, 40], [46, 35], [60, 31], [62, 26], [55, 21], [52, 15]],
  6: [[52, 100], [50, 92], [40, 85], [38, 77], [42, 70], [44, 62], [40, 55], [33, 50], [36, 44], [50, 42], [63, 39], [62, 34], [52, 30], [47, 25], [50, 19], [50, 13]],
  7: [[50, 100], [49, 94], [44, 88], [44, 83], [52, 79], [64, 76], [72, 71], [70, 65], [60, 61], [52, 58], [56, 53], [68, 50], [77, 46], [77, 41], [68, 36], [56, 32], [44, 29], [34, 26], [33, 22], [40, 19], [49, 17], [52, 13], [50, 10]],
  8: [[48, 100], [50, 94], [55, 88], [58, 83], [50, 79], [47, 75], [55, 71], [61, 67], [56, 63], [48, 59], [42, 55], [50, 51], [59, 48], [55, 44], [46, 41], [52, 37], [61, 33], [61, 29], [56, 25], [57, 21], [53, 17], [46, 14], [48, 10]],
  9: [[51, 100], [47, 95], [44, 92], [45, 90], [50, 88], [56, 86], [59, 84], [57, 82], [52, 80], [45, 78], [40, 76], [38, 74], [40, 72], [46, 70], [55, 68], [56, 66], [52, 64], [46, 62], [45, 60], [47, 59], [52, 57], [55, 55], [55, 53], [50, 51], [40, 49], [33, 47], [33, 45], [38, 43], [60, 40], [62, 36], [58, 34], [50, 32], [42, 30], [38, 28], [40, 25], [46, 22], [50, 20], [50, 18]],
  10: [[50, 100], [47, 96], [48, 94], [52, 92], [55, 90], [56, 88], [54, 86], [48, 84], [41, 82], [37, 80], [36, 78], [38, 76], [43, 74], [49, 72], [53, 70], [53, 68], [49, 66], [44, 64], [42, 62], [44, 60], [48, 58], [52, 56], [54, 54], [53, 52], [50, 50], [45, 48], [42, 46], [43, 44], [48, 42], [54, 40], [55, 38], [52, 36], [45, 34], [41, 32], [40, 30], [42, 28], [47, 26], [51, 24], [50, 22], [47, 20], [47, 18]],
};

/** Width and height of the map stage, used so distances along the trail match what players see. */
const ASPECT = { x: 9, y: 16 };

export type Pt = { x: number; y: number };

export function defaultTrail(level: number | null, artwork: string | null | undefined): Pt[] | null {
  if (artwork || level === null) return null;
  const t = MAP_TRAILS[((Math.max(1, level) - 1) % 10) + 1];
  return t ? t.map(([x, y]) => ({ x, y })) : null;
}

/** Samples a Catmull-Rom curve through the points so the line bends smoothly instead of zigzagging. */
export function densify(points: Pt[], steps = 10): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

function dist(a: Pt, b: Pt) {
  return Math.hypot((a.x - b.x) * ASPECT.x, (a.y - b.y) * ASPECT.y);
}

/** Cumulative distance at each point, normalised so the last point is 1. */
function progress(line: Pt[]): number[] {
  const acc = [0];
  for (let i = 1; i < line.length; i++) acc.push(acc[i - 1] + dist(line[i - 1], line[i]));
  const total = acc[acc.length - 1] || 1;
  return acc.map((d) => d / total);
}

/** The point a fraction `t` (0 to 1) of the way along the line, measured by distance. */
export function pointAt(line: Pt[], t: number): Pt {
  const acc = progress(line);
  const k = Math.max(0, Math.min(1, t));
  for (let i = 1; i < line.length; i++) {
    if (acc[i] >= k) {
      const span = acc[i] - acc[i - 1] || 1;
      const f = (k - acc[i - 1]) / span;
      return { x: line[i - 1].x + (line[i].x - line[i - 1].x) * f, y: line[i - 1].y + (line[i].y - line[i - 1].y) * f };
    }
  }
  return line[line.length - 1];
}

/** How far along the line (0 to 1) the closest point to `p` is. */
export function progressOf(line: Pt[], p: Pt): number {
  const acc = progress(line);
  let best = { d: Infinity, t: 0 };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const vx = (b.x - a.x) * ASPECT.x;
    const vy = (b.y - a.y) * ASPECT.y;
    const len2 = vx * vx + vy * vy || 1;
    const f = Math.max(0, Math.min(1, (((p.x - a.x) * ASPECT.x) * vx + ((p.y - a.y) * ASPECT.y) * vy) / len2));
    const q = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    const d = dist(p, q);
    if (d < best.d) best = { d, t: acc[i - 1] + (acc[i] - acc[i - 1]) * f };
  }
  return best.t;
}

/** The part of the line between two fractions of its length. */
export function slice(line: Pt[], from: number, to: number): Pt[] {
  if (to <= from) return [];
  const acc = progress(line);
  return [pointAt(line, from), ...line.filter((_, i) => acc[i] > from && acc[i] < to), pointAt(line, to)];
}

/** Evenly spaced stops along a trail, ending a little before its top so the last one clears the map header. */
export function stopsAlong(line: Pt[], count: number): Pt[] {
  return Array.from({ length: count }, (_, k) => pointAt(line, 0.06 + (0.84 * (k + 1)) / count));
}

export function toPoints(line: Pt[]) {
  return line.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}
