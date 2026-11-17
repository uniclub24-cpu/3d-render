// 동선 사람 모양 (스타일에 따라 다르게)
//  · 실사형: 실사 · 동양풍 · 이자카야 · 북유럽 · 인더스트리얼 → 관절이 있는 실제 비율 사람 (남 · 여)
//  · 귀여운형: 카툰 · 만화 · 타이쿤 · 로우폴리 · 팝아트 · 클레이 → 머리가 큰 2.5등신 캐릭터 (모자 남아 · 양갈래 여아 · 가방)
//  · 그 밖(스케치 · 수묵 · 도면): 예전 단순 모양을 그대로 쓴다 (sim.js)
// 모든 모양은 +x 쪽을 바라본다 (sim 이 rotation.y = -방향 으로 돌림). anim(ph, moving) 으로 걸음을 움직인다.
import * as THREE from 'three';

export const FIG_REAL = new Set(['real', 'oriental', 'izakaya', 'nordic', 'industrial']);
export const FIG_CUTE = new Set(['toon', 'comic', 'tycoon', 'lowpoly', 'pop', 'clay']);
export const figKind = (style) => (FIG_REAL.has(style) ? 'real' : FIG_CUTE.has(style) ? 'cute' : null);

const M = (color, rough = 0.75, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const pick = (arr, k) => arr[Math.abs(k) % arr.length];

/** 팔 · 다리: 어깨(고관절) → 위 → 팔꿈치(무릎) → 아래 → 손(발) */
function limb(len1, len2, r1, r2, mat1, mat2, endMesh) {
  const top = new THREE.Group(), up = sh(new THREE.Mesh(new THREE.CapsuleGeometry(r1, len1 - r1 * 2, 6, 12), mat1)); up.position.y = -len1 / 2; top.add(up);
  const mid = new THREE.Group(); mid.position.y = -len1; top.add(mid);
  const lo = sh(new THREE.Mesh(new THREE.CapsuleGeometry(r2, len2 - r2 * 2, 6, 12), mat2)); lo.position.y = -len2 / 2; mid.add(lo);
  if (endMesh) { endMesh.position.y += -len2; mid.add(sh(endMesh)); }
  return { top, mid };
}

/**
 * 실사 비율 보행자 (키 약 1.7m · 여자는 1.6m)
 * opt: { sex: 'm'|'f', shirt, pants, shoe, hair, skin, chef }
 */
export function realPerson(opt = {}) {
  const f = opt.sex === 'f', k = opt.seed || 0;
  const skin = M(opt.skin || pick(['#e0ac8b', '#d9a07c', '#eab99a'], k), 0.65), shirt = M(opt.chef ? '#f4f4f2' : opt.shirt || (f ? pick(['#c9a9a6', '#8fa6b8', '#e8e0d0', '#6b4f5a'], k) : pick(['#7a7e85', '#3d4a5c', '#8a6d52', '#2f3b33'], k)), 0.85);
  const pants = M(opt.chef ? '#2b2b2b' : opt.pants || (f ? pick(['#2b3a55', '#3a3340', '#d8cfc0'], k) : '#222831'), 0.8), shoe = M(opt.shoe || (f ? '#e9e4dc' : '#4a4a4a'), 0.7), hair = M(opt.hair || pick(['#261c15', '#3b2a20', '#1c1714'], k), 0.75);
  const s = f ? 0.94 : 1, root = new THREE.Group(), body = new THREE.Group(); body.rotation.y = Math.PI / 2; root.add(body); body.scale.setScalar(s);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.92; body.add(pelvis);
  const hip = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.08, 6, 12), pants)); hip.scale.set(f ? 1.12 : 1.05, 1, 0.75); hip.position.y = 0.02; pelvis.add(hip);
  const torso = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.32, 8, 16), shirt)); torso.scale.set(f ? 1.0 : 1.15, 1, f ? 0.72 : 0.78); torso.position.y = 0.27; pelvis.add(torso);
  if (opt.chef) { const apron = sh(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 0.02), M('#9b1b1f', 0.9))); apron.position.set(0, 0.05, 0.13); pelvis.add(apron); }
  const neck = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), skin)); neck.position.y = 0.53; pelvis.add(neck);
  const head = new THREE.Group(); head.position.y = 0.66; pelvis.add(head);
  const face = sh(new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 16), skin)); face.scale.set(0.92, 1.12, 1); head.add(face);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skin); nose.position.set(0, -0.01, 0.1); head.add(nose);
  const hcap = sh(new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14, 0, Math.PI * 2, 0, Math.PI * (f ? 0.62 : 0.56)), hair)); hcap.scale.set(0.96, 1.12, 1.05); hcap.rotation.x = -0.15; hcap.position.set(0, 0.016, -0.01); head.add(hcap);
  if (f) { /* 어깨 길이 머리 + 묶음 */ const back = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.16, 6, 12), hair)); back.scale.set(1.15, 1, 0.6); back.position.set(0, -0.08, -0.06); head.add(back);
    const bun = sh(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), hair)); bun.position.set(0, 0.07, -0.11); head.add(bun); }
  if (opt.chef) { const hat = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 18), M('#ffffff', 0.9))); hat.position.y = 0.11; head.add(hat); }
  const handG = () => { const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), skin); h.scale.set(0.8, 1.2, 1); h.position.y = -0.03; return h; };
  const arms = [-1, 1].map((sd) => { const a = limb(0.27, 0.25, 0.045, 0.038, shirt, f ? skin : shirt, handG()); a.top.position.set(sd * (f ? 0.18 : 0.21), 0.45, 0); a.top.rotation.z = sd * 0.06; pelvis.add(a.top); return a; });
  const footG = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.24), shoe); m.position.set(0, -0.02, 0.05); return m; };
  const legs = [-1, 1].map((sd) => { const l = limb(0.44, 0.44, 0.07, 0.055, pants, pants, footG()); l.top.position.set(sd * 0.09, -0.02, 0); pelvis.add(l.top); return l; });
  /* 걸음: 다리 앞뒤 · 무릎 굽힘 · 팔 반대로 · 골반 위아래 */
  const anim = (ph, moving) => { const sw = moving ? Math.sin(ph * 0.5) : 0, a = moving ? 0.48 : 0;
    legs[0].top.rotation.x = sw * a; legs[1].top.rotation.x = -sw * a; legs[0].mid.rotation.x = moving ? Math.max(0, -Math.sin(ph * 0.5 + 0.6)) * 0.7 : 0; legs[1].mid.rotation.x = moving ? Math.max(0, Math.sin(ph * 0.5 + 0.6)) * 0.7 : 0;
    arms[0].top.rotation.x = -sw * a * 0.8; arms[1].top.rotation.x = sw * a * 0.8; arms[0].mid.rotation.x = arms[1].mid.rotation.x = moving ? -0.25 : -0.08;
    pelvis.position.y = 0.92 - (moving ? Math.abs(Math.cos(ph * 0.5)) * 0.025 : 0); pelvis.rotation.y = moving ? sw * 0.08 : 0; torso.rotation.y = -pelvis.rotation.y * 0.5; };
  anim(0, false); return { g: root, anim };
}

