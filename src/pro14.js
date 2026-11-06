/* v17 · PDF · 도면 이미지 불러오기 (스캔 · 캐드), 계정 AI 키, 앱 아이콘 · 시작 로딩 화면 */
var BYR_ICON = 'data:image/png;base64,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';
/* ---- 도면 이미지 분석 (선 · 두꺼운 벽 · 기둥 · 못 읽은 그림) : 순수 함수 ---- */
function planScan(g, W, H, opt) {
  opt = opt || {};
  var N = W * H, ink = new Uint8Array(N), th = opt.th || 150, i, x, y;
  for (i = 0; i < N; i++) ink[i] = g[i] < th ? 1 : 0;
  // 1px 구멍 메우기 (스캔 잡티)
  var ink2 = ink.slice();
  for (y = 1; y < H - 1; y++) for (x = 1; x < W - 1; x++) { i = y * W + x; if (!ink[i] && ((ink[i - 1] && ink[i + 1]) || (ink[i - W] && ink[i + W]))) ink2[i] = 1; }
  ink = ink2;
  var hr = new Uint16Array(N), vr = new Uint16Array(N);
  for (y = 0; y < H; y++) { var o = y * W; x = 0; while (x < W) { if (!ink[o + x]) { x++; continue; } var s = x; while (x < W && ink[o + x]) x++; var L = Math.min(65535, x - s); for (var k = s; k < x; k++) hr[o + k] = L; } }
  for (x = 0; x < W; x++) { y = 0; while (y < H) { if (!ink[y * W + x]) { y++; continue; } var s2 = y; while (y < H && ink[y * W + x]) y++; var L2 = Math.min(65535, y - s2); for (var k2 = s2; k2 < y; k2++) vr[k2 * W + x] = L2; } }
  // 선 두께 분포 → 얇은 선 · 벽 두께
  var longL = Math.max(30, Math.round(Math.max(W, H) / 120)), hist = new Float64Array(80), tot = 0, mxg = Math.round(W * 0.07), myg = Math.round(H * 0.07);
  for (y = myg; y < H - myg; y++) for (x = mxg; x < W - mxg; x++) { i = y * W + x; if (!ink[i]) continue; var a = hr[i], b = vr[i], mx = a > b ? a : b, mn = a < b ? a : b; if (mx >= longL && mn < 80) { hist[mn]++; tot++; } }
  var thin = 1; for (var t = 1; t <= 4; t++) if (hist[t] > hist[thin]) thin = t;
  var thinLen = hist[thin] / thin;
  // 벽 두께: 얇은 선의 두 배보다 두꺼운 것 중 길이(픽셀수/두께)가 가장 긴 두께
  var wallT = 0, best = 0;
  for (t = 2 * thin + 2; t < 60; t++) { var sc = (hist[t] + (hist[t - 1] + (hist[t + 1] || 0)) * 0.5) / t; if (sc > thinLen * 0.04 && sc > best) { best = sc; wallT = t; } }
  var tk = wallT ? Math.max(2 * thin + 1, Math.floor(wallT * 0.6)) : 2 * thin + 2;
  var K = new Uint8Array(N); for (i = 0; i < N; i++) if (ink[i] && Math.min(hr[i], vr[i]) >= tk) K[i] = 1;
  var wt = wallT || tk + 1;
  // 두꺼운 가로 덩어리 → 사각형
  function rects(M, w, h, minRun) {
    var out = [], act = [];
    for (var yy = 0; yy < h; yy++) {
      var runs = [], off = yy * w, xx = 0;
      while (xx < w) { if (!M[off + xx]) { xx++; continue; } var ss = xx; while (xx < w && M[off + xx]) xx++; if (xx - ss >= minRun) runs.push([ss, xx - 1]); }
      var nact = [];
      for (var r of runs) {
        var hit = null;
        for (var A of act) { if (A.used) continue; var ov = Math.min(A.x1, r[1]) - Math.max(A.x0, r[0]); if (ov > 0.7 * Math.min(A.x1 - A.x0, r[1] - r[0])) { hit = A; break; } }
        if (hit) { hit.used = true; hit.y1 = yy; hit.sx0 += r[0]; hit.sx1 += r[1]; hit.n++; hit.x0 = Math.min(hit.x0, r[0]); hit.x1 = Math.max(hit.x1, r[1]); nact.push(hit); }
        else nact.push({ x0: r[0], x1: r[1], y0: yy, y1: yy, sx0: r[0], sx1: r[1], n: 1, used: true });
      }
      for (var A2 of act) if (!A2.used) out.push(A2);
      for (var A3 of nact) A3.used = false; act = nact;
    }
    return out.concat(act).map(function (R) { return { x0: R.sx0 / R.n, x1: R.sx1 / R.n, y0: R.y0, y1: R.y1 + 1, n: R.n }; });
  }
  var minRun = Math.max(4, Math.round(wt * 1.3));
  var RH = rects(K, W, H, minRun);
  var KT = new Uint8Array(N); for (y = 0; y < H; y++) for (x = 0; x < W; x++) KT[x * H + y] = K[y * W + x];
  var RV = rects(KT, H, W, minRun).map(function (R) { return { x0: R.y0, x1: R.y1, y0: R.x0, y1: R.x1, n: R.n, v: 1 }; });
  var segs = [], cols = [], blobs = [];
  function fillOf(R) { var n = 0, a = 0; for (var yy = Math.floor(R.y0); yy < R.y1; yy++) for (var xx = Math.floor(R.x0); xx <= R.x1; xx++) { a++; if (K[yy * W + xx]) n++; } return n / Math.max(1, a); }
  for (var R of RH) {
    var tH = R.y1 - R.y0, len = R.x1 - R.x0;
    if (tH >= tk && len >= Math.max(2.6 * tH, 3 * wt) && tH <= wt * 2.6) segs.push({ x1: R.x0, y1: (R.y0 + R.y1) / 2, x2: R.x1, y2: (R.y0 + R.y1) / 2, t: tH, o: 'h' });
    else if (tH >= 0.75 * wt && len / tH > 0.6 && len / tH < 1.6 && tH < wt * 9 && fillOf(R) > 0.85) cols.push({ x: (R.x0 + R.x1) / 2, y: (R.y0 + R.y1) / 2, w: len, d: tH });
    else if (tH > wt * 2.6 && len > wt * 2.6) blobs.push({ x0: R.x0, y0: R.y0, x1: R.x1, y1: R.y1, why: '채움 · 빗금' });
  }
  for (var Q of RV) {
    var tV = Q.x1 - Q.x0, lenV = Q.y1 - Q.y0;
    if (tV >= tk && lenV >= Math.max(2.6 * tV, 3 * wt) && tV <= wt * 2.6) segs.push({ x1: (Q.x0 + Q.x1) / 2, y1: Q.y0, x2: (Q.x0 + Q.x1) / 2, y2: Q.y1, t: tV, o: 'v' });
  }
  // 두 줄로 그린 벽 (가는 평행선 한 쌍)
  var thinMax = thin + 2, Lseg = Math.max(24, wt * 3), TH = new Uint8Array(N), TV = new Uint8Array(N);
  for (i = 0; i < N; i++) { if (!ink[i] || K[i]) continue; if (hr[i] >= Lseg && vr[i] <= thinMax) TH[i] = 1; if (vr[i] >= Lseg && hr[i] <= thinMax) TV[i] = 1; }
  var TVT = new Uint8Array(N); for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (TV[y * W + x]) TVT[x * H + y] = 1;
  var LH = rects(TH, W, H, Lseg).filter(function (R) { return R.y1 - R.y0 <= thinMax + 1; }).map(function (R) { return { a: R.x0, b: R.x1, c: (R.y0 + R.y1) / 2 }; });
  var LV = rects(TVT, H, W, Lseg).filter(function (R) { return R.y1 - R.y0 <= thinMax + 1; }).map(function (R) { return { a: R.x0, b: R.x1, c: (R.y0 + R.y1) / 2 }; });
  var maxSp = Math.max(thin * 2 + 3, wt * 1.6), minSp = thin + 1.5;
  function pairs(L, o) {
    L.sort(function (p, q) { return p.c - q.c; }); var cand = [], out = [];
    var hatch = L.map(function (A, i) { var n = 0; for (var j = 0; j < L.length; j++) { if (j === i) continue; var B = L[j]; if (Math.abs(B.c - A.c) > maxSp * 2.2) continue; if (Math.min(A.b, B.b) - Math.max(A.a, B.a) > 0.5 * Math.min(A.b - A.a, B.b - B.a)) n++; } return n >= 3; });
    for (var i = 0; i < L.length; i++) { if (hatch[i]) continue; for (var j = i + 1; j < L.length; j++) { if (hatch[j]) continue; var A = L[i], B = L[j], d = B.c - A.c; if (d > maxSp) break; if (d < minSp) continue;
      var ov0 = Math.max(A.a, B.a), ov1 = Math.min(A.b, B.b), ov = ov1 - ov0; if (ov < Math.max(Lseg, 0.6 * Math.min(A.b - A.a, B.b - B.a))) continue; cand.push({ i: i, j: j, d: d, a: ov0, b: ov1, ov: ov }); } }
    cand.sort(function (p, q) { return q.ov - p.ov || p.d - q.d; }); var used = {};
    for (var C of cand) { if (used[C.i] || used[C.j]) continue; used[C.i] = used[C.j] = 1; var c = (L[C.i].c + L[C.j].c) / 2, t = C.d + thin;
      out.push(o === 'h' ? { x1: C.a, y1: c, x2: C.b, y2: c, t: t, o: 'h', dbl: 1 } : { x1: c, y1: C.a, x2: c, y2: C.b, t: t, o: 'v', dbl: 1 }); }
    return out;
  }
  var dbl = pairs(LH, 'h').concat(pairs(LV, 'v'));
  // 이미 두꺼운 벽이 있는 자리는 빼기
  dbl = dbl.filter(function (d) { return !segs.some(function (s) { if (s.o !== d.o) return false; var ax = d.o === 'h' ? 'y1' : 'x1', lo = d.o === 'h' ? 'x1' : 'y1', hi = d.o === 'h' ? 'x2' : 'y2'; return Math.abs(s[ax] - d[ax]) < (s.t + d.t) / 2 && Math.min(s[hi], d[hi]) - Math.max(s[lo], d[lo]) > 0.5 * (d[hi] - d[lo]); }); });
  segs = segs.concat(dbl);
  // 같은 줄 위의 조각 잇기 (틈이 두께 정도면 한 벽)
  segs = mergeCollinear(segs, function (a, b) { return Math.max(a.t, b.t) * 1.2; });
  // 종이 테두리 · 표제란 지우기
  var edge = 0.045, frame = [];
  segs = segs.filter(function (s) {
    var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), nearEdge = s.o === 'h' ? (s.y1 < H * edge || s.y1 > H * (1 - edge)) : (s.x1 < W * edge || s.x1 > W * (1 - edge));
    var huge = s.o === 'h' ? len > W * 0.86 : len > H * 0.86, nearEdge2 = s.o === 'h' ? (s.y1 < H * 0.095 || s.y1 > H * 0.905) : (s.x1 < W * 0.095 || s.x1 > W * 0.905), longish = len > (s.o === 'h' ? W : H) * 0.3;
    if (nearEdge || huge || (nearEdge2 && longish)) { frame.push(s); return false; } return true;
  });
  // 길고 외톨이인 선 (다른 벽이 닿지 않음) = 종이 테두리
  (function () { var keep = [];
    for (var s of segs) { var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), dim = s.o === 'h' ? W : H; if (len < dim * 0.2) { keep.push(s); continue; }
      var tol = wt * 2.5, n = 0;
      for (var q of segs) { if (q === s || q.o === s.o) continue; for (var e of [[q.x1, q.y1], [q.x2, q.y2]]) { if (s.o === 'h' ? (Math.abs(e[1] - s.y1) < tol + q.t && e[0] > s.x1 - tol && e[0] < s.x2 + tol) : (Math.abs(e[0] - s.x1) < tol + q.t && e[1] > s.y1 - tol && e[1] < s.y2 + tol)) n++; } }
      if (n >= 2) keep.push(s); else frame.push(s); }
    segs = keep; })();
  // 가는 긴 선 (치수선 · 그리드 · 창 · 이중선 벽) 표시
  var Lline = Math.max(40, wt * 8), LM = new Uint8Array(N), thinSegs = [];
  for (y = 0; y < H; y++) { var o2 = y * W; for (x = 0; x < W; x++) { i = o2 + x; if (ink[i] && !K[i] && hr[i] >= Lline) LM[i] = 1; if (ink[i] && !K[i] && vr[i] >= Lline) LM[i] = 1; } }
  // 남은 잉크 = 못 읽은 선 · 그림
  var used = new Uint8Array(N), pad = Math.ceil(wt * 0.8) + 1;
  function mark(x0, y0, x1, y1) { x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1)); for (var yy = y0; yy <= y1; yy++) used.fill(1, yy * W + x0, yy * W + x1 + 1); }
  for (var s3 of segs.concat(frame)) { var h2 = s3.t / 2 + pad; mark(Math.min(s3.x1, s3.x2) - h2, Math.min(s3.y1, s3.y2) - h2, Math.max(s3.x1, s3.x2) + h2, Math.max(s3.y1, s3.y2) + h2); }
  for (var c of cols) mark(c.x - c.w / 2 - pad, c.y - c.d / 2 - pad, c.x + c.w / 2 + pad, c.y + c.d / 2 + pad);
  var lab = new Int32Array(N), comps = [], stack = new Int32Array(N), textMax = Math.max(12, wt * 3.2);
  for (i = 0; i < N; i++) {
    if (!ink[i] || used[i] || LM[i] || lab[i]) continue;
    var id = comps.length + 1, sp = 0, cx0 = 1e9, cy0 = 1e9, cx1 = -1, cy1 = -1, n = 0; stack[sp++] = i; lab[i] = id;
    while (sp) { var p = stack[--sp], px = p % W, py = (p - px) / W; n++; if (px < cx0) cx0 = px; if (px > cx1) cx1 = px; if (py < cy0) cy0 = py; if (py > cy1) cy1 = py;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue; var q = qy * W + qx; if (ink[q] && !used[q] && !LM[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; } } }
    comps.push({ x0: cx0, y0: cy0, x1: cx1 + 1, y1: cy1 + 1, n: n });
  }
  // 치수선 거르기: 두 줄 벽 바로 옆에 숫자(작은 글자 덩어리)가 줄지어 있으면 벽이 아니라 치수선
  (function () { var small = comps.filter(function (c) { var w = c.x1 - c.x0, h = c.y1 - c.y0; return Math.max(w, h) <= textMax && Math.max(w, h) >= 3; }).map(function (c) { return [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]; });
    var keep = [];
    for (var s of segs) { if (!s.dbl) { keep.push(s); continue; } var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = 0;
      for (var q of small) { var along = s.o === 'h' ? q[0] : q[1], off = Math.abs(s.o === 'h' ? q[1] - s.y1 : q[0] - s.x1), lo = s.o === 'h' ? s.x1 : s.y1, hi = s.o === 'h' ? s.x2 : s.y2; if (along >= lo && along <= hi && off > s.t / 2 + 1 && off < wt * 4.5) n++; }
      if (n / Math.max(1, len / (10 * wt)) >= 1.2 && n >= 3) frame.push(Object.assign({ dim: 1 }, s)); else keep.push(s); }
    segs = keep; })();
  var objs = comps.filter(function (c) { var w = c.x1 - c.x0, h = c.y1 - c.y0; return Math.max(w, h) > textMax && c.n > wt * 6; });
  var text = comps.length - objs.length;
  // 겹치거나 가까운 덩어리 묶기
  var gapM = wt * 1.0; objs = clusterBoxes(objs.concat(blobs), gapM, wt * 14);
  objs.forEach(function (o) { o.fill = o.n / Math.max(1, (o.x1 - o.x0) * (o.y1 - o.y0)); });
  return { W: W, H: H, thin: thin, wallT: wallT, tk: tk, walls: segs, cols: cols, objs: objs, frame: frame, text: text, ink: ink, LM: LM };
}
function mergeCollinear(segs, gapFn) {
  var H = segs.filter(function (s) { return s.o === 'h'; }).sort(function (a, b) { return a.y1 - b.y1 || a.x1 - b.x1; }),
      V = segs.filter(function (s) { return s.o === 'v'; }).sort(function (a, b) { return a.x1 - b.x1 || a.y1 - b.y1; }), out = [];
  function run(arr, ax, lo, hi) {
    var done = new Array(arr.length).fill(false);
    for (var i = 0; i < arr.length; i++) {
      if (done[i]) continue; var A = Object.assign({}, arr[i]); done[i] = true; var changed = true;
      while (changed) { changed = false;
        for (var j = 0; j < arr.length; j++) { if (done[j]) continue; var B = arr[j];
          if (Math.abs(A[ax] - B[ax]) > Math.max(A.t, B.t) * 0.6) continue;
          var gap = Math.max(B[lo], A[lo]) - Math.min(B[hi], A[hi]); if (gap > gapFn(A, B)) continue;
          var la = A[hi] - A[lo], lb = B[hi] - B[lo], tot = la + lb || 1; A[ax] = (A[ax] * la + B[ax] * lb) / tot; A.t = (A.t * la + B.t * lb) / tot;
          A[lo] = Math.min(A[lo], B[lo]); A[hi] = Math.max(A[hi], B[hi]); done[j] = true; changed = true; }
      }
      if (ax === 'y1') A.y2 = A.y1; else A.x2 = A.x1; out.push(A);
    }
  }
  run(H, 'y1', 'x1', 'x2'); run(V, 'x1', 'y1', 'y2');
  return out;
}
function clusterBoxes(bs, gap, lim) {
  lim = lim || 1e9;
  var out = bs.map(function (b) { return Object.assign({}, b); }), merged = true;
  while (merged) { merged = false;
    for (var i = 0; i < out.length; i++) for (var j = i + 1; j < out.length; j++) { var a = out[i], b = out[j];
      if (a.x0 - gap > b.x1 || b.x0 - gap > a.x1 || a.y0 - gap > b.y1 || b.y0 - gap > a.y1) continue;
      if (Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0) > lim || Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0) > lim) continue;
      a.x0 = Math.min(a.x0, b.x0); a.y0 = Math.min(a.y0, b.y0); a.x1 = Math.max(a.x1, b.x1); a.y1 = Math.max(a.y1, b.y1); a.n = (a.n || 0) + (b.n || 0); if (b.why) a.why = a.why || b.why; out.splice(j, 1); j--; merged = true; } }
  return out;
}
/* 벽 무리: 서로 가까운 벽끼리 묶고, 큰 무리(건물)만 남기기 → 도면 영역 */
function planRegion(sc) {
  var ws = sc.walls; if (!ws.length) return null; var tol = Math.max(sc.W, sc.H) * 0.03, grp = ws.map(function (_, i) { return i; });
  function f(i) { while (grp[i] !== i) i = grp[i] = grp[grp[i]]; return i; }
  function bb(w) { return [Math.min(w.x1, w.x2), Math.min(w.y1, w.y2), Math.max(w.x1, w.x2), Math.max(w.y1, w.y2)]; }
  for (var i = 0; i < ws.length; i++) for (var j = i + 1; j < ws.length; j++) { var a = bb(ws[i]), b = bb(ws[j]); if (a[0] - tol > b[2] || b[0] - tol > a[2] || a[1] - tol > b[3] || b[1] - tol > a[3]) continue; grp[f(i)] = f(j); }
  var G = {}; ws.forEach(function (w, i) { var r = f(i); (G[r] = G[r] || { L: 0, ids: [] }); G[r].L += Math.hypot(w.x2 - w.x1, w.y2 - w.y1); G[r].ids.push(i); });
  var arr = Object.values(G).sort(function (a, b) { return b.L - a.L; }), keep = arr.filter(function (g) { return g.L >= arr[0].L * 0.12 && g.ids.length >= 3; }); if (!keep.length) keep = [arr[0]];
  var box = [1e9, 1e9, -1e9, -1e9], lenOf = function (w) { return Math.hypot(w.x2 - w.x1, w.y2 - w.y1); }, maxL = 0; keep.forEach(function (g) { g.ids.forEach(function (i) { maxL = Math.max(maxL, lenOf(ws[i])); }); });
  keep.forEach(function (g) { g.ids.forEach(function (i) { if (lenOf(ws[i]) < maxL * 0.15) return; var b = bb(ws[i]), h = ws[i].t / 2; box[0] = Math.min(box[0], b[0] - h); box[1] = Math.min(box[1], b[1] - h); box[2] = Math.max(box[2], b[2] + h); box[3] = Math.max(box[3], b[3] + h); }); });
  // 바깥벽 = 같은 줄 위에 벽이 가장 많이 쌓인 줄 (튀어나온 치수선 · 그리드 조각은 무시)
  var wt = sc.wallT || 8, ids = []; keep.forEach(function (g) { ids = ids.concat(g.ids); });
  function strong(o) { var arr = ids.map(function (i) { return ws[i]; }).filter(function (w) { return w.o === o; }).map(function (w) { return { c: o === 'v' ? w.x1 : w.y1, L: lenOf(w) }; }).sort(function (a, b) { return a.c - b.c; }), G = [];
    for (var a of arr) { var g = G[G.length - 1]; if (g && a.c - g.last <= wt * 1.5) { g.L += a.L; g.cs += a.c * a.L; g.last = a.c; } else G.push({ L: a.L, cs: a.c * a.L, last: a.c }); }
    var mx = Math.max.apply(null, G.map(function (g) { return g.L; }).concat([0])), S = G.filter(function (g) { return g.L >= mx * 0.3; }).map(function (g) { return g.cs / g.L; }); return S.length >= 2 ? [S[0], S[S.length - 1]] : null; }
  var sx = strong('v'), sy = strong('h'), pad = wt * 2.5;
  if (sx) { box[0] = Math.max(box[0], sx[0] - pad); box[2] = Math.min(box[2], sx[1] + pad); }
  if (sy) { box[1] = Math.max(box[1], sy[0] - pad); box[3] = Math.min(box[3], sy[1] + pad); }
  var m = (sc.wallT || 8) * 2; return [Math.max(0, box[0] - m), Math.max(0, box[1] - m), Math.min(sc.W, box[2] + m), Math.min(sc.H, box[3] + m)];
}

