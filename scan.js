// Dokumenterkennung, Entzerrung und Aufbereitung. Keine externen Bibliotheken.
//
// Ablauf: Bild verkleinern -> Blatt als helle bzw. von Kanten eingeschlossene Fläche finden ->
// umschliessendes Viereck berechnen -> Perspektive entzerren -> Schatten entfernen.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function toGray(rgba, w, h) {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 77 + rgba[j + 1] * 150 + rgba[j + 2] * 29) >> 8;
  return g;
}

// Separabler Mittelwertfilter mit Randwiederholung.
export function boxBlur(src, w, h, r) {
  if (r < 1) return src.slice();
  const tmp = new Int32Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += src[base + clamp(k, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[base + x] = sum;
      sum += src[base + clamp(x + r + 1, 0, w - 1)] - src[base + clamp(x - r, 0, w - 1)];
    }
  }
  const div = (2 * r + 1) * (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let k = -r; k <= r; k++) sum += tmp[clamp(k, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = (sum / div + 0.5) | 0;
      sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return out;
}

function otsu(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, best = 0, thr = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

// Zusammenhängende Flächen (4er-Nachbarschaft). Gibt die grössten zurück.
function components(mask, w, h, minArea, maxCount) {
  const n = w * h;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const comps = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    if (!mask[i] || label[i]) continue;
    id++;
    let sp = 0, area = 0;
    stack[sp++] = i;
    label[i] = id;
    while (sp) {
      const p = stack[--sp];
      area++;
      const x = p % w;
      if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[sp++] = p + 1; }
      if (p >= w && mask[p - w] && !label[p - w]) { label[p - w] = id; stack[sp++] = p - w; }
      if (p < n - w && mask[p + w] && !label[p + w]) { label[p + w] = id; stack[sp++] = p + w; }
    }
    if (area >= minArea) comps.push({ id, area });
  }
  comps.sort((a, b) => b.area - a.area);
  return { label, comps: comps.slice(0, maxCount) };
}

// Löcher (Schrift, Stempel) füllen und die Randpunkte der Fläche liefern.
function describeRegion(label, id, w, h) {
  const n = w * h;
  const outside = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (!outside[i] && label[i] !== id) { outside[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  let area = 0;
  const pts = [];
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let minX = -1, maxX = -1;
    for (let x = 0; x < w; x++) {
      if (!outside[row + x]) { area++; if (minX < 0) minX = x; maxX = x; }
    }
    if (minX >= 0) pts.push({ x: minX, y }, { x: maxX + 1, y }, { x: minX, y: y + 1 }, { x: maxX + 1, y: y + 1 });
  }
  return { area, pts };
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function lineIntersect(a, b, c, d) {
  const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
  return { x: a.x + t * rx, y: a.y + t * ry };
}

// Hülle auf ein umschliessendes Viereck reduzieren: Kante mit der kleinsten Flächenzunahme zusammenführen.
function reduceToQuad(poly, maxDist) {
  const p = poly.slice();
  while (p.length > 4) {
    const n = p.length;
    let best = -1, bestCost = Infinity, bestQ = null;
    for (let j = 0; j < n; j++) {
      const a = p[(j - 1 + n) % n], b = p[j], c = p[(j + 1) % n], d = p[(j + 2) % n];
      const q = lineIntersect(a, b, c, d);
      if (!q) continue;
      if (cross(b, c, q) >= 0) continue; // muss ausserhalb der Kante b-c liegen
      if (Math.hypot(q.x - b.x, q.y - b.y) > maxDist || Math.hypot(q.x - c.x, q.y - c.y) > maxDist) continue;
      const cost = Math.abs(cross(b, c, q)) / 2;
      if (cost < bestCost) { bestCost = cost; best = j; bestQ = q; }
    }
    if (best < 0) {
      // Rückfall: Ecke mit dem kleinsten Dreieck entfernen
      let bi = 0, bc = Infinity;
      for (let j = 0; j < n; j++) {
        const c = Math.abs(cross(p[(j - 1 + n) % n], p[j], p[(j + 1) % n]));
        if (c < bc) { bc = c; bi = j; }
      }
      p.splice(bi, 1);
    } else {
      const j2 = (best + 1) % n;
      p[best] = bestQ;
      p.splice(j2, 1);
    }
  }
  return p.length === 4 ? p : null;
}

const polyArea = (q) => {
  let s = 0;
  for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};

export function sortCorners(q) {
  const cx = q.reduce((s, p) => s + p.x, 0) / q.length;
  const cy = q.reduce((s, p) => s + p.y, 0) / q.length;
  const s = q.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  let k = 0, m = Infinity;
  s.forEach((p, i) => { if (p.x + p.y < m) { m = p.x + p.y; k = i; } });
  return [s[k], s[(k + 1) % 4], s[(k + 2) % 4], s[(k + 3) % 4]]; // links oben, rechts oben, rechts unten, links unten
}

function quadValid(q) {
  for (let i = 0; i < 4; i++) {
    const o = q[i], a = q[(i + 3) % 4], b = q[(i + 1) % 4];
    const ax = a.x - o.x, ay = a.y - o.y, bx = b.x - o.x, by = b.y - o.y;
    const cos = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);
    const ang = (Math.acos(clamp(cos, -1, 1)) * 180) / Math.PI;
    if (ang < 50 || ang > 130) return false;
  }
  const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const t = len(q[0], q[1]), r = len(q[1], q[2]), b = len(q[2], q[3]), l = len(q[3], q[0]);
  const r1 = t / (b || 1), r2 = r / (l || 1);
  return r1 > 0.4 && r1 < 2.5 && r2 > 0.4 && r2 < 2.5;
}

function expandQuad(q, d) {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4, cy = q.reduce((s, p) => s + p.y, 0) / 4;
  const rad = q.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / 4 || 1;
  const f = 1 + d / rad;
  return q.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f }));
}

