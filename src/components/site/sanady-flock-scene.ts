import type { MurmurationPalette } from "@/components/ui/murmuration-wordmark";

type Colors = MurmurationPalette & { accent: string };
type Ctx = CanvasRenderingContext2D;

/*
 * The ground under the homepage flock: a school, a teacher at the board,
 * students on their way, one at a laptop showing the platform, books and
 * trees, all as flat silhouettes in the birds' ink. Details cut into the
 * silhouettes (windows, chalk, pages) use the sky colour; the laptop screen
 * is the only touch of orange.
 */
export function drawSchoolScene(s: Ctx, w: number, h: number, c: Colors) {
  const base = h - Math.max(6, h * 0.012);
  // One unit: an adult's height. Phones get a smaller scene.
  const u = Math.max(30, Math.min(h * 0.2, w * 0.085, 110));
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  s.lineCap = "round";
  s.lineJoin = "round";
  s.fillRect(0, base, w, h - base);

  const at = (f: number) => w * f;
  const narrow = w < 640;

  tree(s, at(0.05), base, u * 1.25, c);
  school(s, at(narrow ? 0.3 : 0.2), base, u, c);
  board(s, at(0.42), base, u, c);
  person(s, at(0.42) + u * 0.62, base, u, c, { arm: "point", dress: true });
  if (!narrow) {
    person(s, at(0.53), base, u * 0.62, c, { arm: "wave", backpack: true, stride: 0.5 });
    person(s, at(0.575), base, u * 0.58, c, { backpack: true, stride: 0.8 });
    person(s, at(0.615), base, u * 0.64, c, { backpack: true, dress: true, stride: 0.3 });
  } else {
    person(s, at(0.66), base, u * 0.62, c, { arm: "wave", backpack: true, stride: 0.5 });
  }
  if (!narrow) {
    laptopDesk(s, at(0.73), base, u, c);
    books(s, at(0.835), base, u, c);
  }
  tree(s, at(0.94), base, u * 1.45, c);
}

function tree(s: Ctx, x: number, base: number, size: number, c: Colors) {
  s.fillStyle = c.ink;
  s.beginPath();
  s.moveTo(x - size * 0.06, base);
  s.lineTo(x - size * 0.035, base - size * 0.55);
  s.lineTo(x + size * 0.035, base - size * 0.55);
  s.lineTo(x + size * 0.06, base);
  s.fill();
  // Canopy: overlapping rounds.
  const blobs: Array<[number, number, number]> = [
    [0, -0.78, 0.3],
    [-0.22, -0.62, 0.22],
    [0.22, -0.64, 0.23],
    [-0.12, -0.98, 0.2],
    [0.14, -0.95, 0.21],
  ];
  for (const [dx, dy, r] of blobs) {
    s.beginPath();
    s.arc(x + dx * size, base + dy * size, r * size, 0, Math.PI * 2);
    s.fill();
  }
}

function school(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const bw = u * 2.3;
  const bh = u * 0.95;
  const left = x - bw / 2;
  const top = base - bh;
  s.fillStyle = c.ink;
  s.fillRect(left, top, bw, bh);
  // Pediment over the entrance, and the roof line.
  s.fillRect(left - u * 0.06, top - u * 0.06, bw + u * 0.12, u * 0.08);
  s.beginPath();
  s.moveTo(x - u * 0.62, top);
  s.lineTo(x, top - u * 0.42);
  s.lineTo(x + u * 0.62, top);
  s.fill();
  // Flag on a pole.
  s.lineWidth = Math.max(1, u * 0.025);
  s.beginPath();
  s.moveTo(x, top - u * 0.42);
  s.lineTo(x, top - u * 0.82);
  s.stroke();
  s.beginPath();
  s.moveTo(x, top - u * 0.82);
  s.lineTo(x + u * 0.26, top - u * 0.74);
  s.lineTo(x, top - u * 0.66);
  s.fill();
  // Cut-outs in the sky colour: clock, windows, door.
  s.fillStyle = c.skyLow;
  s.beginPath();
  s.arc(x, top - u * 0.17, u * 0.09, 0, Math.PI * 2);
  s.fill();
  const winW = u * 0.22;
  const winH = u * 0.2;
  for (const row of [0.16, 0.5]) {
    for (const col of [-0.82, -0.52, 0.52, 0.82]) {
      s.fillRect(x + col * u - winW / 2, top + row * bh, winW, winH);
    }
  }
  const dw = u * 0.34;
  const dh = u * 0.5;
  s.beginPath();
  s.moveTo(x - dw / 2, base);
  s.lineTo(x - dw / 2, base - dh + dw / 2);
  s.arc(x, base - dh + dw / 2, dw / 2, Math.PI, 0);
  s.lineTo(x + dw / 2, base);
  s.fill();
  s.fillStyle = c.ink;
  s.fillRect(x - u * 0.012, base - dh + dw / 2, u * 0.024, dh - dw / 2);
}

