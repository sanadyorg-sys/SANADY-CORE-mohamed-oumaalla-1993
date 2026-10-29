// Draws the footer's twelve-petal rosette lattice (public/brand/zellige-rosette.svg).
// Classic Moroccan rosette: a small twelve-pointed star, twelve petals grown from the
// star's edges, and double spokes that join each rosette to its six neighbours on a
// triangular grid. All sizes are in units of the rosette spacing D.
// Usage: node scripts/brand/zellige-rosette.mjs [out] [starTip shoulder petalTip spokeEnd]  (RING=1 adds a ring through the petal tips)
import { writeFileSync } from "node:fs";

const OUT = process.argv[2] ?? "public/brand/zellige-rosette.svg";
const COLOR = process.env.COLOR ?? "#fff"; // COLOR=#f95a05 for the orange tile used on light surfaces
const [R1, R2, R3, R4] = process.argv.length > 6 ? process.argv.slice(3, 7).map(Number) : [0.12, 0.27, 0.42, 0.5];
const RING = process.env.RING === "1";
const GAP = 0.14; // radius of the gap stars
const D = 52; // distance between neighbouring rosettes (vertical neighbours)
const W = D * Math.sqrt(3); // tile: two columns wide, one rosette tall
const H = D;

const polar = (cx, cy, r, deg) => [cx + r * D * Math.cos((deg * Math.PI) / 180), cy + r * D * Math.sin((deg * Math.PI) / 180)];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const lines = [];
const stars = []; // central stars, filled so the rosette centres do not read as dark holes
function meet(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}

function rosette(x, y) {
  const star = [];
  for (let k = 0; k < 12; k++) {
    const a = k * 30;
    const p = polar(x, y, R1, a); // star tip, on the petal's axis
    // Neighbouring petals share a shoulder, on the line halfway between their axes.
    const sa = polar(x, y, R2, a - 15);
    const sb = polar(x, y, R2, a + 15);
    // The star's edges are the petal sides carried on past the tip, inwards, to the
    // star's inner corners (on those same halfway lines).
    const half = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
    const qa = meet(p, sub(p, sa), [x, y], half(a - 15));
    const qb = meet(p, sub(p, sb), [x, y], half(a + 15));
    const tip = polar(x, y, R3, a);
    star.push(qa, p);
    lines.push([qa, p], [p, qb], [p, sa], [p, sb], [sa, tip], [sb, tip]);
    // Between two petals a line runs out from their shared shoulder.
    lines.push([sb, polar(x, y, R4, a + 15)]);
    // A ring through the petal tips closes the rosette (the outer row of small shapes).
    if (RING) lines.push([tip, polar(x, y, R3, a + 30)]);
    // From the tip a line runs on to the cell edge: it meets the neighbouring rosette's
    // (30°, 90°…) or the two others at a gap between three rosettes (0°, 60°…).
    lines.push([tip, polar(x, y, k % 2 === 1 ? 0.5 : 0.5 / Math.cos(Math.PI / 6), a)]);
  }
  stars.push(star);
  // A small six-pointed star fills each gap between three rosettes (at 0° and 60°;
  // the other four gaps belong to neighbouring rosettes).
  for (const g of [0, 60]) {
    const [gx, gy] = polar(x, y, 0.5 / Math.cos(Math.PI / 6), g);
    stars.push(Array.from({ length: 12 }, (_, i) => polar(gx, gy, i % 2 ? GAP * 0.55 : GAP, i * 30)));
  }
}

for (let col = -1; col <= 3; col++)
  for (let row = -1; row <= 2; row++) rosette(col * (W / 2), row * D + (col % 2 ? D / 2 : 0));

const f = (v) => Number(v.toFixed(2));
const inView = ([a, b]) => Math.max(a[0], b[0]) > -1 && Math.min(a[0], b[0]) < W + 1 && Math.max(a[1], b[1]) > -1 && Math.min(a[1], b[1]) < H + 1;
const d = lines.filter(inView).map(([a, b]) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`).join("");
const fill = stars
  .filter((pts) => pts.some(([x, y]) => x > -1 && x < W + 1 && y > -1 && y < H + 1))
  .map((pts) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`)
  .join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}" height="${H}" viewBox="0 0 ${f(W)} ${H}"><path fill="${COLOR}" fill-opacity="0.55" d="${fill}"/><path fill="none" stroke="${COLOR}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="${d}"/></svg>\n`;
writeFileSync(OUT, svg);
console.log(OUT, svg.length, "bytes");