/* ---- PDF 엔진 (pdf.js · 필요할 때만 CDN에서) ---- */
var PDFJS_SRCS = [
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/']];
async function loadPdfJs() {
  if (window._pdfjs) return window._pdfjs;
  var list = window.PDFJS_LOCAL ? [window.PDFJS_LOCAL].concat(PDFJS_SRCS) : PDFJS_SRCS;
  for (var pair of list) {
    try { var lib = await import(pair[0]); if (!globalThis.pdfjsWorker) globalThis.pdfjsWorker = await import(pair[1]); lib.GlobalWorkerOptions.workerSrc = pair[1]; window._pdfjs = lib; window._pdfjsBase = pair[2]; return lib; }
    catch (e) { console.warn('pdf.js', pair[0], e); }
  }
  throw new Error('PDF 읽기 도구를 불러오지 못했어요 · 인터넷 연결을 확인하세요');
}

/* ---- 상태 ---- */
var PDFI = { pages: [], cur: 0, mode: '', fresh: false };
var PDF_FIX = null; // AI 기물 종류 (처음 열 때 만듦)
function pdfFixTypes() {
  if (PDF_FIX) return PDF_FIX; var ids = new Set(LIB.map(function (l) { return l.id; }));
  PDF_FIX = AI_TYPES.concat(['toilet', 'washbasin', 'shower', 'bathtub', 'sink3', 'handsink', 'waste', 'homesink', 'washer']).filter(function (t, i, a) { return ids.has(t) && a.indexOf(t) === i; });
  return PDF_FIX;
}
function pdfKeyState() {
  var c = SYNC.cfg || {}, k = c.aiKey || BUILT.anthropicKey || '';
  if (k) return { ok: true, t: (c.aiAcct && c.email ? `${c.email} 계정의 키` : '이 기기에 넣은 키') + ' · …' + k.slice(-4) };
  if (window.claude && window.claude.use) return { ok: true, t: 'Claude 안에서 열어 따로 키가 필요 없어요' };
  return { ok: false, t: '키 없음 · 계정 창에서 Anthropic 키를 넣으세요' };
}
function openPdfIn(fresh) {
  PDFI = { pages: [], cur: 0, mode: '', fresh: !!fresh }; $('#pdfPages').innerHTML = ''; $('#pdfAsk').hidden = true; $('#pdfOk').disabled = true; $('#pdfName').textContent = '벽 · 기둥 · 문을 선에서 읽어요 · 스캔한 도면도 돼요';
  $('#pdfInfo').textContent = 'PDF나 도면 사진을 고르세요.'; const ks = pdfKeyState(); $('#pdfAi').checked = ks.ok; $('#pdfAiState').textContent = ks.t; $('#pdfReplace').checked = fresh || !(P.walls && P.walls.length);
  const c = $('#pdfCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); $('#pdfFile').value = ''; $('#pdfDlg').showModal();
}
async function pdfLoadFile(f) {
  if (!f) return; $('#pdfName').textContent = f.name; $('#pdfInfo').textContent = '여는 중…'; PDFI.pages = [];
  try {
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
      const lib = await loadPdfJs(), B = window._pdfjsBase || '', doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), wasmUrl: B + 'wasm/', cMapUrl: B + 'cmaps/', cMapPacked: true, standardFontDataUrl: B + 'standard_fonts/', iccUrl: B + 'iccs/' }).promise;
      for (let i = 1; i <= Math.min(doc.numPages, 20); i++) PDFI.pages.push({ n: i, on: i === 1, doc, rot: 0 });
    } else {
      const url = await fileURL(f), im = await new Promise((res, rej) => { const m = new Image(); m.onload = () => res(m); m.onerror = rej; m.src = url; });
      PDFI.pages.push({ n: 1, on: true, img: im, rot: 0 });
    }
  } catch (e) { $('#pdfInfo').textContent = '열지 못했어요: ' + ((e && e.message) || e); return; }
  if (PDFI.pages.length > 1) PDFI.pages.forEach((p) => (p.on = true));
  pdfRenderPages(); await pdfShow(0);
}
function pdfRenderPages() {
  const many = PDFI.pages.length > 1;
  $('#pdfPages').innerHTML = many ? PDFI.pages.map((p, i) => `<span class="chip ${i === PDFI.cur ? 'on' : ''}"><input type="checkbox" data-pgon="${i}" ${p.on ? 'checked' : ''} aria-label="${p.n}쪽 넣기"><button data-pgv="${i}">${p.n}쪽 → ${pdfTarget(i)}</button></span>`).join('') : '';
}
function pdfTarget(i) { const on = PDFI.pages.map((p, j) => (p.on ? j : -1)).filter((j) => j >= 0), k = on.indexOf(i); if (k < 0) return '안 넣음'; if (k === 0) return curLevel() ? curLevel().name : '지금 층'; return `새 층 ${(P.levels || []).length + k}층`; }

