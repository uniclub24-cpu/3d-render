// 영어 화면 (기존 앱 v15): 화면 글자를 사전으로 바꿔 보여 준다. 모델 · 파일은 그대로 (한국어 이름 유지)
// 글자 조각(" · " 로 나뉜 것)이 모두 사전에 있으면 바꾸고, 모르는 글자는 그대로 둔다.
const D = {
  // 도구 막대 · 위 막대
  '기물': 'Items', '선택': 'Select', '이동': 'Move', '둘러보기': 'Orbit', '층': 'Levels', '줄자': 'Tape', '공간': 'Spaces', '구배': 'Slope', '배경': 'Context', '스타일': 'Style', '비스듬히': 'Iso', '위에서': 'Top', '천장': 'Ceiling', '걷기': 'Walk', '설치물': 'MEP', '공기': 'Airflow', '동선': 'Workflow',
  '단면': 'Section', '시점': 'Views', '댓글': 'Comments', '점검': 'Check', '견적': 'Quote', '자동 배치': 'Auto layout', '분할': 'Split', '취소': 'Cancel', '확인': 'OK', '종료': 'Quit', '지우기': 'Delete', '새로 시작': 'Start new', '계속 수정': 'Keep editing', '그만하기': 'Stop', '지우고 배치': 'Clear & place',
  '이 기기에 저장됨': 'Saved on this device', '저장 대기': 'Saving…', '동기화 중…': 'Syncing…', '새 프로젝트': 'New project',
  // 파일 메뉴
  '내 프로젝트 (자동 저장 · 동기화)': 'My projects (autosave · sync)', '프로젝트 열기 (.byr.json)': 'Open project (.byr.json)', '프로젝트 저장': 'Save project', '기존 앱 작업물 가져오기 (JSON)': 'Import legacy app work (JSON)', '기존 앱 계정에서 불러오기 (로그인)': 'Load from legacy account (sign in)', '기존 앱 샘플 불러오기': 'Load legacy sample',
  '공간 목록 · 공간만 작업': 'Space list · work in one space', '배경 (주변 거리) · 도면 밑그림': 'Context (street) · plan underlay', 'AI (Claude · ChatGPT · Gemini) · 도면 → 벽 · 사진 → 기물': 'AI (Claude · ChatGPT · Gemini) · plan → walls · photo → items',
  '3D 에셋 가져오기 (GLB · GLTF · OBJ · FBX · STL · PLY · DAE · 3MF · OFF)': 'Import 3D asset (GLB · GLTF · OBJ · FBX · STL · PLY · DAE · 3MF · OFF)', 'DXF 가져오기 (캐드 선 → 벽)': 'Import DXF (CAD lines → walls)',
  '전체 장면 내보내기 · GLB (Blender · D5 · Twinmotion)': 'Export scene · GLB (Blender · D5 · Twinmotion)', '모든 층 내보내기 · GLB (층 높이대로 쌓아서)': 'Export all levels · GLB (stacked)', '전체 장면 내보내기 · OBJ': 'Export scene · OBJ',
  'DXF 내보내기 · 지금 층 (기물은 블록)': 'Export DXF · this level (items as blocks)', 'DXF 내보내기 · 모든 층': 'Export DXF · all levels', '이미지 저장 · 렌더 해상도 · 단면 · 시점': 'Save image · render size · section · views', '평면도 이미지 · JPEG': 'Floor plan image · JPEG',
  '블렌더 패키지 · ZIP (GLB · DXF · 프로젝트 · 견적 · 이미지)': 'Blender package · ZIP (GLB · DXF · project · quote · image)', '작업 기록 (H)': 'History (H)', '화면 이미지 저장 · PNG': 'Save screen · PNG', '홈 화면': 'Home', '영어 화면 · English': '한국어 화면 · Korean',
  // 패널 제목 · 구역
  '장면 설정': 'Scene settings', '층 · 천장': 'Levels · ceiling', '공간 목록': 'Spaces', '벽': 'Wall', '배경 · 밑그림': 'Context · underlay', '설치물 · 배관 · 전선': 'MEP · pipes · wiring', '동선 · 직원 배치': 'Workflow · staff', '설비 점검 · 전력': 'Equipment check · power', '견적 · 물량 · 단가': 'Quote · quantities · prices',
  '자동 배치 · A안/B안': 'Auto layout · plan A/B', '안 비교': 'Compare plans', '단면 · 시점 · 이미지': 'Section · views · image', '작업 기록': 'History', '댓글 · 핀': 'Comments · pins', 'DXF 가져오기': 'Import DXF', 'AI 도면 · 사진 인식': 'AI plan · photo reading', '내 프로젝트': 'My projects', '기존 앱 계정': 'Legacy account',
  '보기 스타일 · 편집은 그대로 이어져요': 'View style · editing continues', '햇빛 · 그림자': 'Sun · shadows', '후처리': 'Post-processing', '색 · 재질': 'Color · material', '조명': 'Lighting', '크기 (mm)': 'Size (mm)', '위치 (mm)': 'Position (mm)', '기물 높이': 'Item height', '디자인 상세': 'Design details',
  '바닥': 'Floor', '치수': 'Dimensions', '정렬': 'Align', '간격 같게': 'Distribute', '한꺼번에': 'All at once', '업종': 'Business type', '넣을 것': 'Include', '전력 합계': 'Total power', '레이어 투명도': 'Layer opacity', '단면 보기 · 잘라서 속 보기': 'Section view · cut to see inside',
  '이미지 저장 · 렌더 해상도': 'Save image · render size', '텍스처 입히기 (사진 · 무늬 이미지)': 'Texture (photo · pattern image)', '모양 · 마감': 'Shape · finish', '나누기 · 돌리기 · 잇기': 'Split · rotate · join',
  // 자주 쓰는 버튼 · 낱말
  '삭제': 'Delete', '복제': 'Duplicate', '90° 돌리기': 'Rotate 90°', '배치하기': 'Place', '비교하기': 'Compare', '이름': 'Rename', '보기': 'View', '답글': 'Reply', '해결': 'Resolve', '다시 열기': 'Reopen', '남기기': 'Post', '+ 핀 꽂기': '+ Add pin', '바꾸기': 'Change',
  '엑셀 (xlsx)': 'Excel (xlsx)', 'CSV': 'CSV', '설비 점검': 'Equipment check', '견적 보기': 'Open quote', '3D 이미지 저장': 'Save 3D image', '평면도 JPEG': 'Plan JPEG', '+ 지금 시점 저장': '+ Save this view', '360° 돌려 보기': '360° spin', '끄기': 'Off',
  '높이에서 (위를 걷어냄)': 'Horizontal (lift off top)', '세로 (좌우)': 'Vertical (X)', '세로 (앞뒤)': 'Vertical (Z)', '반대쪽 보기': 'Flip side', '주방 비율': 'Kitchen ratio', '주방 통로 폭': 'Kitchen aisle width', '주방 통로 기준 폭': 'Kitchen aisle target',
  '페리카나 홀 타입': 'Pelicana hall type', '페리카나 배달 타입': 'Pelicana delivery type', '치킨 (일반)': 'Chicken', '카페': 'Cafe', '분식': 'Snack bar', '한식': 'Korean',
  '주방 기물': 'Kitchen equipment', '홀 (카운터 · 테이블)': 'Hall (counter · tables)', '설비 (후드 · 배수 · 가스 · 3상)': 'MEP (hood · drain · gas · 3-phase)', '마감 색': 'Finish colors', '+ 지금 안 복사해서 새 안': '+ Copy as new plan',
  '왼쪽': 'Left', '오른쪽': 'Right', '위': 'Top', '아래': 'Bottom', '가로 가운데': 'Center X', '세로 가운데': 'Center Y', '가로로': 'Horizontal', '세로로': 'Vertical', '가로로 딱 붙이기': 'Pack horizontally', '세로로 딱 붙이기': 'Pack vertically', '묶어서 90° 돌리기': 'Rotate group 90°', '고르기 풀기': 'Deselect',
  '색': 'Color', '재질': 'Material', '그대로': 'Keep', '종류': 'Type', '폭': 'Width', '높이': 'Height', '바닥에서': 'Sill', '이름 바꾸기': 'Rename', '이미지 고르기': 'Choose image', '이미지 바꾸기': 'Change image', '텍스처 지우기': 'Remove texture',
  '이어서 작업': 'Continue', '계정': 'Account', '로그인': 'Sign in', '로그아웃': 'Sign out', '동기화': 'Sync', '열기': 'Open', '저장': 'Save', '닫기': 'Close', '뒤로': 'Back',
};
const SEG = ' · ';
let on = false, obs = null; const orig = new WeakMap(), origA = new WeakMap();
function tr(t) { const k = t.trim(); if (!k) return null; if (D[k]) return t.replace(k, D[k]); if (k.includes(SEG)) { const p = k.split(SEG); if (p.every((q) => D[q.trim()])) return t.replace(k, p.map((q) => D[q.trim()]).join(SEG)); } return null; }
function walk(root) {
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = it.nextNode(); n; n = it.nextNode()) { const v = tr(n.nodeValue); if (v != null && v !== n.nodeValue) { if (!orig.has(n)) orig.set(n, n.nodeValue); n.nodeValue = v; } }
  const els = root.querySelectorAll ? root.querySelectorAll('[title],[aria-label],[placeholder]') : []; for (const e of els) for (const a of ['title', 'aria-label', 'placeholder']) { const v0 = e.getAttribute(a); if (!v0) continue; const v = tr(v0); if (v != null && v !== v0) { const m = origA.get(e) || {}; if (!(a in m)) m[a] = v0; origA.set(e, m); e.setAttribute(a, v); } }
}
export const lang = () => (on ? 'en' : 'ko');
export function setLang(l) {
  on = l === 'en'; try { localStorage.setItem('byr.lang', JSON.stringify(l)); } catch {} document.documentElement.lang = on ? 'en' : 'ko';
  if (on) { walk(document.body); if (!obs) { obs = new MutationObserver((ms) => { if (!on) return; for (const m of ms) { if (m.type === 'characterData') { const v = tr(m.target.nodeValue); if (v != null && v !== m.target.nodeValue) m.target.nodeValue = v; } else for (const n of m.addedNodes) n.nodeType === 3 ? (() => { const v = tr(n.nodeValue); if (v != null) n.nodeValue = v; })() : n.nodeType === 1 && walk(n); } }); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); } }
  else { if (obs) { obs.disconnect(); obs = null; } const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n = it.nextNode(); n; n = it.nextNode()) if (orig.has(n)) n.nodeValue = orig.get(n); for (const e of document.querySelectorAll('[title],[aria-label],[placeholder]')) { const m = origA.get(e); if (m) for (const [a, v] of Object.entries(m)) e.setAttribute(a, v); } }
}
export function initLang() { let l = 'ko'; try { l = JSON.parse(localStorage.getItem('byr.lang')) || 'ko'; } catch {} if (l === 'en') setLang('en'); }
