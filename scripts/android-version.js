// 안드로이드 버전 맞추기: package.json 의 2.1.10 → versionName "2.1.10", versionCode 20110 (올릴 때마다 커져야 함)
const fs = require('fs'), path = require('path');
const v = require('../package.json').version, [a, b, c] = v.split('.').map(Number), code = a * 10000 + b * 100 + c;
const f = path.join(__dirname, '..', 'android', 'app', 'build.gradle'); let g = fs.readFileSync(f, 'utf8');
g = g.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${v}"`);
fs.writeFileSync(f, g); console.log(`[android] versionName ${v} · versionCode ${code}`);