/* 페이지를 그림으로 → 흑백 배열 → 분석 */
async function pdfRaster(p) {
  let cv = document.createElement('canvas'), g;
  if (p.doc) {
    const pg = await p.doc.getPage(p.n), v1 = pg.getViewport({ scale: 1 }), s = Math.min(4.5, 3000 / Math.max(v1.width, v1.height)), vp = pg.getViewport({ scale: s });
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height); g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: g, viewport: vp }).promise;
    p.ptW = v1.width; p.pxScale = s;
    try { const tc = await pg.getTextContent(), txt = tc.items.map((t) => t.str).join(' '); p.text = txt; const m = txt.match(/(?:SCALE|S\s*=|축\s*척)[^0-9]{0,6}1\s*[\/:]\s*(\d{2,4})/i); p.scaleN = m ? +m[1] : 0; p.vector = tc.items.length > 20 && /[가-힣A-Za-z]{2}/.test(txt) && !(await pdfIsScan(pg)); } catch (e) { p.scaleN = 0; }
  } else {
    const im = p.img, s = Math.min(1, 3200 / Math.max(im.width, im.height)); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s);
    g = cv.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height);
  }
  if (p.rot) { const r = document.createElement('canvas'), q = p.rot % 360; r.width = q % 180 ? cv.height : cv.width; r.height = q % 180 ? cv.width : cv.height; const rg = r.getContext('2d', { willReadFrequently: true }); rg.translate(r.width / 2, r.height / 2); rg.rotate(q * Math.PI / 180); rg.drawImage(cv, -cv.width / 2, -cv.height / 2); cv = r; g = rg; }
  const W = cv.width, H = cv.height, d = g.getImageData(0, 0, W, H).data, gray = new Uint8Array(W * H);
  // 밝기 → 흑백 (사진이면 밝기 차이를 키움)
  let sum = 0; for (let i = 0, j = 0; i < gray.length; i++, j += 4) { const v = (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11) | 0; gray[i] = v; sum += v; }
  p.cv = cv; p.W = W; p.H = H; p.gray = gray; p.thr = Math.min(170, Math.max(90, (sum / gray.length) * 0.72));
}
async function pdfIsScan(pg) { try { const ops = await pg.getOperatorList(), O = window._pdfjs.OPS; let img = 0, path = 0; for (const f of ops.fnArray) { if (f === O.paintImageXObject || f === O.paintInlineImageXObject) img++; else if (f === O.constructPath) path++; } return img > 0 && path < 30; } catch (e) { return false; } }
async function pdfAnalyze(p) {
  if (!p.sc) { if (!p.gray) await pdfRaster(p); p.sc = planScan(p.gray, p.W, p.H, { th: p.thr }); p.region = planRegion(p.sc) || [0, 0, p.W, p.H]; p.gray = null; }
  if (!p.mmpp) {
    if (p.scaleN && p.vector) { p.mmpp = 25.4 / 72 / p.pxScale * p.scaleN; p.mmSrc = `도면 글자의 축척 1/${p.scaleN}`; }
    else { p.mmpp = 200 / Math.max(3, p.sc.wallT || 8); p.mmSrc = '짐작한 치수예요 · "두 점 찍어 치수 맞추기"로 27,000 같은 치수선 양 끝을 찍어 주세요'; p.guess = true; }
  }
  p.built = pdfBuild(p);
}