// Aus einer Maske das beste blattförmige Viereck bestimmen.
function bestQuadFromMask(mask, w, h, margin, dbg, tag) {
  const { label, comps } = components(mask, w, h, w * h * 0.04, 3);
  let best = null;
  const diag = Math.hypot(w, h);
  for (const c of comps) {
    const reg = describeRegion(label, c.id, w, h);
    const note = (why, extra) => { if (dbg) dbg.push({ tag, area: +(c.area / (w * h)).toFixed(3), why, ...extra }); };
    if (reg.pts.length < 8) { note('zu klein'); continue; }
    const hull = convexHull(reg.pts);
    if (hull.length < 4) { note('keine Hülle'); continue; }
    const quad = reduceToQuad(hull, diag * 0.6);
    if (!quad) { note('kein Viereck'); continue; }
    const qArea = polyArea(quad);
    const ratio = qArea / (w * h);
    if (ratio < 0.08 || ratio > 1.3) { note('Fläche', { ratio: +ratio.toFixed(2) }); continue; }
    const fill = clamp(reg.area / qArea, 0, 1);
    if (fill < 0.78) { note('Füllgrad', { fill: +fill.toFixed(2), ratio: +ratio.toFixed(2) }); continue; }
    let sorted = sortCorners(quad);
    if (!quadValid(sorted)) { note('Winkel/Seiten', { fill: +fill.toFixed(2), ratio: +ratio.toFixed(2) }); continue; }
    sorted = expandQuad(sorted, margin);
    // Ecken, die weit ausserhalb des Bildes liegen, deuten auf ein angeschnittenes Blatt
    let out = 0;
    for (const p of sorted) if (p.x < -0.04 * w || p.x > 1.04 * w || p.y < -0.04 * h || p.y > 1.04 * h) out++;
    const score = fill * fill * Math.sqrt(Math.min(ratio, 1)) * (out ? 0.8 : 1);
    if (!best || score > best.score) best = { corners: sorted, score, fill, area: Math.min(ratio, 1) };
  }
  return best;
}