function board(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const bw = u * 0.9;
  const bh = u * 0.58;
  const top = base - u * 1.05;
  s.lineWidth = Math.max(1.5, u * 0.04);
  s.beginPath();
  s.moveTo(x - bw * 0.36, top + bh);
  s.lineTo(x - bw * 0.46, base);
  s.moveTo(x + bw * 0.36, top + bh);
  s.lineTo(x + bw * 0.46, base);
  s.stroke();
  s.fillStyle = c.ink;
  s.fillRect(x - bw / 2, top, bw, bh);
  // Chalk: a little sum and a tick.
  s.strokeStyle = c.skyLow;
  s.lineWidth = Math.max(1, u * 0.02);
  const cx = x - bw * 0.3;
  const cy = top + bh * 0.4;
  const k = u * 0.07;
  s.beginPath();
  s.moveTo(cx - k, cy);
  s.lineTo(cx + k, cy);
  s.moveTo(cx, cy - k);
  s.lineTo(cx, cy + k);
  s.moveTo(cx + k * 2.2, cy - k * 0.4);
  s.lineTo(cx + k * 3.8, cy - k * 0.4);
  s.moveTo(cx + k * 2.2, cy + k * 0.4);
  s.lineTo(cx + k * 3.8, cy + k * 0.4);
  s.moveTo(x + bw * 0.12, top + bh * 0.66);
  s.lineTo(x + bw * 0.2, top + bh * 0.78);
  s.lineTo(x + bw * 0.36, top + bh * 0.5);
  s.stroke();
  s.strokeStyle = c.ink;
}

function person(
  s: Ctx,
  x: number,
  base: number,
  ht: number,
  c: Colors,
  o: { arm?: "point" | "wave"; backpack?: boolean; dress?: boolean; stride?: number } = {},
) {
  const limb = Math.max(1.5, ht * 0.085);
  const hip = base - ht * 0.44;
  const shoulder = base - ht * 0.74;
  const stride = (o.stride ?? 0.2) * ht * 0.16;
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  // Legs.
  s.lineWidth = limb;
  s.beginPath();
  s.moveTo(x - ht * 0.04, hip);
  s.lineTo(x - ht * 0.05 - stride, base - limb / 2);
  s.moveTo(x + ht * 0.04, hip);
  s.lineTo(x + ht * 0.05 + stride, base - limb / 2);
  s.stroke();
  // Body (a dress flares down to the knees).
  s.beginPath();
  if (o.dress) {
    s.moveTo(x - ht * 0.1, shoulder);
    s.lineTo(x + ht * 0.1, shoulder);
    s.lineTo(x + ht * 0.17, base - ht * 0.26);
    s.lineTo(x - ht * 0.17, base - ht * 0.26);
  } else {
    s.roundRect(x - ht * 0.11, shoulder - ht * 0.02, ht * 0.22, hip - shoulder + ht * 0.06, ht * 0.06);
  }
  s.fill();
  // Arms.
  s.lineWidth = limb * 0.85;
  s.beginPath();
  s.moveTo(x - ht * 0.09, shoulder + ht * 0.02);
  s.lineTo(x - ht * 0.15, hip + ht * 0.02);
  s.moveTo(x + ht * 0.09, shoulder + ht * 0.02);
  if (o.arm === "point") s.lineTo(x - ht * 0.36, shoulder - ht * 0.12);
  else if (o.arm === "wave") s.lineTo(x + ht * 0.24, shoulder - ht * 0.24);
  else s.lineTo(x + ht * 0.15, hip + ht * 0.02);
  s.stroke();
  if (o.backpack) {
    s.beginPath();
    s.roundRect(x - ht * 0.21, shoulder, ht * 0.12, ht * 0.26, ht * 0.04);
    s.fill();
  }
  // Head.
  s.beginPath();
  s.arc(x, shoulder - ht * 0.14, ht * 0.11, 0, Math.PI * 2);
  s.fill();
}