/* ---- 픽셀 → mm, 문 틈 찾기, 모서리 잇기 ---- */
function pdfBuild(p) {
  const sc = p.sc, r = p.region, k = p.mmpp, inR = (x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
  const r10 = (v) => Math.round(v / 10) * 10, objs = sc.objs.filter((o) => inR((o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2)).map((o) => ({ ...o, read: false }));
  let ws = sc.walls.filter((w) => inR((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2)).map((w) => ({ x1: clamp(w.x1, r[0], r[2]), y1: clamp(w.y1, r[1], r[3]), x2: clamp(w.x2, r[0], r[2]), y2: clamp(w.y2, r[1], r[3]), t: w.t, o: w.o }));
  if (p.ai && p.ai.walls && ws.length < 3) ws = p.ai.walls.map((w) => { const h = Math.abs(w.y2 - w.y1) < Math.abs(w.x2 - w.x1); return { x1: Math.min(w.x1, w.x2), y1: h ? (w.y1 + w.y2) / 2 : Math.min(w.y1, w.y2), x2: Math.max(w.x1, w.x2), y2: h ? (w.y1 + w.y2) / 2 : Math.max(w.y1, w.y2), t: (w.t_mm || 200) / k, o: h ? 'h' : 'v' }; }).map((w) => (w.o === 'h' ? w : { ...w, x1: (w.x1 + w.x2) / 2, x2: (w.x1 + w.x2) / 2 }));
  // 같은 줄 조각들 → 틈 분류
  const ops = [], out = [], LM = sc.LM, W = sc.W;
  for (const o of ['h', 'v']) {
    const ax = o === 'h' ? 'y1' : 'x1', lo = o === 'h' ? 'x1' : 'y1', hi = o === 'h' ? 'x2' : 'y2';
    const arr = ws.filter((w) => w.o === o).sort((a, b) => a[ax] - b[ax] || a[lo] - b[lo]), done = new Set();
    for (let i = 0; i < arr.length; i++) {
      if (done.has(i)) continue; const line = [arr[i]]; done.add(i);
      for (let j = i + 1; j < arr.length; j++) { if (done.has(j)) continue; if (Math.abs(arr[j][ax] - line[0][ax]) <= Math.max(arr[j].t, line[0].t) * 0.6) { line.push(arr[j]); done.add(j); } }
      line.sort((a, b) => a[lo] - b[lo]); let A = { ...line[0], ops: [] };
      for (let q = 1; q < line.length; q++) {
        const B = line[q], gapPx = B[lo] - A[hi], gap = gapPx * k, tmm = Math.max(A.t, B.t) * k;
        const cIn = sc.cols.some((c) => (o === 'h' ? Math.abs(c.y - A[ax]) < c.d / 2 + A.t && c.x > A[hi] - A.t && c.x < B[lo] + A.t : Math.abs(c.x - A[ax]) < c.w / 2 + A.t && c.y > A[hi] - A.t && c.y < B[lo] + A.t));
        let join = gap <= Math.max(2 * tmm, 450) || (cIn && gap <= 1600), op = null;
        if (!join && gap >= 550 && gap <= 2600) {
          const c = A[ax], g0 = A[hi], g1 = B[lo], reach = gapPx * 1.1 + A.t;
          const box = o === 'h' ? [g0, c - reach, g1, c + reach] : [c - reach, g0, c + reach, g1];
          const arc = objs.find((ob) => { if (ob.read || !(ob.x0 < box[2] && ob.x1 > box[0] && ob.y0 < box[3] && ob.y1 > box[1]) || (ob.fill || 0) >= 0.4) return false; const m = Math.max(ob.x1 - ob.x0, ob.y1 - ob.y0); return m > gapPx * 0.45 && m < gapPx * 1.7; });
          if (arc) { arc.read = true; join = true; op = { type: gap > 1300 ? 'door2' : 'door1', at: (g0 + g1) / 2, w: gap }; }
          else if (LM) { let hit = 0, n = 0; for (let s = g0 + 2; s < g1 - 2; s += 2) { n++; let f = false; for (let dd = -A.t / 2; dd <= A.t / 2; dd++) { const x = Math.round(o === 'h' ? s : c + dd), y = Math.round(o === 'h' ? c + dd : s); if (LM[y * W + x]) { f = true; break; } } if (f) hit++; } if (n && hit / n > 0.7) { join = true; op = { type: gap > 2300 ? 'full' : 'window', at: (g0 + g1) / 2, w: gap }; } }
        }
        if (join) { if (op) A.ops.push(op); const la = A[hi] - A[lo], lb = B[hi] - B[lo]; A.t = (A.t * la + B.t * lb) / (la + lb || 1); A[hi] = Math.max(A[hi], B[hi]); }
        else { out.push(A); A = { ...B, ops: [] }; }
      }
      out.push(A);
    }
  }
  // mm 좌표 (도면 영역 왼쪽 위가 0)
  let walls = out.map((w) => ({ x1: (w.x1 - r[0]) * k, y1: (w.y1 - r[1]) * k, x2: (w.x2 - r[0]) * k, y2: (w.y2 - r[1]) * k, t: clamp(r10(w.t * k), 80, 600), ops: w.ops.map((o) => ({ ...o, at: ((o.at - (w.o === 'h' ? r[0] : r[1])) * k) - (w.o === 'h' ? (w.x1 - r[0]) * k : (w.y1 - r[1]) * k), w: r10(o.w) })), px: w }))
    .filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= 300);
  pdfJoin(walls);
  const cols = sc.cols.filter((c) => inR(c.x, c.y)).map((c) => ({ x: (c.x - r[0]) * k, y: (c.y - r[1]) * k, w: r10(c.w * k), d: r10(c.d * k), px: c })).filter((c) => c.w >= 150 && c.w <= 1600 && c.d >= 150 && c.d <= 1600);
  // AI 결과 (mm로)
  const ai = p.ai || {}, P2 = (x, y) => [(x - r[0]) * k, (y - r[1]) * k];
  const aiOps = (ai.openings || []).filter((o) => OPDEF[o.type]).map((o) => ({ ...o, mm: P2(o.x, o.y) }));
  for (const o of aiOps) { // 가장 가까운 벽에 (이미 문이 있으면 건너뜀)
    let best = null; for (const w of walls) { const [d, t] = distPtSeg(o.mm[0], o.mm[1], w); if (d < Math.max(600, w.t * 2) && (!best || d < best.d)) best = { d, w, t }; }
    if (!best) continue; const L = Math.hypot(best.w.x2 - best.w.x1, best.w.y2 - best.w.y1), at = best.t * L; if (best.w.ops.some((q) => Math.abs(q.at - at) < 700)) continue; best.w.ops.push({ type: o.type, at, w: r10(clamp(+o.w_mm || OPDEF[o.type][0], 500, Math.min(L - 100, 5000))) });
  }
  const fix = (ai.fixtures || []).filter((f) => pdfFixTypes().includes(f.type)).map((f) => ({ type: f.type, mm: P2(f.x, f.y), w: +f.w_mm || 0, d: +f.d_mm || 0, rot: +f.rot || 0 }));
  const drains = (ai.drains || []).filter((f) => ['drain', 'trench', 'cleanout', 'trap'].includes(f.type)).map((f) => ({ type: f.type, mm: P2(f.x, f.y), w: +f.w_mm || 0, rot: +f.rot || 0 }));
  const pipes = (ai.pipes || []).filter((q) => q.pts && q.pts.length > 1).map((q) => ({ kind: { drain: 'embDrain', water: 'embWater', gas: 'embGas' }[q.kind] || 'embDrain', pts: q.pts.map((pt) => P2(pt[0], pt[1])) }));
  const unread = objs.filter((o) => !o.read).map((o) => ({ x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1, why: o.why || '' }));
  for (const u of ai.unreadable || []) unread.push({ x0: u.x - 8, y0: u.y - 8, x1: u.x + 8, y1: u.y + 8, why: u.note || 'AI가 못 읽음' });
  const nOps = walls.reduce((s, w) => s + w.ops.length, 0);
  const wpts = walls.flatMap((w) => [[w.x1, w.y1], [w.x2, w.y2]]), wbb = wpts.length ? aabb(wpts) : [0, 0, (r[2] - r[0]) * k, (r[3] - r[1]) * k];
  return { walls, cols, fix, drains, pipes, unread, nOps, H: +ai.wall_height_mm || 0, mat: ai.wall_material || '', wbW: wbb[2] - wbb[0], wbH: wbb[3] - wbb[1] };
}
function pdfJoin(walls) {
  const isect = (a, b) => { const d1 = [a.x2 - a.x1, a.y2 - a.y1], d2 = [b.x2 - b.x1, b.y2 - b.y1], den = d1[0] * d2[1] - d1[1] * d2[0]; if (!(Math.abs(den) > 1e-6 * Math.hypot(...d1) * Math.hypot(...d2))) return null; const t = ((b.x1 - a.x1) * d2[1] - (b.y1 - a.y1) * d2[0]) / den, q = [a.x1 + d1[0] * t, a.y1 + d1[1] * t]; return isFinite(q[0]) && isFinite(q[1]) ? q : null; };
  for (const a of walls) for (const [ax, ay] of [['x1', 'y1'], ['x2', 'y2']]) {
    let best = null;
    for (const b of walls) { if (b === a) continue; const p = isect(a, b); if (!p) continue; const dEnd = Math.hypot(p[0] - a[ax], p[1] - a[ay]); if (!(dEnd <= Math.max(a.t, b.t) * 1.6 + 60)) continue;
      const L = Math.hypot(b.x2 - b.x1, b.y2 - b.y1); if (L < 1) continue; const tb = ((p[0] - b.x1) * (b.x2 - b.x1) + (p[1] - b.y1) * (b.y2 - b.y1)) / (L * L); if (tb < -(a.t * 1.6 / L) - .02 || tb > 1 + a.t * 1.6 / L + .02) continue;
      if (!best || dEnd < best.d) best = { d: dEnd, p }; }
    if (best) { const L0 = Math.hypot(a.x2 - a.x1, a.y2 - a.y1); if (ax === 'x1') { const sh = Math.hypot(best.p[0] - a.x1, best.p[1] - a.y1) * Math.sign((a.x1 - best.p[0]) * (a.x2 - a.x1) + (a.y1 - best.p[1]) * (a.y2 - a.y1) || 1); a.ops.forEach((o) => (o.at += sh)); } a[ax] = best.p[0]; a[ay] = best.p[1]; }
  }
  for (const w of walls) for (const q of ['x1', 'y1', 'x2', 'y2']) w[q] = Math.round(w[q]);
  for (let i = walls.length - 1; i >= 0; i--) { const w = walls[i]; if (![w.x1, w.y1, w.x2, w.y2].every(isFinite) || Math.hypot(w.x2 - w.x1, w.y2 - w.y1) < 200) walls.splice(i, 1); }
}

/* ---- AI로 읽기 (문 · 기물 · 배수 · 배관 · 축척) ---- */
async function pdfAskAI(p) {
  const r = p.region, cw = r[2] - r[0], ch = r[3] - r[1], s = Math.min(1, 1568 / Math.max(cw, ch)), c = document.createElement('canvas');
  c.width = Math.round(cw * s); c.height = Math.round(ch * s); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(p.cv, r[0], r[1], cw, ch, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
  const types = pdfFixTypes().map((t) => `${t}(${libGet(t).name})`).join(', '), ops = Object.keys(OPDEF).map((t) => `${t}(${OPENTYPES[t]})`).join(', ');
  const prompt = `This is an architectural floor plan drawing (it may be a scan or rotated). Read it carefully and answer with JSON only.
All coordinates are fractions 0..1 of THIS image: x = left→right, y = top→bottom.
{"scale_ref":{"x1":0,"y1":0,"x2":0,"y2":0,"mm":0},
 "wall_height_mm":null, "wall_material":null,
 "walls":[{"x1":0,"y1":0,"x2":0,"y2":0,"t_mm":200}],
 "openings":[{"type":"door1","x":0,"y":0,"w_mm":900}],
 "fixtures":[{"type":"toilet","x":0,"y":0,"w_mm":0,"d_mm":0,"rot":0}],
 "drains":[{"type":"drain","x":0,"y":0,"w_mm":0,"rot":0}],
 "pipes":[{"kind":"drain","pts":[[0,0],[0,0]]}],
 "unreadable":[{"x":0,"y":0,"note":""}]}
Rules:
- scale_ref: the two end points of the longest dimension line whose number you can read clearly, and that number in mm (e.g. "27,000" → 27000). null if none.
- wall_height_mm only if a wall or ceiling height is written (CH, 천장고, 벽높이). wall_material only if written: "concrete", "gypsum", "brick" or "glass".
- walls: straight wall centre lines with thickness. openings: centre point of each door/window on its wall; type is one of ${ops}.
- fixtures: plumbing and kitchen fixtures drawn as symbols; type is one of ${types}. rot in degrees (0,90,180,270).
- drains: floor drains, trench drains, clean-outs, grease traps (type drain|trench|cleanout|trap). pipes: visible drain / water / gas pipe runs (kind drain|water|gas) as polylines.
- unreadable: centre of every symbol, line or drawing you can see but cannot identify with confidence, with a short Korean note. Never guess a type — put it in unreadable instead.
- Ignore the title block, grid bubbles, dimension text and the paper border.`;
  const res = await pdfVision(prompt, blob), X = (v) => r[0] + clamp(+v || 0, 0, 1) * cw, Y = (v) => r[1] + clamp(+v || 0, 0, 1) * ch;
  const map = (o) => ({ ...o, x: X(o.x), y: Y(o.y) }), ai = {
    walls: (res.walls || []).map((w) => ({ ...w, x1: X(w.x1), y1: Y(w.y1), x2: X(w.x2), y2: Y(w.y2) })), openings: (res.openings || []).map(map), fixtures: (res.fixtures || []).map(map), drains: (res.drains || []).map(map),
    pipes: (res.pipes || []).map((q) => ({ ...q, pts: (q.pts || []).map((pt) => [X(pt[0]), Y(pt[1])]) })), unreadable: (res.unreadable || []).map(map), wall_height_mm: res.wall_height_mm, wall_material: res.wall_material };
  const sr = res.scale_ref; if (sr && +sr.mm > 0) { const d = Math.hypot(X(sr.x2) - X(sr.x1), Y(sr.y2) - Y(sr.y1)); if (d > 20) { ai.mmpp = +sr.mm / d; ai.ref = sr; } }
  p.ai = ai; if (ai.mmpp && !p.cal) { p.mmpp = ai.mmpp; p.mmSrc = `AI가 읽은 치수 ${(+sr.mm).toLocaleString()}mm 기준`; p.guess = false; }
  p.built = pdfBuild(p);
}
async function pdfVision(prompt, blob) {
  const s = await getSample();
  if (s) { const lim = await s.limits().catch(() => null); if (lim && lim.images) return await s.json(prompt, { images: [blob], modelTier: 'complex' }); }
  const key = SYNC.cfg.aiKey || BUILT.anthropicKey; if (!key) throw new Error('AI 키가 없어요 · 계정 창에서 Anthropic 키를 넣어 주세요');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: BUILT.aiModel || 'claude-sonnet-5-5', max_tokens: 12000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await blobB64(blob) } }, { type: 'text', text: prompt }] }] }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error((j.error && j.error.message) || 'AI 응답 ' + r.status);
  const t = (j.content || []).map((c) => c.text || '').join(''); return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
}