// Kanten, Schliessen kleiner Lücken, dann alles, was vom Bildrand aus nicht erreichbar ist.
export function enclosedMask(gray, w, h, rd) {
  const n = w * h;
  const mag = new Uint16Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1];
      const gy = gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1];
      const m = Math.abs(gx) + Math.abs(gy);
      mag[i] = m;
    }
  }
  const thr = 24;
  let edge = new Uint8Array(n);
  for (let i = 0; i < n; i++) edge[i] = mag[i] >= thr ? 1 : 0;
  // Dilatation (rd Pixel) in zwei getrennten Durchläufen
  const tmp = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -rd; k <= rd && !v; k++) { const xx = x + k; if (xx >= 0 && xx < w && edge[y * w + xx]) v = 1; }
      tmp[y * w + x] = v;
    }
  }
  const dil = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = -rd; k <= rd && !v; k++) { const yy = y + k; if (yy >= 0 && yy < h && tmp[yy * w + x]) v = 1; }
      dil[y * w + x] = v;
    }
  }
  edge = dil;
  // Hintergrund vom Rand aus fluten
  const reached = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i) => { if (!edge[i] && !reached[i]) { reached[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < n - w) push(p + w);
  }
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = !edge[i] && !reached[i] ? 1 : 0;
  return mask;
}

// Hauptfunktion. img: { data (RGBA), width, height }. Gibt Ecken in Pixeln des übergebenen Bildes zurück
// (links oben, rechts oben, rechts unten, links unten) oder null.
export function detectDocument(img, dbg) {
  const { width: w, height: h, data } = img;
  const maxSide = Math.max(w, h);
  const gray = boxBlur(toGray(data, w, h), w, h, Math.max(1, Math.round(maxSide / 200)));
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const t0 = otsu(hist, w * h);
  let acc = 0, p98 = 255;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > w * h * 0.02) { p98 = i; break; } }
  const thresholds = [t0];
  const t1 = Math.round(t0 + (p98 - t0) * 0.45);
  if (t1 - t0 >= 12) thresholds.push(t1);

  let best = null;
  const consider = (c) => { if (c && (!best || c.score > best.score)) best = c; };
  for (const T of thresholds) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = gray[i] >= T ? 1 : 0;
    consider(bestQuadFromMask(mask, w, h, 0, dbg, 'hell>' + T));
  }
  const rd = Math.max(1, Math.round(maxSide / 320));
  consider(bestQuadFromMask(enclosedMask(gray, w, h, rd), w, h, rd + 0.5, dbg, 'kanten'));
  return best;
}

export function defaultCorners(w, h, inset = 0.05) {
  const dx = w * inset, dy = h * inset;
  return [{ x: dx, y: dy }, { x: w - dx, y: dy }, { x: w - dx, y: h - dy }, { x: dx, y: h - dy }];
}

export function fullCorners(w, h) {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

// Abbildung vom Einheitsquadrat auf ein Viereck (Heckbert).
export function squareToQuad(q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, hh = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    hh = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + hh * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + hh * p3.y, f: p0.y,
    g, h: hh,
  };
}

// Viereck leicht nach innen ziehen (Anteil der Grösse), damit kein Rand des Untergrunds im Scan bleibt.
export function shrinkQuad(q, frac) {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4, cy = q.reduce((s, p) => s + p.y, 0) / 4;
  const f = 1 - frac;
  return q.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f }));
}

export function outputSize(corners, maxSide) {
  const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let W = (len(corners[0], corners[1]) + len(corners[3], corners[2])) / 2;
  let H = (len(corners[0], corners[3]) + len(corners[1], corners[2])) / 2;
  // Nahe am A4-Seitenverhältnis: genau auf A4 einrasten
  const long = Math.max(W, H), short = Math.min(W, H);
  if (short > 0 && Math.abs(long / short - 1.4142) / 1.4142 < 0.07) {
    if (W >= H) H = W / 1.4142; else W = H / 1.4142;
  }
  const s = Math.min(1, maxSide / Math.max(W, H));
  return { W: Math.max(64, Math.round(W * s)), H: Math.max(64, Math.round(H * s)) };
}

