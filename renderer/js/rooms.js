// 벽으로 둘러싼 공간 자동 찾기 (기존 앱 v21): 벽 중심선을 교차점에서 끊어 평면 그래프를 만들고,
// 각 변에서 "가장 오른쪽으로 꺾기"로 돌면서 닫힌 면(공간)을 모은다. 바깥 테두리 면은 뺀다.
const key = (x, y) => `${Math.round(x / 5) * 5},${Math.round(y / 5) * 5}`;
export function findFaces(walls, minArea = 1e6) {
  const segs = walls.map((w) => [[w.x1, w.y1], [w.x2, w.y2]]).filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 50);
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