/* ---- 미리보기 ---- */
async function pdfShow(i) {
  PDFI.cur = i; pdfRenderPages(); const p = PDFI.pages[i]; if (!p) return;
  $('#pdfInfo').textContent = `${p.n}쪽 읽는 중…`; await new Promise((r) => setTimeout(r, 30));
  try { await pdfAnalyze(p); } catch (e) { $('#pdfInfo').textContent = '읽지 못했어요: ' + ((e && e.message) || e); return; }
  pdfSyncFields(); pdfDraw(); $('#pdfOk').disabled = false;
  if ($('#pdfAi').checked && !p.ai && !p.aiErr) pdfRunAI(p);
}
async function pdfRunAI(p) {
  p.aiBusy = true; pdfDraw(); const msg = $('#pdfInfo').textContent;
  $('#pdfInfo').textContent = msg + ' · AI가 문 · 기물 · 배수를 읽는 중…';
  try { await pdfAskAI(p); p.aiErr = ''; } catch (e) { p.aiErr = (e && e.code === 'not_granted') ? '허용하지 않아 AI는 건너뛰었어요' : (e && e.message) || 'AI가 읽지 못했어요'; }
  p.aiBusy = false; if (PDFI.pages[PDFI.cur] === p) { pdfSyncFields(); pdfDraw(); }
}
function pdfSyncFields() {
  const p = PDFI.pages[PDFI.cur]; if (!p || !p.built) return; const r = p.region, b = p.built;
  $('#pdfWmm').value = Math.round(b.wbW / 10) * 10;
  const unread = b.unread.length;
  $('#pdfInfo').innerHTML = `${esc(p.n + '쪽')} · 벽 <b>${b.walls.length}</b> · 문·창 <b>${b.nOps}</b> · 기둥 <b>${b.cols.length}</b>${b.fix.length ? ` · 기물 <b>${b.fix.length}</b>` : ''}${b.drains.length ? ` · 배수 <b>${b.drains.length}</b>` : ''}${b.pipes.length ? ` · 배관 <b>${b.pipes.length}</b>` : ''} · 못 읽음 <b class="${unread ? 'bad' : ''}">${unread}</b><br><small>건물 ${(Math.round(b.wbW / 100) / 10).toLocaleString()} × ${(Math.round(b.wbH / 100) / 10).toLocaleString()} m · ${esc(p.mmSrc || '')}${p.aiBusy ? ' · AI 읽는 중…' : p.aiErr ? ' · ' + esc(p.aiErr) : p.ai ? ' · AI 읽음' : ''}</small>`;
  $('#pdfWmm').classList.toggle('warnfld', !!p.guess);
}
function pdfDraw() {
  const p = PDFI.pages[PDFI.cur], c = $('#pdfCv'); if (!p || !p.cv) return;
  const box = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); c.width = Math.round((box.width || 900) * dpr); c.height = Math.round((box.height || 560) * dpr);
  const g = c.getContext('2d'), s = Math.min(c.width / p.W, c.height / p.H), ox = (c.width - p.W * s) / 2, oy = (c.height - p.H * s) / 2; PDFI.view = { s, ox, oy, dpr };
  const T = (x, y) => [ox + x * s, oy + y * s];
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(p.cv, ox, oy, p.W * s, p.H * s);
  const r = p.region; g.fillStyle = 'rgba(20,24,34,.35)'; g.beginPath(); g.rect(0, 0, c.width, c.height); g.rect(...T(r[0], r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s); g.fill('evenodd');
  g.strokeStyle = '#7d5cff'; g.lineWidth = 2 * dpr; g.setLineDash([6 * dpr, 4 * dpr]); g.strokeRect(...T(r[0], r[1]), (r[2] - r[0]) * s, (r[3] - r[1]) * s); g.setLineDash([]);
  const b = p.built; if (!b) return; const k = p.mmpp, M = (x, y) => T(r[0] + x / k, r[1] + y / k);
  g.lineCap = 'round';
  for (const w of b.walls) { g.strokeStyle = 'rgba(30,190,90,.85)'; g.lineWidth = Math.max(2 * dpr, w.t / k * s); g.beginPath(); g.moveTo(...M(w.x1, w.y1)); g.lineTo(...M(w.x2, w.y2)); g.stroke();
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1), ux = (w.x2 - w.x1) / L, uy = (w.y2 - w.y1) / L;
    for (const o of w.ops) { g.strokeStyle = o.type === 'window' || o.type === 'full' ? '#2aa8ff' : '#ff9f0a'; g.lineWidth = Math.max(3 * dpr, w.t / k * s + 2 * dpr); g.beginPath(); g.moveTo(...M(w.x1 + ux * (o.at - o.w / 2), w.y1 + uy * (o.at - o.w / 2))); g.lineTo(...M(w.x1 + ux * (o.at + o.w / 2), w.y1 + uy * (o.at + o.w / 2))); g.stroke(); } }
  if ($('#pdfCols').checked) { g.fillStyle = 'rgba(0,110,255,.85)'; for (const q of b.cols) { const [x, y] = M(q.x, q.y); g.fillRect(x - q.w / k * s / 2 - dpr, y - q.d / k * s / 2 - dpr, q.w / k * s + 2 * dpr, q.d / k * s + 2 * dpr); } }
  g.fillStyle = '#b05cff'; for (const f of b.fix) { const [x, y] = M(f.mm[0], f.mm[1]); g.beginPath(); g.arc(x, y, 4 * dpr, 0, 7); g.fill(); }
  g.fillStyle = '#18c1b0'; for (const f of b.drains) { const [x, y] = M(f.mm[0], f.mm[1]); g.beginPath(); g.arc(x, y, 4 * dpr, 0, 7); g.fill(); }
  g.strokeStyle = '#18c1b0'; g.lineWidth = 2 * dpr; g.setLineDash([5 * dpr, 3 * dpr]); for (const q of b.pipes) { g.beginPath(); q.pts.forEach((pt, i) => g[i ? 'lineTo' : 'moveTo'](...M(pt[0], pt[1]))); g.stroke(); } g.setLineDash([]);
  g.strokeStyle = 'rgba(255,59,48,.9)'; g.lineWidth = 1.5 * dpr; for (const u of b.unread) g.strokeRect(...T(u.x0 - 2, u.y0 - 2), (u.x1 - u.x0 + 4) * s, (u.y1 - u.y0 + 4) * s);
  if (PDFI.calPts) { g.strokeStyle = '#ff2d55'; g.fillStyle = '#ff2d55'; g.lineWidth = 2 * dpr; const q = PDFI.calPts.map((pt) => T(pt[0], pt[1])); q.forEach((pt) => { g.beginPath(); g.arc(pt[0], pt[1], 5 * dpr, 0, 7); g.fill(); }); if (q.length === 2) { g.beginPath(); g.moveTo(...q[0]); g.lineTo(...q[1]); g.stroke(); } }
  if (PDFI.drag) { const d = PDFI.drag; g.strokeStyle = '#7d5cff'; g.lineWidth = 2 * dpr; g.strokeRect(...T(Math.min(d[0], d[2]), Math.min(d[1], d[3])), Math.abs(d[2] - d[0]) * s, Math.abs(d[3] - d[1]) * s); }
}
function pdfPt(e) { const c = $('#pdfCv'), b = c.getBoundingClientRect(), v = PDFI.view; return [((e.clientX - b.left) * v.dpr - v.ox) / v.s, ((e.clientY - b.top) * v.dpr - v.oy) / v.s]; }
function pdfRebuild() { const p = PDFI.pages[PDFI.cur]; if (!p || !p.sc) return; p.built = pdfBuild(p); pdfSyncFields(); pdfDraw(); }