/**
 * 귀여운 2.5등신 캐릭터 (키 약 1.15m)
 * opt: { kind: 'boy'|'girl'|'kid', top, pants, cap, chef }
 */
export function cutePerson(opt = {}) {
  const k = opt.seed || 0, kind = opt.kind || pick(['boy', 'girl', 'kid'], k);
  const skin = M('#f6c9a8', 0.6), top = M(opt.chef ? '#ffffff' : opt.top || { boy: '#2f6fd6', girl: '#f2c21b', kid: '#d8312b' }[kind], 0.55), pants = M(opt.pants || (kind === 'girl' ? '#4a78b4' : kind === 'boy' ? '#c9b28a' : '#3e5f9a'), 0.6);
  const hair = M('#5b3a22', 0.6), shoe = M(kind === 'girl' ? '#e23b3b' : '#5a3a26', 0.5), black = M('#1a1a1a', 0.4), white = M('#ffffff', 0.4), blush = M('#f19a8f', 0.7);
  const root = new THREE.Group(), body = new THREE.Group(); body.rotation.y = Math.PI / 2; root.add(body);
  const pelvis = new THREE.Group(); pelvis.position.y = 0.36; body.add(pelvis);
  const torso = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.14, 8, 16), top)); torso.scale.set(1.1, 1, 0.85); torso.position.y = 0.17; pelvis.add(torso);
  if (kind === 'girl' && !opt.chef) { const bib = sh(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.05), pants)); bib.position.set(0, 0.14, 0.13); pelvis.add(bib); }
  const shorts = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.04, 6, 12), pants)); shorts.scale.set(1.05, 0.8, 0.85); shorts.position.y = 0.02; pelvis.add(shorts);
  const head = new THREE.Group(); head.position.y = 0.55; pelvis.add(head);
  const face = sh(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 20), skin)); face.scale.set(1.05, 0.98, 0.95); head.add(face);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), black); e.scale.set(0.8, 1.2, 0.5); e.position.set(sd * 0.075, 0.0, 0.2); head.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), white); hl.position.set(sd * 0.075 + 0.008, 0.012, 0.212); head.add(hl);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), blush); c.scale.set(1.2, 0.7, 0.3); c.position.set(sd * 0.13, -0.055, 0.17); head.add(c);
    const ear = sh(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin)); ear.position.set(sd * 0.22, -0.01, 0); head.add(ear); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14, Math.PI), M('#7a2b2b', 0.6)); mouth.rotation.z = Math.PI; mouth.position.set(0, -0.07, 0.205); head.add(mouth);
  const hcap = sh(new THREE.Mesh(new THREE.SphereGeometry(0.228, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hair)); hcap.rotation.x = -0.25; hcap.position.y = 0.02; head.add(hcap);
  if (opt.chef) { const hat = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 20), white)); hat.position.y = 0.24; head.add(hat); }
  else if (kind === 'boy') { const cap = sh(new THREE.Mesh(new THREE.SphereGeometry(0.235, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), M('#d9b991', 0.6))); cap.position.y = 0.035; head.add(cap); const band = sh(new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.03, 8, 30), M('#1f2f5c', 0.6))); band.rotation.x = Math.PI / 2; band.position.y = 0.06; head.add(band);
    const brim = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), M('#1f2f5c', 0.6))); brim.position.set(0, 0.07, 0.17); head.add(brim); }
  else if (kind === 'girl') { for (const sd of [-1, 1]) { const tail = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.12, 6, 10), hair)); tail.position.set(sd * 0.25, -0.1, -0.03); tail.rotation.z = sd * 0.35; head.add(tail); const tie = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), M('#e23b3b', 0.5)); tie.position.set(sd * 0.22, -0.02, -0.03); head.add(tie); } }
  else { for (let i = 0; i < 6; i++) { const sp = sh(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), hair)); const a = (i / 6) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12 - 0.03); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); head.add(sp); } }
  if (!opt.chef) { const bag = sh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.1), M(kind === 'girl' ? '#e8742b' : '#22305c', 0.6))); bag.position.set(0, 0.2, -0.16); pelvis.add(bag); }
  const hand = () => new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin), foot = () => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 8), shoe); m.rotation.x = Math.PI / 2; m.position.set(0, -0.02, 0.03); return m; };
  const arms = [-1, 1].map((sd) => { const a = limb(0.12, 0.11, 0.045, 0.04, top, top, hand()); a.top.position.set(sd * 0.18, 0.27, 0); a.top.rotation.z = sd * 0.25; pelvis.add(a.top); return a; });
  const legs = [-1, 1].map((sd) => { const l = limb(0.15, 0.15, 0.055, 0.05, pants, skin, foot()); l.top.position.set(sd * 0.075, 0, 0); pelvis.add(l.top); return l; });
  const anim = (ph, moving) => { const sw = moving ? Math.sin(ph * 0.6) : 0;
    legs[0].top.rotation.x = sw * 0.55; legs[1].top.rotation.x = -sw * 0.55; arms[0].top.rotation.x = -sw * 0.6; arms[1].top.rotation.x = sw * 0.6;
    pelvis.position.y = 0.36 + (moving ? Math.abs(Math.sin(ph * 0.6)) * 0.03 : Math.sin(ph * 0.3) * 0.004); head.rotation.z = moving ? sw * 0.06 : Math.sin(ph * 0.2) * 0.03; };
  anim(0, false); return { g: root, anim };
}
