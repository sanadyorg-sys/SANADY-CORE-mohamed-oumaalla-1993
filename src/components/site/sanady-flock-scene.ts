import type { MurmurationPalette } from "@/components/ui/murmuration-wordmark";

type Colors = MurmurationPalette & { accent: string };
type Ctx = CanvasRenderingContext2D;
type Point = [number, number];
/** An arm: hanging, raised, or reaching to a point (a hand, a board, a cap). */
type Arm = "down" | "wave" | "up" | Point;

/*
 * The ground under the homepage flock: a school behind its fence, a teacher
 * at the board, children on their way (two hand in hand, one on a tablet), a
 * student at a laptop showing the platform, a graduate throwing a cap, books
 * and trees, as flat silhouettes in the birds' ink, over faint hills and a
 * distant town for depth. Details cut into the silhouettes (windows, chalk,
 * pages) use the sky colour; screens and the cap's tassel are the only orange.
 */
export function drawSchoolScene(s: Ctx, w: number, h: number, c: Colors) {
  const base = h - Math.max(6, h * 0.012);
  // One unit: an adult's height. Phones get a smaller, lighter scene.
  const u = Math.max(30, Math.min(h * 0.2, w * 0.085, 110));
  const at = (f: number) => w * f;
  const narrow = w < 640;
  s.lineCap = "round";
  s.lineJoin = "round";

  backdrop(s, w, base, u, c);

  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  s.fillRect(0, base, w, h - base);

  if (narrow) {
    tree(s, at(0.06), base, u * 1.25, c);
    school(s, at(0.3), base, u, c, false);
    board(s, at(0.56), base, u, c);
    teacher(s, at(0.56) + u * 0.62, base, u, c);
    tree(s, at(0.93), base, u * 1.4, c);
    return;
  }

  tree(s, at(0.04), base, u * 1.25, c);
  school(s, at(0.17), base, u, c, true);
  board(s, at(0.38), base, u, c);
  teacher(s, at(0.38) + u * 0.62, base, u, c);

  // Two children hand in hand, one waving; a third reads on a tablet.
  const k1 = at(0.5);
  const k2 = k1 + u * 0.5;
  const kh = u * 0.62;
  const meet: Point = [(k1 + k2) / 2, base - kh * 0.4];
  person(s, k1, base, kh, c, { left: "wave", right: meet, backpack: true, hair: "short", stride: 0.5 });
  person(s, k2, base, kh * 0.94, c, { left: meet, backpack: true, hair: "ponytail", dress: true, stride: 0.6 });
  person(s, at(0.585), base, kh * 1.04, c, { backpack: true, hair: "short", hold: "tablet", stride: 0.2 });

  laptopDesk(s, at(0.68), base, u, c);
  graduate(s, at(0.78), base, u * 0.8, c);
  books(s, at(0.86), base, u, c);
  tree(s, at(0.95), base, u * 1.45, c);
}

/** Far mountains, rolling hills and a small town, barely darker than the sky. */
function backdrop(s: Ctx, w: number, base: number, u: number, c: Colors) {
  s.save();
  s.fillStyle = c.ink;
  s.globalAlpha = 0.05;
  s.beginPath();
  s.moveTo(0, base);
  const peaks: Point[] = [
    [0, 0.9], [0.08, 1.35], [0.15, 1.05], [0.24, 1.6], [0.33, 1.15], [0.42, 1.45],
    [0.52, 1.0], [0.6, 1.5], [0.7, 1.1], [0.79, 1.7], [0.88, 1.2], [0.95, 1.4], [1, 1.1],
  ];
  for (const [f, k] of peaks) s.lineTo(w * f, base - u * k);
  s.lineTo(w, base);
  s.fill();

  s.globalAlpha = 0.08;
  s.beginPath();
  s.moveTo(0, base);
  s.lineTo(0, base - u * 0.45);
  for (let i = 0; i <= 8; i++) {
    s.quadraticCurveTo((w * (i + 0.5)) / 8, base - u * (i % 2 ? 0.75 : 0.95), (w * (i + 1)) / 8, base - u * 0.5);
  }
  s.lineTo(w, base);
  s.fill();

  // The town: a row of small houses on the hill between the figures.
  s.globalAlpha = 0.11;
  let x = w * 0.27;
  let i = 0;
  while (x < w * 0.74) {
    const hw = u * (0.16 + ((i * 37) % 10) / 60);
    const hh = u * (0.22 + ((i * 53) % 10) / 45);
    const y = base - u * 0.52;
    s.fillRect(x, y - hh, hw, hh + u * 0.1);
    if (i % 3 === 1) {
      s.beginPath();
      s.moveTo(x - u * 0.02, y - hh);
      s.lineTo(x + hw / 2, y - hh - u * 0.12);
      s.lineTo(x + hw + u * 0.02, y - hh);
      s.fill();
    }
    x += hw + u * (0.03 + ((i * 29) % 10) / 120);
    i++;
  }
  s.restore();
}

