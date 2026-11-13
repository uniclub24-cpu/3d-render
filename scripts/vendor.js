// Three.js와 필요한 부가 모듈만 renderer/vendor/three 로 복사한다 (CDN 없이 오프라인 구동).
// npm install 뒤 자동 실행(postinstall). 다른 위치의 three 소스를 쓰려면 THREE_SRC=경로 node scripts/vendor.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = process.env.THREE_SRC || path.join(root, 'node_modules', 'three');
const out = path.join(root, 'renderer', 'vendor', 'three');
const ENTRY = [
  'examples/jsm/postprocessing/EffectComposer.js', 'examples/jsm/postprocessing/RenderPass.js', 'examples/jsm/postprocessing/SSAOPass.js',
  'examples/jsm/postprocessing/ShaderPass.js', 'examples/jsm/postprocessing/OutputPass.js', 'examples/jsm/shaders/FXAAShader.js',
  'examples/jsm/controls/OrbitControls.js', 'examples/jsm/environments/RoomEnvironment.js', 'examples/jsm/utils/BufferGeometryUtils.js',
  'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/loaders/OBJLoader.js', 'examples/jsm/loaders/FBXLoader.js',
  'examples/jsm/exporters/GLTFExporter.js', 'examples/jsm/exporters/OBJExporter.js',
];
if (!fs.existsSync(path.join(src, 'build', 'three.module.min.js'))) {
  console.log('[vendor] three 소스를 찾지 못했어요 (' + src + '). 이미 들어 있는 renderer/vendor 를 그대로 씁니다.'); process.exit(0);
}
const seen = new Set();
function copy(rel) {
  if (seen.has(rel)) return; seen.add(rel);
  const from = path.join(src, rel), to = path.join(out, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to);
  const code = fs.readFileSync(from, 'utf8');
  for (const m of code.matchAll(/(?:import|export)[^'"]*?from\s*['"](\.[^'"]+)['"]/g)) copy(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
}
fs.rmSync(out, { recursive: true, force: true });
copy('build/three.module.min.js'); ENTRY.forEach(copy);
for (const f of ['LICENSE']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(out, f));
console.log('[vendor] three ' + seen.size + '개 파일 복사 → renderer/vendor/three');
