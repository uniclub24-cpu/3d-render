// 벽으로 둘러싼 공간 자동 찾기 (기존 앱 v21): 벽 중심선을 교차점에서 끊어 평면 그래프를 만들고,
// 각 변에서 "가장 오른쪽으로 꺾기"로 돌면서 닫힌 면(공간)을 모은다. 바깥 테두리 면은 뺀다.
const key = (x, y) => `${Math.round(x / 5) * 5},${Math.round(y / 5) * 5}`;
const X = (p, p2, q, q2) => { const r = [p2[0] - p[0], p2[1] - p[1]], s = [q2[0] - q[0], q2[1] - q[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const qp = [q[0] - p[0], q[1] - p[1]]; return { t: (qp[0] * s[1] - qp[1] * s[0]) / den, u: (qp[0] * r[1] - qp[1] * r[0]) / den, Li: Math.hypot(...r), Lj: Math.hypot(...s) }; };
const dSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)); return [Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t), [a[0] + dx * t, a[1] + dy * t]]; };
/**
 * 벽이 조금 떨어져 있어도 닫힌 것으로 본다 (gap mm 까지):
 * ① 끝을 늘이면 다른 벽과 만나면 늘이고 ② 그래도 떠 있는 끝은 가장 가까운 벽 · 끝점에 잇는다
 */
export function closeGaps(segs, gap = 450) {
  const S = segs.map(([a, b]) => [[...a], [...b]]), touch = (p, i) => S.some((q, j) => j !== i && dSeg(p, q[0], q[1])[0] < 25);
  for (let i = 0; i < S.length; i++) for (const e of [0, 1]) { const p = S[i][e]; if (touch(p, i)) continue; let best = null;
    for (let j = 0; j < S.length; j++) { if (j === i) continue; const r = X(S[i][0], S[i][1], S[j][0], S[j][1]); if (!r) continue; const ext = e ? (r.t - 1) * r.Li : -r.t * r.Li, onj = r.u >= -gap / r.Lj && r.u <= 1 + gap / r.Lj;
      if (ext > 0 && ext <= gap && onj && (!best || ext < best.ext)) best = { ext, t: r.t }; }
    if (best) { const a = S[i][0], b = S[i][1]; S[i][e] = [a[0] + (b[0] - a[0]) * best.t, a[1] + (b[1] - a[1]) * best.t]; } }
  const add = [];
  for (let i = 0; i < S.length; i++) for (const e of [0, 1]) { const p = S[i][e]; if (touch(p, i) || add.some(([a, b]) => Math.hypot(a[0] - p[0], a[1] - p[1]) < 5 || Math.hypot(b[0] - p[0], b[1] - p[1]) < 5)) continue; let best = null;
    for (let j = 0; j < S.length; j++) { if (j === i) continue; const [d, q] = dSeg(p, S[j][0], S[j][1]); if (d <= gap && (!best || d < best.d)) best = { d, q }; }
    if (best) add.push([p, best.q]); }
  return [...S, ...add];
}
export function findFaces(walls, minArea = 1e6, gap = 450) {
  let segs = walls.map((w) => [[w.x1, w.y1], [w.x2, w.y2]]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 50);
  if (gap > 0) segs = closeGaps(segs, gap);
  // 1) 교차점 · T 자 접합점에서 자르기
  const cuts = segs.map(() => [0, 1]);
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const [p, p2] = segs[i], [q, q2] = segs[j], r = [p2[0] - p[0], p2[1] - p[1]], s = [q2[0] - q[0], q2[1] - q[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) continue; const qp = [q[0] - p[0], q[1] - p[1]], t = (qp[0] * s[1] - qp[1] * s[0]) / den, u = (qp[0] * r[1] - qp[1] * r[0]) / den;
    const Li = Math.hypot(...r), Lj = Math.hypot(...s), ti = 20 / Li, tj = 20 / Lj; // 끝이 조금 모자라도 붙인다 (20mm)
    if (t >= -ti && t <= 1 + ti && u >= -tj && u <= 1 + tj) { cuts[i].push(Math.min(1, Math.max(0, t))); cuts[j].push(Math.min(1, Math.max(0, u))); }
  }
  const P = new Map(), E = new Map(); // 점 · 이웃
  const pt = (x, y) => { const k = key(x, y); if (!P.has(k)) { P.set(k, [Math.round(x / 5) * 5, Math.round(y / 5) * 5]); E.set(k, new Set()); } return k; };
  segs.forEach(([a, b], i) => { const ts = [...new Set(cuts[i].map((t) => Math.round(t * 1e5) / 1e5))].sort((x, y) => x - y);
    for (let k = 1; k < ts.length; k++) { const A = pt(a[0] + (b[0] - a[0]) * ts[k - 1], a[1] + (b[1] - a[1]) * ts[k - 1]), B = pt(a[0] + (b[0] - a[0]) * ts[k], a[1] + (b[1] - a[1]) * ts[k]); if (A !== B) { E.get(A).add(B); E.get(B).add(A); } } });
  // 2) 반쪽 변을 따라 면 찾기
  const ang = (a, b) => Math.atan2(P.get(b)[1] - P.get(a)[1], P.get(b)[0] - P.get(a)[0]), used = new Set(), faces = [];
  for (const [a, nb] of E) for (const b of nb) {
    if (used.has(a + '>' + b)) continue; const loop = [a]; let u = a, v = b, guard = 0;
    while (guard++ < 2000) { used.add(u + '>' + v); loop.push(v); const back = ang(v, u); let best = null, bd = Infinity;
      for (const w of E.get(v)) { if (w === u && E.get(v).size > 1) continue; let d = ang(v, w) - back; while (d <= 1e-9) d += Math.PI * 2; if (d < bd) { bd = d; best = w; } }
      if (!best) break; u = v; v = best; if (u === a && v === b) break; }
    loop.pop(); if (loop.length < 3) continue;
    const pts = loop.map((k) => P.get(k)); let A = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; } A /= 2;
    faces.push({ pts, area: A });
  }
  // 도면 y 가 아래라 안쪽 면은 한쪽 부호, 바깥 테두리는 반대 부호 → 가장 많은 쪽 부호의 면만
  const pos = faces.filter((f) => f.area > 0), neg = faces.filter((f) => f.area < 0), inner = pos.length >= neg.length ? pos : neg;
  return inner.map((f) => ({ pts: simplify(f.pts), area: Math.abs(f.area) })).filter((f) => f.area >= minArea && f.pts.length >= 3);
}
/** 일직선 위의 점 지우기 */
function simplify(pts) { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]; if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 1000) out.push(b); } return out; }

/** 다각형을 직선(a→b 를 늘인 선)으로 둘로 자르기 → [왼쪽, 오른쪽] (못 자르면 null) */
export function splitPoly(P, a, b) {
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), clip = (sg) => { const out = []; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], sp = side(p) * sg, sq = side(q) * sg; if (sp >= 0) out.push(p); if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push([Math.round(p[0] + (q[0] - p[0]) * t), Math.round(p[1] + (q[1] - p[1]) * t)]); } } return out; };
  const A = clip(1), B = clip(-1), ar = (Q) => { let s = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s / 2); };
  return A.length >= 3 && B.length >= 3 && ar(A) > 1e5 && ar(B) > 1e5 ? [A, B] : null;
}
