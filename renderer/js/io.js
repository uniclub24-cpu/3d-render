// 외부 3D 에셋 가져오기(GLTF/GLB · OBJ · FBX) · 장면 내보내기(GLB · OBJ) · 파일 열기/저장
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

export const ASSET_EXT = ['glb', 'gltf', 'obj', 'fbx'];
export const extOf = (name) => (name.split('.').pop() || '').toLowerCase();

export const RES_EXT = ['bin', 'png', 'jpg', 'jpeg', 'webp', 'ktx2', 'tga', 'bmp'];
/** 내용으로 만든 짧은 지문 (이름 · 크기가 같아도 내용이 다르면 다른 모델) */
export function fingerprint(bytes) { let a = 0x811c9dc5, b = 0x9747b28c; for (let i = 0; i < bytes.length; i++) { const c = bytes[i]; a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 13); } return (a >>> 0).toString(36) + (b >>> 0).toString(36) + bytes.length.toString(36); }
/** 파일 바이트 → Three 객체. res = { '파일이름': Uint8Array } — glTF 의 .bin · 텍스처, FBX 텍스처처럼 따로 있는 연결 파일 */
async function parseAsset(ext, bytes, res = {}) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), urls = [];
  const mgr = new THREE.LoadingManager(), base = (u) => decodeURIComponent(String(u).split(/[?#]/)[0].split('/').pop()).toLowerCase(), map = new Map();
  for (const [n, b] of Object.entries(res)) { const mime = /png$/i.test(n) ? 'image/png' : /jpe?g$/i.test(n) ? 'image/jpeg' : /webp$/i.test(n) ? 'image/webp' : 'application/octet-stream'; const u = URL.createObjectURL(new Blob([b], { type: mime })); urls.push(u); map.set(n.split('/').pop().toLowerCase(), u); }
  mgr.setURLModifier((u) => (/^(blob|data):/.test(u) ? u : map.get(base(u)) || u));
  const missing = new Set(); mgr.onError = (u) => missing.add(base(u));
  try {
    let obj;
    if (ext === 'glb' || ext === 'gltf') obj = await new Promise((ok, no) => new GLTFLoader(mgr).parse(buf, '', (g) => ok(g.scene), no));
    else if (ext === 'obj') obj = new OBJLoader(mgr).parse(new TextDecoder().decode(bytes));
    else if (ext === 'fbx') obj = new FBXLoader(mgr).parse(buf, '');
    else throw new Error('지원하지 않는 형식이에요: ' + ext);
    await new Promise((ok) => setTimeout(ok, 300)); // 텍스처가 다 읽힐 시간
    obj.userData.missing = [...missing];
    return obj;
  } catch (e) {
    if (/\.bin|buffer/i.test(String(e && e.message))) throw new Error('연결 파일(.bin)이 없어요 · .gltf 와 같은 폴더의 .bin · 텍스처 파일을 함께 골라 주세요');
    throw e;
  } finally { setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 4000); }
}

/**
 * 에셋을 읽어 "가운데 · 바닥 맞춤 + m 단위"로 정리한다.
 * 반환: { key, object, size(Vector3, m), mm: { w, d, h } }
 */
export async function loadAsset(name, bytes, res = {}) {
  const ext = extOf(name), obj = await parseAsset(ext, bytes, res);
  obj.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = o.receiveShadow = true;
    const fix = (m) => (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial ? m : new THREE.MeshStandardMaterial({ color: m.color || '#b8bcc2', map: m.map || null, roughness: 0.7, metalness: 0, transparent: m.transparent, opacity: m.opacity }));
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material); // OBJ · FBX 의 옛 재질을 PBR 로
  });
  let box = new THREE.Box3().setFromObject(obj); const s0 = box.getSize(new THREE.Vector3()), max = Math.max(s0.x, s0.y, s0.z) || 1;
  // 단위 짐작: glTF 는 m, 그 밖에는 크기로 mm · cm 를 가늠한다 (속성 창에서 크기를 고칠 수 있다)
  const unit = ext === 'glb' || ext === 'gltf' ? (max > 60 ? 0.001 : 1) : max > 60 ? 0.001 : max > 6 ? 0.01 : 1;
  const wrap = new THREE.Group(); obj.scale.multiplyScalar(unit); wrap.add(obj);
  box = new THREE.Box3().setFromObject(wrap); const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
  const size = box.getSize(new THREE.Vector3()); size.set(Math.max(size.x, 1e-3), Math.max(size.y, 1e-3), Math.max(size.z, 1e-3));
  return { key: name + ':' + fingerprint(bytes) + Object.values(res).map((b) => fingerprint(b).slice(0, 6)).join(''), missing: obj.userData.missing || [], object: wrap, size, mm: { w: Math.round(size.x * 1000), d: Math.round(size.z * 1000), h: Math.round(size.y * 1000) } };
}

/** 장면 전체 → GLB (Blender · D5 Render · Twinmotion 에서 바로 열린다) */
export function exportGLB(root) {
  return new Promise((ok, no) => new GLTFExporter().parse(root, (r) => ok(new Uint8Array(r)), no, { binary: true, onlyVisible: true }));
}
/** 장면 전체 → OBJ (재질 정보는 빠지고 형상만) */
export function exportOBJ(root) { root.updateMatrixWorld(true); return new OBJExporter().parse(root); }

/* ---------- 파일 열기 · 저장 (Electron 이면 대화 상자, 브라우저면 입력창 · 내려받기) ---------- */
const CAP = () => { const C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() ? C : null; }; // 안드로이드 앱 안인가
export async function openFiles({ title, extensions, multi = false }) {
  if (window.byr) { const r = await window.byr.openFiles({ title, multi, filters: [{ name: title || '파일', extensions }] }); return r.map((f) => ({ name: f.name, data: new Uint8Array(f.data) })); }
  return new Promise((ok) => {
    const i = Object.assign(document.createElement('input'), { type: 'file', multiple: multi, accept: CAP() ? '' : extensions.map((e) => '.' + e).join(',') }); // 안드로이드는 확장자 필터가 파일을 막는 경우가 있어 전체 표시
    i.onchange = async () => ok(await Promise.all([...i.files].map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))));
    i.oncancel = () => ok([]); i.click();
  });
}
export async function saveFile({ title, defaultName, extensions, data }) {
  if (window.byr) return window.byr.saveFile({ title, defaultName, filters: [{ name: title || '파일', extensions }], data });
  const C = CAP();
  if (C && C.Plugins.Filesystem && C.Plugins.Share) { // 안드로이드: 임시 폴더에 쓰고 공유 창 (내 파일 · 드라이브 · 메일로 저장)
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
    const w = await C.Plugins.Filesystem.writeFile({ path: defaultName, data: bytesToB64(bytes), directory: 'CACHE' });
    try { await C.Plugins.Share.share({ title: defaultName, files: [w.uri], dialogTitle: '저장할 곳을 고르세요' }); } catch (e) { return null; }
    return defaultName;
  }
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data])), download: defaultName });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); return defaultName;
}
export const bytesToB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
export const b64ToBytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