/* ---- 도면에 넣기 ---- */
async function pdfApply(force) {
  const on = PDFI.pages.filter((p) => p.on); if (!on.length) { toast('넣을 쪽을 고르세요'); return; }
  $('#pdfOk').disabled = true;
  for (const p of on) { if (!p.built) { $('#pdfInfo').textContent = `${p.n}쪽 읽는 중…`; await new Promise((r) => setTimeout(r, 20)); await pdfAnalyze(p); } if ($('#pdfAi').checked && !p.ai && !p.aiErr) await pdfRunAI(p); }
  $('#pdfOk').disabled = false;
  const unread = on.reduce((s, p) => s + p.built.unread.length, 0), guess = on.some((p) => p.guess);
  if (!force && unread) { $('#pdfAskSub').textContent = `읽지 못한 선 · 그림 ${unread}곳 (빨간 네모)은 빼고, 확인된 벽 · 문 · 기둥${on.some((p) => p.ai) ? ' · 기물 · 배수' : ''}만 넣어요.${guess ? ' 치수가 짐작값이니 가로 길이를 확인하세요.' : ''}`; $('#pdfAsk').hidden = false; $('#pdfAsk').scrollIntoView({ block: 'nearest' }); return; }
  $('#pdfAsk').hidden = true;
  const Hdef = Math.max(2000, +$('#pdfH').value || 2700), matSel = $('#pdfMat').value, wantCols = $('#pdfCols').checked, replace = $('#pdfReplace').checked, bgOn = $('#pdfBg').checked;
  let n = 0;
  for (let i = 0; i < on.length; i++) {
    const p = on[i], b = p.built, data = pdfLevelData(p, b, Hdef, matSel, wantCols, bgOn);
    if (i === 0) {
      if (replace) { P.walls = []; P.openings = []; P.items = []; P.lines = []; }
      const off = !replace && P.walls.length ? (() => { const bb = bounds(); return [bb[2] + 3000, bb[1]]; })() : [0, 0];
      pdfShift(data, off); P.walls.push(...data.walls); P.openings.push(...data.openings); P.items.push(...data.items); P.lines.push(...data.lines); if (bgOn && data.bg) { P.bg = data.bg; bgImg = new Image(); bgImg.onload = () => draw2d(); bgImg.src = data.bg.src; }
      if (data.H && Math.abs(data.H - (P.ceilingH || 2700)) > 5 && replace) P.ceilingH = data.H;
    } else {
      ensureLevels(); const top = [...P.levels].sort((x, y) => (y.elev || 0) - (x.elev || 0))[0], topData = top.id === P.levelId ? levelPick() : top.data;
      P.levels.push({ id: uid('L'), name: `${P.levels.length + 1}층`, elev: (top.elev || 0) + (topData.slabH || P.slabH || 3300), data: { walls: data.walls, openings: data.openings, items: data.items, lines: data.lines, sketches: [], photos: [], scenes: [],
        ceilingH: data.H || P.ceilingH || 2700, soffitH: P.soffitH || 2400, slabH: P.slabH || 3300, floor: { type: 'epoxy', color: '#c9c3b8' }, ceiling: { on: false, opacity: 0.45, color: '#f4f2ee' }, floorOpacity: 1, room: null, bg: bgOn ? data.bg : null } });
      P.showLinked = true;
    }
    n += data.walls.length;
  }
  commit(); fit2d(); draw2d(); cam3dDefault(); dirty3d = true; if (typeof renderLevels === 'function') renderLevels(); $('#pdfDlg').close();
  toast(`벽 ${n}개${on.length > 1 ? ` · ${on.length}개 층` : ''}을 넣었어요${on.some((p) => p.guess) ? ' · 치수는 짐작값이에요' : ''}`);
}
function pdfLevelData(p, b, Hdef, matSel, wantCols, bgOn) {
  const H = b.H || Hdef, mat = { concrete: 'concrete', gypsum: 'gypsum', brick: 'brick', glass: 'paint' }[b.mat] || matSel, col = { concrete: '#b9b6af', gypsum: '#f1efea', brick: '#a8553c', paint: '#ece8e1' }[mat] || '#b9b6af';
  const ceil = P.ceilingH || 2700, walls = [], openings = [], items = [], lines = [];
  // 벽 묶음의 왼쪽 위를 0으로 (층끼리 맞추기)
  const all = b.walls.flatMap((w) => [[w.x1, w.y1], [w.x2, w.y2]]), bb = all.length ? aabb(all) : [0, 0, 0, 0], dx = -bb[0], dy = -bb[1];
  for (const w of b.walls) {
    const nw = { id: uid('w'), x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy, finish: { type: mat, color: col }, _pdf: 1 }; if (Math.abs(w.t - (P.wallT || 150)) > 5) nw.t = w.t; if (Math.abs(H - ceil) > 5) nw.h = H; walls.push(nw);
    const L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
    for (const o of w.ops) { const d = OPDEF[o.type], ow = Math.round(clamp(o.w, 400, L - 50)); if (ow < 400) continue; openings.push({ id: uid('o'), wall: nw.id, t: Math.round(clamp(o.at, ow / 2, L - ow / 2)), type: o.type, w: ow, h: Math.min(d[1], H - 100), sill: d[2], frame: '#2b2d31', fw: std().frameW }); }
  }
  if (wantCols) for (const c of b.cols) items.push({ id: uid('i'), type: 'column', x: Math.round(c.x + dx), y: Math.round(c.y + dy), w: c.w, d: c.d, rot: 0, h: H, note: 'PDF 도면 · 기둥', _pdf: 1 });
  for (const f of b.fix) { const sz = libSize(f.type); items.push({ id: uid('i'), type: f.type, x: Math.round(f.mm[0] + dx), y: Math.round(f.mm[1] + dy), w: Math.round(clamp(f.w || sz.w, 150, 6000)), d: Math.round(clamp(f.d || sz.d, 150, 4000)), rot: ((Math.round(f.rot / 90) * 90) % 360 + 360) % 360, note: 'PDF 도면 · AI', _pdf: 1 }); }
  for (const f of b.drains) { const sz = libSize(f.type); items.push({ id: uid('i'), type: f.type, x: Math.round(f.mm[0] + dx), y: Math.round(f.mm[1] + dy), w: Math.round(clamp(f.w || sz.w, 100, 6000)), d: sz.d, rot: ((Math.round(f.rot / 90) * 90) % 360 + 360) % 360, note: 'PDF 도면 · 배수', _pdf: 1 }); }
  // 도면에 보이는 배관 → 바닥 아래 (매립) 레이어
  for (const q of b.pipes) lines.push({ id: uid('l'), kind: q.kind, pts: q.pts.map((pt) => [Math.round(pt[0] + dx), Math.round(pt[1] + dy)]), depth: Math.max(50, lineOpts.depth || 80), note: 'PDF 도면', _pdf: 1 });
  // 배수구 · 트렌치 자리에도 바닥 아래 배수관 짧게 (어디로 빠지는지 보이게)
  for (const f of b.drains) if (!b.pipes.length && (f.type === 'drain' || f.type === 'trench')) { const x = Math.round(f.mm[0] + dx), y = Math.round(f.mm[1] + dy); lines.push({ id: uid('l'), kind: 'embDrain', pts: [[x, y], [x, y + 600]], depth: Math.max(50, lineOpts.depth || 80), note: 'PDF 도면 · 배수 연결 (확인 필요)', _pdf: 1 }); }
  let bg = null;
  if (bgOn) { const r = p.region, cw = r[2] - r[0], ch = r[3] - r[1], s = Math.min(1, 1600 / Math.max(cw, ch)), c = document.createElement('canvas'); c.width = Math.round(cw * s); c.height = Math.round(ch * s); c.getContext('2d').drawImage(p.cv, r[0], r[1], cw, ch, 0, 0, c.width, c.height); bg = { src: c.toDataURL('image/jpeg', 0.6), wmm: Math.round(cw * p.mmpp), x: Math.round(dx), y: Math.round(dy), opacity: 0.45 }; }
  return { walls, openings, items, lines, bg, H: b.H || 0 };
}
function pdfShift(d, off) { if (!off[0] && !off[1]) return; const [ox, oy] = off; for (const w of d.walls) { w.x1 += ox; w.x2 += ox; w.y1 += oy; w.y2 += oy; } for (const it of d.items) { it.x += ox; it.y += oy; } for (const l of d.lines) l.pts = l.pts.map((p) => [p[0] + ox, p[1] + oy]); if (d.bg) { d.bg.x += ox; d.bg.y += oy; } }