function laptopDesk(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const deskTop = base - u * 0.45;
  const dw = u * 0.8;
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  s.fillRect(x - dw / 2, deskTop, dw, u * 0.05);
  s.lineWidth = Math.max(1.5, u * 0.035);
  s.beginPath();
  s.moveTo(x - dw * 0.42, deskTop);
  s.lineTo(x - dw * 0.42, base);
  s.moveTo(x + dw * 0.42, deskTop);
  s.lineTo(x + dw * 0.42, base);
  s.stroke();
  // The laptop: the platform's play mark in orange on its screen.
  const sw = u * 0.42;
  const sh = u * 0.28;
  const sx = x + dw * 0.05;
  s.fillRect(sx - sw * 0.1, deskTop - u * 0.03, sw * 1.2, u * 0.03);
  s.fillRect(sx, deskTop - u * 0.03 - sh, sw, sh);
  s.fillStyle = c.accent;
  s.fillRect(sx + sw * 0.08, deskTop - u * 0.03 - sh + sh * 0.1, sw * 0.84, sh * 0.8);
  s.fillStyle = c.skyTop;
  const px = sx + sw / 2;
  const py = deskTop - u * 0.03 - sh / 2;
  const k = sh * 0.2;
  s.beginPath();
  s.moveTo(px - k * 0.7, py - k);
  s.lineTo(px + k, py);
  s.lineTo(px - k * 0.7, py + k);
  s.fill();
  // A student on a stool, facing the screen.
  s.fillStyle = c.ink;
  const stool = x - dw * 0.72;
  s.fillRect(stool - u * 0.14, base - u * 0.3, u * 0.28, u * 0.04);
  s.beginPath();
  s.moveTo(stool, base - u * 0.3);
  s.lineTo(stool, base);
  s.stroke();
  const ht = u * 0.6;
  const hip = base - u * 0.3;
  s.lineWidth = Math.max(1.5, ht * 0.085);
  s.beginPath();
  s.moveTo(stool, hip);
  s.lineTo(stool + ht * 0.28, hip);
  s.lineTo(stool + ht * 0.28, base - 1);
  s.stroke();
  s.beginPath();
  s.roundRect(stool - ht * 0.1, hip - ht * 0.34, ht * 0.2, ht * 0.36, ht * 0.06);
  s.fill();
  s.lineWidth = Math.max(1.2, ht * 0.07);
  s.beginPath();
  s.moveTo(stool + ht * 0.05, hip - ht * 0.28);
  s.lineTo(sx - sw * 0.05, deskTop - u * 0.04);
  s.stroke();
  s.beginPath();
  s.arc(stool + ht * 0.03, hip - ht * 0.47, ht * 0.11, 0, Math.PI * 2);
  s.fill();
}

function books(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const stack: Array<[number, number, number]> = [
    [0, 0.62, 0.13],
    [0.04, 0.54, 0.11],
    [-0.03, 0.58, 0.12],
  ];
  let y = base;
  for (const [dx, bw, bh] of stack) {
    s.fillStyle = c.ink;
    s.fillRect(x + dx * u - (bw * u) / 2, y - bh * u, bw * u, bh * u);
    s.fillStyle = c.skyLow;
    s.fillRect(x + dx * u + (bw * u) / 2 - u * 0.05, y - bh * u + u * 0.025, u * 0.035, bh * u - u * 0.05);
    y -= bh * u;
  }
  // An open book on top.
  s.fillStyle = c.ink;
  s.beginPath();
  s.moveTo(x - u * 0.3, y - u * 0.02);
  s.quadraticCurveTo(x - u * 0.15, y - u * 0.16, x, y - u * 0.06);
  s.quadraticCurveTo(x + u * 0.15, y - u * 0.16, x + u * 0.3, y - u * 0.02);
  s.lineTo(x + u * 0.3, y);
  s.lineTo(x - u * 0.3, y);
  s.fill();
}