// Schattenfreie Hintergrundschätzung (Raster, Maximum-Filter, Weichzeichnen)
function estimateBackground(lum, w, h) {
  const s = Math.max(4, Math.round(Math.max(w, h) / 300));
  const sw = Math.ceil(w / s), sh = Math.ceil(h / s);
  const small = new Float32Array(sw * sh);
  for (let cy = 0; cy < sh; cy++) {
    for (let cx = 0; cx < sw; cx++) {
      let sum = 0, cnt = 0;
      const y1 = Math.min(h, (cy + 1) * s), x1 = Math.min(w, (cx + 1) * s);
      for (let y = cy * s; y < y1; y += 2) for (let x = cx * s; x < x1; x += 2) { sum += lum[y * w + x]; cnt++; }
      small[cy * sw + cx] = cnt ? sum / cnt : 255;
    }
  }
  const rm = 12;
  const tmp = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      let m = 0;
      for (let k = Math.max(0, x - rm); k <= Math.min(sw - 1, x + rm); k++) if (small[y * sw + k] > m) m = small[y * sw + k];
      tmp[y * sw + x] = m;
    }
  }
  const mx = new Float32Array(sw * sh);
  for (let x = 0; x < sw; x++) {
    for (let y = 0; y < sh; y++) {
      let m = 0;
      for (let k = Math.max(0, y - rm); k <= Math.min(sh - 1, y + rm); k++) if (tmp[k * sw + x] > m) m = tmp[k * sw + x];
      mx[y * sw + x] = m;
    }
  }
  let cur = mx;
  for (let pass = 0; pass < 2; pass++) {
    const hz = new Float32Array(sw * sh), out = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += cur[y * sw + clamp(x + k, 0, sw - 1)];
      hz[y * sw + x] = sum / 7;
    }
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += hz[clamp(y + k, 0, sh - 1) * sw + x];
      out[y * sw + x] = sum / 7;
    }
    cur = out;
  }
  return { grid: cur, sw, sh, s };
}

function sampleBg(bg, x, y) {
  const fx = clamp(x / bg.s - 0.5, 0, bg.sw - 1), fy = clamp(y / bg.s - 0.5, 0, bg.sh - 1);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(bg.sw - 1, x0 + 1), y1 = Math.min(bg.sh - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const g = bg.grid, sw = bg.sw;
  return (g[y0 * sw + x0] * (1 - tx) + g[y0 * sw + x1] * tx) * (1 - ty) + (g[y1 * sw + x0] * (1 - tx) + g[y1 * sw + x1] * tx) * ty;
}

// mode: 'doc' (Schwarzweiss-Dokument), 'color' (Farbe, Schatten entfernt), 'orig' (nichts)
export function enhance(imageData, mode) {
  if (mode === 'orig') return;
  const { data, width: w, height: h } = imageData;
  const lum = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  const bg = estimateBackground(lum, w, h);
  if (mode === 'color') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ratio = 255 / Math.max(40, sampleBg(bg, x, y));
        const j = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) data[j + c] = clamp(((data[j + c] * ratio - 25) * 255) / 210, 0, 255);
      }
    }
    return;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const n = Math.min(255, (lum[i] * 255) / Math.max(40, sampleBg(bg, x, y)));
      const v = clamp(((n - 60) * 255) / 165, 0, 255);
      const j = i * 4;
      data[j] = data[j + 1] = data[j + 2] = v;
    }
  }
}

// Entzerrt das Viereck des Quellbildes (Canvas) und bereitet es auf. Gibt ein neues Canvas zurück.
export function warpToCanvas(srcCanvas, corners, { mode = 'doc', maxSide = 2480 } = {}) {
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const src = srcCanvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, sw, sh).data;
  const { W, H } = outputSize(corners, maxSide);
  const m = squareToQuad(shrinkQuad(corners, 0.003));
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d', { willReadFrequently: true });
  const dst = octx.createImageData(W, H);
  const o = dst.data;
  const maxX = sw - 1, maxY = sh - 1;
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      const wq = m.g * u + m.h * v + 1;
      let fx = (m.a * u + m.b * v + m.c) / wq - 0.5;
      let fy = (m.d * u + m.e * v + m.f) / wq - 0.5;
      fx = fx < 0 ? 0 : fx > maxX ? maxX : fx;
      fy = fy < 0 ? 0 : fy > maxY ? maxY : fy;
      const x0 = fx | 0, y0 = fy | 0;
      const x1 = x0 < maxX ? x0 + 1 : x0, y1 = y0 < maxY ? y0 + 1 : y0;
      const tx = fx - x0, ty = fy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      const k = (y * W + x) * 4;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      o[k] = src[i00] * w00 + src[i10] * w10 + src[i01] * w01 + src[i11] * w11;
      o[k + 1] = src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11;
      o[k + 2] = src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11;
      o[k + 3] = 255;
    }
  }
  enhance(dst, mode);
  octx.putImageData(dst, 0, 0);
  return out;
}