/* ---- 화면 연결 ---- */
$('#pdfFile').addEventListener('change', (e) => pdfLoadFile(e.target.files[0]));
$('#pdfPages').addEventListener('click', (e) => { const v = e.target.closest('[data-pgv]'), c = e.target.closest('[data-pgon]'); if (c) { PDFI.pages[+c.dataset.pgon].on = c.checked; pdfRenderPages(); } if (v) pdfShow(+v.dataset.pgv); });
$('#pdfOk').onclick = () => pdfApply(false);
$('#pdfAskYes').onclick = () => pdfApply(true);
$('#pdfAskNo').onclick = () => { $('#pdfAsk').hidden = true; };
$('#pdfReplace').addEventListener('change', pdfRenderPages);
$('#pdfCols').addEventListener('change', pdfDraw);
$('#pdfAi').addEventListener('change', (e) => { const p = PDFI.pages[PDFI.cur]; if (e.target.checked && p && p.sc && !p.ai) { p.aiErr = ''; pdfRunAI(p); } });
$('#pdfWmm').addEventListener('change', (e) => { const p = PDFI.pages[PDFI.cur], v = +e.target.value; if (!p || !p.built || !(v > 100) || !(p.built.wbW > 1)) return; p.mmpp *= v / p.built.wbW; p.cal = true; p.guess = false; p.mmSrc = '직접 넣은 치수 기준'; for (const q of PDFI.pages) if (q !== p && q.sc && q.guess) { q.mmpp = p.mmpp; q.guess = false; q.mmSrc = `${p.n}쪽 치수와 같게`; q.built = pdfBuild(q); } pdfRebuild(); });
$('#pdfRot').onclick = async () => { const p = PDFI.pages[PDFI.cur]; if (!p) return; p.rot = ((p.rot || 0) + 90) % 360; p.gray = null; p.sc = null; p.built = null; p.ai = null; p.aiErr = ''; await pdfShow(PDFI.cur); };
$('#pdfCal').onclick = () => { PDFI.mode = 'cal'; PDFI.calPts = []; $('#pdfInfo').textContent = '미리보기에서 치수를 아는 두 점을 차례로 누르세요 (예: 27,000 치수선 양 끝)'; };
$('#pdfArea').onclick = () => { PDFI.mode = 'area'; $('#pdfInfo').textContent = '미리보기에서 도면 영역을 끌어서 잡으세요'; };
{ const c = $('#pdfCv');
  c.addEventListener('pointerdown', (e) => { const p = PDFI.pages[PDFI.cur]; if (!p || !PDFI.view) return; const pt = pdfPt(e);
    if (PDFI.mode === 'cal') { PDFI.calPts.push(pt); pdfDraw(); if (PDFI.calPts.length === 2) { PDFI.mode = ''; $('#pdfCalRow').hidden = false; $('#pdfCalMm').value = ''; $('#pdfCalMm').focus(); } return; }
    if (PDFI.mode === 'area') { PDFI.drag = [pt[0], pt[1], pt[0], pt[1]]; c.setPointerCapture(e.pointerId); } });
  c.addEventListener('pointermove', (e) => { if (!PDFI.drag) return; const pt = pdfPt(e); PDFI.drag[2] = pt[0]; PDFI.drag[3] = pt[1]; pdfDraw(); });
  c.addEventListener('pointerup', () => { const d = PDFI.drag, p = PDFI.pages[PDFI.cur]; if (!d || !p) return; PDFI.drag = null; PDFI.mode = ''; const r = [Math.max(0, Math.min(d[0], d[2])), Math.max(0, Math.min(d[1], d[3])), Math.min(p.W, Math.max(d[0], d[2])), Math.min(p.H, Math.max(d[1], d[3]))]; if (r[2] - r[0] > 40 && r[3] - r[1] > 40) { p.region = r; pdfRebuild(); } else pdfDraw(); });
  $('#pdfCalOk').onclick = () => { const p = PDFI.pages[PDFI.cur], mm = +$('#pdfCalMm').value, q = PDFI.calPts || []; if (!p || q.length < 2 || !(mm > 0)) return; const d = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]); if (d < 5) return; p.mmpp = mm / d; p.cal = true; p.guess = false; p.mmSrc = `두 점 ${mm.toLocaleString()}mm 기준`; $('#pdfCalRow').hidden = true; PDFI.calPts = null; for (const o of PDFI.pages) if (o !== p && o.sc && o.guess) { o.mmpp = p.mmpp; o.guess = false; o.mmSrc = `${p.n}쪽 치수와 같게`; o.built = pdfBuild(o); } pdfRebuild(); };
  $('#pdfCalMm').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#pdfCalOk').click(); });
  window.addEventListener('resize', () => { if ($('#pdfDlg').open) pdfDraw(); });
}
// 메뉴 · 명령 · 홈
{ const mm = $('#moreMenu'); mm.insertAdjacentHTML('afterbegin', '<button data-mm="pdfin"><b>PDF 도면 불러오기</b><small>스캔 · 캐드 PDF → 벽 · 문 · 기둥</small></button>'); mm.addEventListener('click', (e) => { if (e.target.closest('[data-mm="pdfin"]')) { e.stopImmediatePropagation(); mm.hidden = true; openPdfIn(false); } }, true); }
{ const _C = CMDS; CMDS = function () { const l = _C(); l.unshift({ g: '프로젝트', n: 'PDF 도면 불러오기', run: () => openPdfIn(false), k: '', kw: 'pdf 도면 스캔 ocr import 불러오기' }); return l; }; }
{ const st = $('#projDlg .starts'); if (st) { st.insertAdjacentHTML('beforeend', '<button class="start" type="button" id="pdfStart"><b>PDF 도면</b><small>벽 · 문 · 기둥 자동으로 읽기</small></button>'); $('#pdfStart').onclick = () => { const p = newProject({ name: 'PDF 도면 ' + new Date().toLocaleDateString('ko-KR'), start: 'empty' }); openProject(p); saveProject(true); $('#projDlg').close(); openPdfIn(true); }; } }
// 파일을 끌어다 놓아도 (PDF)
window.addEventListener('dragover', (e) => { if (e.dataTransfer && [...(e.dataTransfer.items || [])].some((i) => i.type === 'application/pdf')) e.preventDefault(); });
window.addEventListener('drop', (e) => { const f = e.dataTransfer && [...e.dataTransfer.files].find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (!f) return; e.preventDefault(); openPdfIn(false); pdfLoadFile(f); });

