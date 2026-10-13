/**
 * The painted trail on each level's default map illustration, as points in percent of the art
 * (x left to right, y top to bottom), traced from the start at the bottom edge to the end at the top.
 * Only valid for the default art in /public/illustrations/adventure; maps with custom artwork fall
 * back to a smooth curve through their checkpoints.
 */
export const MAP_TRAILS: Record<number, [number, number][]> = {
  1: [[55, 100], [56, 92], [58, 84], [61, 76], [63, 68], [69, 60], [76, 52], [79, 44], [77, 36], [71, 29], [61, 24], [50, 22], [41, 19], [36, 12], [36, 4]],
  2: [[47, 100], [48, 94], [52, 88], [56, 82], [52, 77], [44, 72], [36, 67], [34, 62], [39, 59], [46, 57.5], [54, 55], [57, 50], [58, 44], [59, 39], [54, 35], [46, 31], [39, 27], [34, 22], [34, 17], [37, 12], [39, 7], [38, 3]],
  3: [[53, 100], [47, 94], [38, 89], [31, 84], [31, 78], [38, 73], [50, 70], [63, 66], [72, 61], [75, 55], [73, 48], [69, 42], [70, 36], [68, 30], [61, 26], [51, 23], [42, 20], [36, 15], [34, 10], [37, 5], [40, 1]],
  4: [[55, 100], [52, 94], [47, 89], [50, 84], [55, 79], [56, 72], [57, 65], [56, 59], [51, 54], [45, 49], [45, 44], [50, 39], [57, 35], [59, 30], [55, 26], [47, 23], [40, 20], [38, 17]],
  5: [[38, 100], [30, 92], [27, 84], [31, 76], [42, 70], [57, 66], [70, 61], [78, 56], [80, 49], [78, 42], [74, 35], [68, 28], [58, 23], [47, 19], [39, 15], [37, 9], [38, 3]],
  6: [[50, 100], [49, 94], [52, 88], [59, 82], [62, 77], [58, 73], [50, 70], [40, 67], [31, 62], [27, 57], [29, 52], [37, 48], [49, 46], [61, 43], [69, 39], [72, 34], [69, 29], [61, 25], [50, 22], [41, 18], [35, 13], [33, 8], [36, 3]],
  7: [[45, 100], [49, 93], [55, 87], [59, 81], [60, 74], [57, 68], [46, 64], [34, 61], [28, 57], [30, 52], [41, 48], [57, 46], [71, 43], [78, 38], [78, 32], [73, 27], [62, 24], [50, 21], [41, 17], [35, 12], [33, 7], [36, 2]],
  8: [[48, 89], [50, 84], [54, 79], [57, 74], [57, 69], [53, 65], [46, 61], [40, 56], [38, 51], [42, 47], [50, 44], [58, 41], [63, 37], [64, 32], [60, 28], [52, 24], [44, 21], [41, 18], [45, 15]],
  9: [[52, 100], [53, 94], [56, 88], [59, 82], [62, 76], [65, 70], [68, 63], [71, 56], [72, 49], [72, 43], [70, 38], [65, 34], [58, 32], [61, 28], [67, 25], [72, 22], [74, 18]],
  10: [[47, 100], [50, 93], [52, 86], [53, 80], [57, 75], [66, 71], [75, 66], [78, 61], [74, 56], [63, 53], [50, 50], [41, 47], [37, 43], [41, 39], [52, 37], [64, 34], [71, 30], [70, 25], [62, 22], [50, 19], [41, 16], [38, 11], [42, 7], [50, 5]],
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
