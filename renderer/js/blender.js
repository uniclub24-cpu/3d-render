// BYR → 블렌더 실사 렌더 준비: 장면(GLB) + plan.json(카메라 · 조명 · 재질 계획 · 렌더 설정)
// 재질은 BYR 재질 종류(목재 · 스테인리스 · 타일 …)와 색 · 거칠기를 읽어 블렌더 절차 텍스처 계획으로 바꾼다.
// AI 다듬기(선택): 재질 목록을 AI 에 보내 종류 · 색 · 거칠기 · 무늬 크기를 실제 매장에 맞게 고친다.
import * as THREE from 'three';
import { exportGLB } from './io.js';

export const QUALITY = { fast: { name: '빠름', samples: 64 }, normal: { name: '보통', samples: 192 }, high: { name: '고급', samples: 512 } };
export const SIZES = { fhd: { name: 'FHD', w: 1920 }, qhd: { name: 'QHD', w: 2560 }, uhd: { name: '4K', w: 3840 } };
export const KINDS = ['plain', 'plastic', 'wood', 'plywood', 'tile', 'brick', 'steel', 'marble', 'glass', 'frost', 'concrete', 'asphalt', 'epoxy', 'grass', 'fabric', 'emit'];
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/** 장면 재질에 이름을 붙이고 계획을 만든다 → { roots, specs, where } */
function classify(engine, itemName) {
  const roots = [engine.world, engine.envGroup].filter(Boolean), specs = {}, where = {}, seen = new Map(); let n = 0;
  const roleOf = (o) => { for (let p = o; p; p = p.parent) { if (p.userData.itemId) return ['item', p.userData.itemId]; if (p.userData.siteRoot) return ['site']; if (p.name === '벽') return ['wall']; if (p.name === '천장') return ['ceil']; if (p.name === '바닥' || p.userData.roomId) return ['floor']; } return ['etc']; };
  for (const root of roots) root.traverse((o) => {
    if (!o.isMesh || !o.visible) return; const [role, id] = roleOf(o), list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      if (!m) continue; let nm = seen.get(m);
      if (!nm) {
        nm = `BYR_${++n}`; seen.set(m, nm); m.name = nm; const col = m.color ? m.color : new THREE.Color('#bbbbbb'), em = m.emissive && m.emissiveIntensity > 0 ? lum(m.emissive) * m.emissiveIntensity : 0;
        let kind = m.userData.kind || (m.metalness > 0.6 ? 'steel' : role === 'site' && lum(col) < 0.12 ? 'asphalt' : role === 'site' ? 'plain' : 'plain'); if (kind === 'frost') kind = 'frost';
        const spec = { kind, color: '#' + col.getHexString(), rough: Math.round((m.roughness ?? 0.5) * 100) / 100 };
        if (m.map && !m.userData.kind) { spec.keep = 1; } /* 간판 · 그림 · 지도처럼 이미지가 있는 재질 → 그대로 */
        if (m.isMeshBasicMaterial && m.map) spec.keep = 1;
        if (m.transparent && (m.opacity ?? 1) < 0.6 && !['glass', 'frost'].includes(kind) && !spec.keep) spec.kind = 'glass';
        if (em > 0.05) { if (!m.map && lum(col) > 0.6 && em > 0.6) { spec.kind = 'emit'; spec.color = '#' + m.emissive.getHexString(); } spec.emit = Math.round(Math.min(12, 2 + em * 4) * 10) / 10; spec.emitColor = '#' + m.emissive.getHexString(); }
        if (m.userData.floor && kind === 'tile') spec.scale = 1;
        specs[nm] = spec; where[nm] = { role, items: new Set() };
      }
      if (id && where[nm].items.size < 4) where[nm].items.add(itemName(id));
    }
  });
  return { roots, specs, where };
}
/** 조명 · 해 · 하늘 */
function lightsOf(engine, night) {
  const L = [], v = new THREE.Vector3(), t = new THREE.Vector3();
  engine.world.traverse((o) => {
    if (!(o.isPointLight || o.isSpotLight) || !o.userData.itemLight) return; let vis = true, own = null; for (let p = o.parent; p; p = p.parent) { if (!p.visible) vis = false; if (!own && p.userData.itemId) own = p; } if (!vis) return; /* 화면에서 꺼 둔 것(가까운 몇 개만 켜는 제한)과 상관없이 모든 조명 */
    const dim = night && own ? own.userData.dim ?? 1 : 1, I = (o.userData.bi ?? o.intensity) * dim; if (!(I > 0)) return;
    o.getWorldPosition(v); const e = { kind: o.isSpotLight ? 'spot' : 'point', pos: [v.x, v.y, v.z], color: '#' + o.color.getHexString(), watt: Math.round(o.isSpotLight ? I * 9 : I * 30), radius: 0.04 };
    if (o.isSpotLight) { o.target.getWorldPosition(t); e.target = [t.x, t.y, t.z]; e.angle = Math.min(Math.PI, o.angle * 2); e.blend = o.penumbra ?? 0.5; }
    L.push(e);
  });
  const s = engine.sun, sv = new THREE.Vector3(), st = new THREE.Vector3(); s.getWorldPosition(sv); s.target.getWorldPosition(st); const dir = st.clone().sub(sv).normalize();
  return { lights: L, sun: night || !s.visible ? null : { dir: [dir.x, dir.y, dir.z], strength: 3.5, color: '#' + s.color.getHexString() }, world: night ? { color: '#0b1020', strength: 0.04 } : { color: '#dfe7f0', strength: 0.7 } };
}
/** 렌더 작업 만들기 → { glb, plan, mats } */
export async function blenderJob(engine, { quality = 'normal', size = 'fhd', itemName = (id) => id, aiRefine = null, onStep = () => {} } = {}) {
  onStep('장면 정리 중…'); const night = engine.present === 'light';
  const cls = classify(engine, itemName); let specs = cls.specs;
  if (aiRefine) { onStep('AI 가 재질을 고르는 중…'); try { const r = await aiRefine(Object.entries(specs).map(([k, v]) => ({ name: k, ...v, role: cls.where[k].role, items: [...cls.where[k].items] }))); if (r) for (const [k, v] of Object.entries(r)) if (specs[k] && v && typeof v === 'object') specs[k] = { ...specs[k], ...pickSpec(v) }; } catch (e) { onStep('AI 재질 다듬기 실패 · 기본 재질로 진행 (' + (e.message || e) + ')'); } }
  const cam = engine.camera, tg = engine.controls.target, cv = engine.canvas, aspect = (cv.clientWidth || 16) / (cv.clientHeight || 9), W = SIZES[size].w, H = Math.round(W / aspect / 2) * 2;
  const plan = { version: 1, camera: { pos: [cam.position.x, cam.position.y, cam.position.z], target: [tg.x, tg.y, tg.z], fov: cam.fov || 50 }, ...lightsOf(engine, night), materials: specs, render: { w: W, h: H, samples: QUALITY[quality].samples, exposure: night ? 0.3 : 0 } };
  onStep('장면 내보내는 중 (GLB)…'); const glb = await engine.withRealMaterials(() => exportGLB(cls.roots));
  return { glb, plan, mats: Object.keys(specs).length, lights: plan.lights.length };
}
const pickSpec = (v) => { const o = {}; if (KINDS.includes(v.kind)) o.kind = v.kind; if (/^#[0-9a-f]{6}$/i.test(v.color || '')) o.color = v.color; if (isFinite(v.rough)) o.rough = Math.max(0, Math.min(1, +v.rough)); if (isFinite(v.scale) && +v.scale > 0) o.scale = Math.max(0.1, Math.min(10, +v.scale)); return o; };
export const aiPrompt = (list) => `You are a interior lighting & material artist preparing a Blender Cycles render of a Korean fried-chicken restaurant (or its surroundings).
Below is the list of materials in the scene, each with the BYR guess (kind, color, roughness), its role (item/wall/floor/ceil/site) and some item names that use it.
Pick the most realistic Blender material for each. Allowed kinds: ${KINDS.join(', ')}.
Rules: stainless kitchen equipment = steel; counters/tables by name (원목/우드 = wood, 대리석 = marble); floors usually tile (600mm) or epoxy in kitchens; glass doors/windows = glass; signs keep their color; do not change colors of brand-colored items unless clearly wrong; roughness 0..1; scale = texture size multiplier (1 = default).
Answer JSON only: {"materials": {"BYR_1": {"kind": "...", "color": "#rrggbb", "rough": 0.4, "scale": 1}, ...}} — include only materials you change.
${JSON.stringify(list).slice(0, 60000)}`;