/* ---------- 내 계정에 AI 키 저장 (같은 계정이면 어느 기기든 자동) ---------- */
async function aiKeyPull(quiet) {
  if (!SYNC.cfg.access || !SYNC.cfg.user) return;
  try { const r = await sbFetch('/rest/v1/user_secrets?select=ai_key&user_id=eq.' + SYNC.cfg.user), j = await r.json(), k = j && j[0] && j[0].ai_key;
    if (k) { SYNC.cfg.aiKey = k; SYNC.cfg.aiAcct = true; store.set('drs_sync', SYNC.cfg); } SYNC.aiKeyMsg = k ? '' : (SYNC.cfg.aiKey ? '이 기기 키를 쓰는 중 · 계정에는 아직 없어요' : '');
  } catch (e) { SYNC.aiKeyMsg = /404|42P01/.test(String(e.message)) ? '계정 키 보관함이 아직 없어요 · Supabase에서 schema.sql을 다시 Run 하세요' : ''; }
  aiKeyState();
}
async function aiKeyPush(k) {
  if (!SYNC.cfg.access || !SYNC.cfg.user) return false;
  try { await sbFetch('/rest/v1/user_secrets', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: SYNC.cfg.user, ai_key: k || null, updated_at: new Date().toISOString() }) }); SYNC.cfg.aiAcct = !!k; store.set('drs_sync', SYNC.cfg); SYNC.aiKeyMsg = k ? '계정에 저장했어요 · 다른 PC · 폰에서 로그인하면 자동으로 써요' : '계정에서 지웠어요'; }
  catch (e) { SYNC.aiKeyMsg = /404/.test(String(e.message)) ? '계정 키 보관함이 없어요 · Supabase에서 schema.sql을 다시 Run 하세요' : '계정에 저장하지 못했어요: ' + netMsg(e); }
  aiKeyState(); return true;
}
function aiKeyState() { const el = $('#sAiState'); if (!el) return; const c = SYNC.cfg, k = c.aiKey || ''; el.textContent = (k ? `지금 쓰는 키: ${c.aiAcct && c.email ? c.email + ' 계정에 저장된 키' : '이 기기에만 넣은 키'} (…${k.slice(-4)})` : '키 없음') + (SYNC.aiKeyMsg ? ' · ' + SYNC.aiKeyMsg : ''); $('#sAiAcctRow').hidden = !c.access; }
$('#sAi').addEventListener('change', (e) => { SYNC.cfg.aiAcct = false; const k = e.target.value.trim(); if (SYNC.cfg.access && $('#sAiAcct').checked) aiKeyPush(k); else aiKeyState(); });
{ const _rs = renderSync; renderSync = function () { _rs(); aiKeyState(); }; }
{ const _sn = syncNow; syncNow = async function (q) { const r = await _sn(q); if (SYNC.cfg.access && !SYNC._aiPulled) { SYNC._aiPulled = true; await aiKeyPull(true); } return r; }; }
{ const _ts = takeSession; takeSession = function (j) { _ts(j); SYNC._aiPulled = false; }; }

/* ---------- 앱 아이콘 (BYR) · 시작 로딩 화면 ---------- */
(function () {
  try {
    let l = document.querySelector('link[rel="icon"]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); } l.href = BYR_ICON;
    document.querySelectorAll('.brand svg').forEach((s) => { const im = document.createElement('img'); im.src = BYR_ICON; im.alt = ''; im.className = 'byr'; im.width = +s.getAttribute('width') || 20; im.height = im.width; s.replaceWith(im); });
  } catch (e) {}
  const el = document.getElementById('bootSplash'); if (!el) return;
  if (!document.documentElement.classList.contains('appboot')) { el.remove(); return; }
  try { const S = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SplashScreen; if (S && S.hide) S.hide({ fadeOutDuration: 0 }); } catch (e) {}
  // 로딩 화면이 떠 있는 동안 열리는 창(홈 목록 등)은 잠깐 기다렸다가 연다
  const DP = HTMLDialogElement.prototype, orig = DP.showModal, q = [];
  DP.showModal = function () { if (!q.includes(this)) q.push(this); };
  const wait = Math.max(700, 2200 - performance.now());
  setTimeout(() => { DP.showModal = orig; for (const d of q) if (!d.open) try { orig.call(d); } catch (e) {} el.classList.add('out'); setTimeout(() => el.remove(), 600); }, wait);
})();
window.APP_VERSION = 'v17 · 2026-11-06';