function tree(s: Ctx, x: number, base: number, size: number, c: Colors) {
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  s.beginPath();
  s.moveTo(x - size * 0.06, base);
  s.lineTo(x - size * 0.035, base - size * 0.55);
  s.lineTo(x + size * 0.035, base - size * 0.55);
  s.lineTo(x + size * 0.06, base);
  s.fill();
  // Two branches, then the canopy as overlapping rounds.
  s.lineWidth = size * 0.04;
  s.beginPath();
  s.moveTo(x, base - size * 0.4);
  s.lineTo(x - size * 0.16, base - size * 0.58);
  s.moveTo(x, base - size * 0.46);
  s.lineTo(x + size * 0.17, base - size * 0.62);
  s.stroke();
  const blobs: Array<[number, number, number]> = [
    [0, -0.78, 0.3], [-0.22, -0.62, 0.22], [0.22, -0.64, 0.23], [-0.12, -0.98, 0.2], [0.14, -0.95, 0.21], [0.3, -0.8, 0.14], [-0.3, -0.82, 0.13],
  ];
  for (const [dx, dy, r] of blobs) {
    s.beginPath();
    s.arc(x + dx * size, base + dy * size, r * size, 0, Math.PI * 2);
    s.fill();
  }
}

function school(s: Ctx, x: number, base: number, u: number, c: Colors, withFence: boolean) {
  const bw = u * 2.3;
  const bh = u * 0.95;
  const left = x - bw / 2;
  const top = base - bh;
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;
  s.fillRect(left, top, bw, bh);
  // Cornice, pediment, and a flag on a pole.
  s.fillRect(left - u * 0.06, top - u * 0.06, bw + u * 0.12, u * 0.08);
  s.beginPath();
  s.moveTo(x - u * 0.62, top);
  s.lineTo(x, top - u * 0.42);
  s.lineTo(x + u * 0.62, top);
  s.fill();
  s.lineWidth = Math.max(1, u * 0.025);
  s.beginPath();
  s.moveTo(x, top - u * 0.42);
  s.lineTo(x, top - u * 0.82);
  s.stroke();
  s.beginPath();
  s.moveTo(x, top - u * 0.82);
  s.quadraticCurveTo(x + u * 0.14, top - u * 0.84, x + u * 0.27, top - u * 0.76);
  s.quadraticCurveTo(x + u * 0.14, top - u * 0.7, x, top - u * 0.66);
  s.fill();

  // Cut-outs in the sky colour: clock, sign, windows (with mullions), door.
  s.fillStyle = c.skyLow;
  s.beginPath();
  s.arc(x, top - u * 0.17, u * 0.09, 0, Math.PI * 2);
  s.fill();
  s.fillRect(x - u * 0.26, top + bh * 0.12, u * 0.52, u * 0.13);
  const winW = u * 0.22;
  const winH = u * 0.22;
  for (const row of [0.14, 0.5]) {
    for (const col of [-0.86, -0.56, 0.56, 0.86]) {
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
  s.strokeStyle = c.ink;
  // Clock hands, the sign's lettering, window bars, the door's split.
  s.lineWidth = Math.max(1, u * 0.018);
  s.beginPath();
  s.moveTo(x, top - u * 0.17);
  s.lineTo(x, top - u * 0.23);
  s.moveTo(x, top - u * 0.17);
  s.lineTo(x + u * 0.045, top - u * 0.17);
  s.moveTo(x - u * 0.18, top + bh * 0.12 + u * 0.065);
  s.lineTo(x + u * 0.18, top + bh * 0.12 + u * 0.065);
  for (const row of [0.14, 0.5]) {
    for (const col of [-0.86, -0.56, 0.56, 0.86]) {
      const cx = x + col * u;
      const cy = top + row * bh + winH / 2;
      s.moveTo(cx, cy - winH / 2);
      s.lineTo(cx, cy + winH / 2);
      s.moveTo(cx - winW / 2, cy);
      s.lineTo(cx + winW / 2, cy);
    }
  }
  s.moveTo(x, base - dh + dw / 2);
  s.lineTo(x, base);
  s.stroke();
  // Steps.
  s.fillRect(x - dw * 0.85, base - u * 0.035, dw * 1.7, u * 0.035);
  s.fillRect(x - dw * 0.68, base - u * 0.07, dw * 1.36, u * 0.035);

  if (withFence) {
    for (const side of [-1, 1]) {
      const from = side < 0 ? left - u * 0.75 : left + bw + u * 0.08;
      fence(s, from, from + u * 0.67, base, u);
    }
  }
}

function fence(s: Ctx, from: number, to: number, base: number, u: number) {
  s.lineWidth = Math.max(1, u * 0.025);
  s.beginPath();
  s.moveTo(from, base - u * 0.2);
  s.lineTo(to, base - u * 0.2);
  s.moveTo(from, base - u * 0.1);
  s.lineTo(to, base - u * 0.1);
  for (let x = from; x <= to + 0.5; x += u * 0.11) {
    s.moveTo(x, base);
    s.lineTo(x, base - u * 0.27);
  }
  s.stroke();
}

function board(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const bw = u * 0.9;
  const bh = u * 0.58;
  const top = base - u * 1.05;
  s.strokeStyle = c.ink;
  s.fillStyle = c.ink;
  s.lineWidth = Math.max(1.5, u * 0.04);
  s.beginPath();
  s.moveTo(x - bw * 0.36, top + bh);
  s.lineTo(x - bw * 0.46, base);
  s.moveTo(x + bw * 0.36, top + bh);
  s.lineTo(x + bw * 0.46, base);
  s.moveTo(x - bw * 0.4, top + bh + u * 0.1);
  s.lineTo(x + bw * 0.4, top + bh + u * 0.1);
  s.stroke();
  s.fillRect(x - bw / 2 - u * 0.02, top - u * 0.02, bw + u * 0.04, bh + u * 0.04);
  // Chalk: a little sum, a tick, and a line of writing.
  s.strokeStyle = c.skyLow;
  s.lineWidth = Math.max(1, u * 0.02);
  const cx = x - bw * 0.3;
  const cy = top + bh * 0.34;
  const k = u * 0.065;
  s.beginPath();
  s.moveTo(cx - k, cy);
  s.lineTo(cx + k, cy);
  s.moveTo(cx, cy - k);
  s.lineTo(cx, cy + k);
  s.moveTo(cx + k * 2.2, cy - k * 0.4);
  s.lineTo(cx + k * 3.8, cy - k * 0.4);
  s.moveTo(cx + k * 2.2, cy + k * 0.4);
  s.lineTo(cx + k * 3.8, cy + k * 0.4);
  s.moveTo(x + bw * 0.14, top + bh * 0.42);
  s.lineTo(x + bw * 0.22, top + bh * 0.52);
  s.lineTo(x + bw * 0.38, top + bh * 0.26);
  s.moveTo(x - bw * 0.38, top + bh * 0.74);
  s.quadraticCurveTo(x - bw * 0.2, top + bh * 0.66, x, top + bh * 0.76);
  s.quadraticCurveTo(x + bw * 0.14, top + bh * 0.84, x + bw * 0.3, top + bh * 0.72);
  s.stroke();
  s.strokeStyle = c.ink;
}

/** The teacher: a bun, a pointer to the board, a book held at the side. */
function teacher(s: Ctx, x: number, base: number, u: number, c: Colors) {
  const tip: Point = [x - u * 0.62, base - u * 0.86];
  person(s, x, base, u, c, { left: tip, right: "down", dress: true, hair: "bun", hold: "book-side" });
  // The pointer continues past the hand.
  s.strokeStyle = c.ink;
  s.lineWidth = Math.max(1, u * 0.018);
  s.beginPath();
  s.moveTo(x - u * 0.36, base - u * 0.78);
  s.lineTo(x - u * 0.7, base - u * 0.92);
  s.stroke();
}

function person(
  s: Ctx,
  x: number,
  base: number,
  ht: number,
  c: Colors,
  o: {
    left?: Arm;
    right?: Arm;
    backpack?: boolean;
    dress?: boolean;
    hair?: "bun" | "ponytail" | "short";
    hold?: "tablet" | "book-side";
    cap?: boolean;
    stride?: number;
  } = {},
) {
  const limb = Math.max(1.5, ht * 0.085);
  const hip = base - ht * 0.44;
  const shoulder = base - ht * 0.74;
  const stride = (o.stride ?? 0.2) * ht * 0.16;
  const headY = shoulder - ht * 0.14;
  const headR = ht * 0.11;
  s.fillStyle = c.ink;
  s.strokeStyle = c.ink;

  if (o.backpack) {
    s.beginPath();
    s.roundRect(x - ht * 0.21, shoulder, ht * 0.13, ht * 0.27, ht * 0.045);
    s.fill();
  }
  // Legs, with shoes.
  s.lineWidth = limb;
  s.beginPath();
  s.moveTo(x - ht * 0.04, hip);
  s.lineTo(x - ht * 0.05 - stride, base - limb / 2);
  s.lineTo(x - ht * 0.1 - stride, base - limb / 2);
  s.moveTo(x + ht * 0.04, hip);
  s.lineTo(x + ht * 0.05 + stride, base - limb / 2);
  s.lineTo(x + ht * 0.1 + stride, base - limb / 2);
  s.stroke();
  // Body (a dress flares down to the knees).
  s.beginPath();
  if (o.dress) {
    s.moveTo(x - ht * 0.1, shoulder - ht * 0.01);
    s.lineTo(x + ht * 0.1, shoulder - ht * 0.01);
    s.lineTo(x + ht * 0.18, base - ht * 0.25);
    s.lineTo(x - ht * 0.18, base - ht * 0.25);
  } else {
    s.roundRect(x - ht * 0.11, shoulder - ht * 0.02, ht * 0.22, hip - shoulder + ht * 0.06, ht * 0.06);
  }
  s.fill();
  // Arms.
  s.lineWidth = limb * 0.85;
  const arm = (side: -1 | 1, a: Arm | undefined) => {
    const sx = x + side * ht * 0.09;
    const sy = shoulder + ht * 0.02;
    let end: Point;
    if (a === "wave") end = [x + side * ht * 0.25, shoulder - ht * 0.24];
    else if (a === "up") end = [x + side * ht * 0.14, shoulder - ht * 0.34];
    else if (Array.isArray(a)) {
      // Reach towards the point, no further than the arm's length.
      const dx = a[0] - sx;
      const dy = a[1] - sy;
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(len, ht * 0.36);
      end = [sx + (dx / len) * reach, sy + (dy / len) * reach];
    } else end = [x + side * ht * 0.15, hip + ht * 0.02];
    s.beginPath();
    s.moveTo(sx, sy);
    s.lineTo(end[0], end[1]);
    s.stroke();
    return end;
  };
  arm(-1, o.left);
  const rightHand = arm(1, o.right);
  // Head and hair.
  s.beginPath();
  s.arc(x, headY, headR, 0, Math.PI * 2);
  s.fill();
  if (o.hair === "bun") {
    s.beginPath();
    s.arc(x + headR * 0.55, headY - headR * 0.95, headR * 0.5, 0, Math.PI * 2);
    s.fill();
  } else if (o.hair === "ponytail") {
    s.lineWidth = headR * 0.55;
    s.beginPath();
    s.moveTo(x + headR * 0.7, headY - headR * 0.5);
    s.quadraticCurveTo(x + headR * 1.7, headY - headR * 0.2, x + headR * 1.4, headY + headR * 1.1);
    s.stroke();
  } else if (o.hair === "short") {
    s.beginPath();
    s.arc(x, headY - headR * 0.15, headR * 1.08, Math.PI * 1.05, Math.PI * 1.95);
    s.fill();
  }
  if (o.cap) mortarboard(s, x, headY - headR * 0.9, headR * 2.4, -0.08, c);
  // Things held.
  if (o.hold === "tablet") {
    const tw = ht * 0.24;
    const th = ht * 0.17;
    const tx = x - tw / 2;
    const ty = shoulder + ht * 0.08;
    s.fillStyle = c.ink;
    s.fillRect(tx - ht * 0.015, ty - ht * 0.015, tw + ht * 0.03, th + ht * 0.03);
    s.fillStyle = c.accent;
    s.fillRect(tx, ty, tw, th);
    s.fillStyle = c.ink;
    s.lineWidth = limb * 0.8;
    s.beginPath();
    s.moveTo(x - ht * 0.09, shoulder + ht * 0.03);
    s.lineTo(tx, ty + th * 0.8);
    s.moveTo(x + ht * 0.09, shoulder + ht * 0.03);
    s.lineTo(tx + tw, ty + th * 0.8);
    s.stroke();
  } else if (o.hold === "book-side") {
    s.fillStyle = c.ink;
    s.fillRect(rightHand[0] - ht * 0.02, rightHand[1] - ht * 0.16, ht * 0.07, ht * 0.2);
  }
}

/** A graduation cap; the tassel is orange. */
function mortarboard(s: Ctx, x: number, y: number, size: number, tilt: number, c: Colors) {
  s.save();
  s.translate(x, y);
  s.rotate(tilt);
  s.fillStyle = c.ink;
  s.beginPath();
  s.moveTo(-size / 2, 0);
  s.lineTo(0, -size * 0.2);
  s.lineTo(size / 2, 0);
  s.lineTo(0, size * 0.2);
  s.fill();
  s.fillRect(-size * 0.24, 0, size * 0.48, size * 0.16);
  s.strokeStyle = c.accent;
  s.lineWidth = Math.max(1, size * 0.05);
  s.beginPath();
  s.moveTo(0, 0);
  s.lineTo(size * 0.36, size * 0.06);
  s.lineTo(size * 0.38, size * 0.3);
  s.stroke();
  s.restore();
}

/** A graduate throwing a cap in the air, diploma in hand: the certificates. */
function graduate(s: Ctx, x: number, base: number, ht: number, c: Colors) {
  const toss: Point = [x + ht * 0.3, base - ht * 1.35];
  person(s, x, base, ht, c, { left: "up", right: toss, dress: true, hair: "short", stride: 0.3 });
  mortarboard(s, toss[0] + ht * 0.08, toss[1] - ht * 0.08, ht * 0.3, 0.5, c);
  // The diploma: a rolled scroll with an orange ribbon, raised in the left hand.
  const hx = x - ht * 0.14;
  const hy = base - ht * 1.08;
  s.save();
  s.translate(hx, hy);
  s.rotate(-0.5);
  s.fillStyle = c.ink;
  s.fillRect(-ht * 0.03, -ht * 0.13, ht * 0.06, ht * 0.26);
  s.fillStyle = c.accent;
  s.fillRect(-ht * 0.035, -ht * 0.015, ht * 0.07, ht * 0.03);
  s.restore();
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
  // A small plant and a mug beside the laptop.
  s.fillRect(x + dw * 0.36, deskTop - u * 0.09, u * 0.06, u * 0.09);
  s.beginPath();
  s.ellipse(x + dw * 0.36 + u * 0.03, deskTop - u * 0.13, u * 0.035, u * 0.06, -0.4, 0, Math.PI * 2);
  s.ellipse(x + dw * 0.36 + u * 0.06, deskTop - u * 0.12, u * 0.03, u * 0.055, 0.5, 0, Math.PI * 2);
  s.fill();
  // The laptop: the platform's play mark in orange on its screen.
  const sw = u * 0.42;
  const sh = u * 0.28;
  const sx = x - dw * 0.12;
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
  s.fillRect(sx + sw * 0.16, py + sh * 0.26, sw * 0.68, sh * 0.06);
  s.fillStyle = c.ink;
  s.fillRect(sx + sw * 0.16, py + sh * 0.26, sw * 0.34, sh * 0.06);
  // A student on a chair, facing the screen.
  const chair = x - dw * 0.78;
  s.fillRect(chair - u * 0.14, base - u * 0.3, u * 0.28, u * 0.04);
  s.lineWidth = Math.max(1.5, u * 0.03);
  s.beginPath();
  s.moveTo(chair - u * 0.12, base - u * 0.3);
  s.lineTo(chair - u * 0.12, base);
  s.moveTo(chair + u * 0.12, base - u * 0.3);
  s.lineTo(chair + u * 0.12, base);
  s.moveTo(chair - u * 0.13, base - u * 0.3);
  s.lineTo(chair - u * 0.15, base - u * 0.62);
  s.stroke();
  const ht = u * 0.6;
  const hip = base - u * 0.3;
  s.lineWidth = Math.max(1.5, ht * 0.085);
  s.beginPath();
  s.moveTo(chair, hip);
  s.lineTo(chair + ht * 0.3, hip);
  s.lineTo(chair + ht * 0.3, base - 1);
  s.stroke();
  s.beginPath();
  s.roundRect(chair - ht * 0.1, hip - ht * 0.34, ht * 0.2, ht * 0.36, ht * 0.06);
  s.fill();
  s.lineWidth = Math.max(1.2, ht * 0.07);
  s.beginPath();
  s.moveTo(chair + ht * 0.05, hip - ht * 0.28);
  s.lineTo(sx - sw * 0.08, deskTop - u * 0.05);
  s.stroke();
  s.beginPath();
  s.arc(chair + ht * 0.03, hip - ht * 0.47, ht * 0.11, 0, Math.PI * 2);
  s.fill();
  s.beginPath();
  s.arc(chair + ht * 0.03, hip - ht * 0.49, ht * 0.12, Math.PI * 1.05, Math.PI * 1.95);
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
