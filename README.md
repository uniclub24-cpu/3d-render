# 3D RENDER · PC(.exe)와 안드로이드(.apk) 만들기

같은 화면(www/index.html)을 PC는 Electron, 안드로이드는 Capacitor로 감쌉니다.
설치 파일은 내 컴퓨터가 아니라 GitHub이 대신 만들어 줍니다.

## 1. GitHub에 올리기 (10분)
1. github.com 가입 → 오른쪽 위 + → New repository → 이름 `3d-render` → **Private** → Create
2. "uploading an existing file" 클릭 → 이 폴더 안의 파일을 전부 끌어다 놓기
   (`.github` 폴더가 꼭 같이 올라가야 합니다. 숨김 폴더라 안 보이면 탐색기 보기 → 숨긴 항목 체크)
3. Commit changes

## 2. 설치 파일 받기
1. 저장소 → Actions 탭 → `build-apps` → Run workflow
2. 10~15분 뒤 완료된 실행을 열고 아래 Artifacts에서
   - `3D-RENDER-windows` → 압축 풀고 `3D RENDER *.exe` 실행 (설치 없이 실행되는 portable)
   - `3D-RENDER-android` → `app-debug.apk`를 폰으로 옮겨 설치 (출처를 알 수 없는 앱 허용 필요)

## 3. PC와 폰 프로젝트 공유 (로그인 · 동기화)
1. supabase.com 무료 가입 → New project (지역: Northeast Asia (Seoul))
2. SQL Editor → `supabase/schema.sql` 내용을 붙여넣고 Run
3. Project Settings → API에서 **Project URL**과 **anon public key** 복사
4. GitHub 저장소 → Settings → Secrets and variables → Actions → New repository secret
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_ANON_KEY` = anon public key
5. Actions에서 다시 Run workflow → 새로 받은 exe · apk에서 **계정 · 동기화 → 처음이면 가입**
   (Supabase Authentication → Providers → Email에서 "Confirm email"을 끄면 메일 확인 없이 바로 로그인됩니다)

시크릿을 넣지 않아도, 앱 안 "계정 · 동기화" 창에 URL과 키를 직접 넣으면 됩니다.

## 4. 웹 주소 (링크 공유용 · 선택)
1. GitHub 저장소 → Settings → Pages → Source를 **GitHub Actions**로
2. Settings → Secrets and variables → Actions → **Variables** 탭 → New variable
   - `SHARE_BASE` = `https://내아이디.github.io/3d-render/`
3. Run workflow → 같은 화면이 위 주소에 올라갑니다. (저장소가 Private이면 Pages는 유료 요금제에서만 됩니다. 무료로 쓰려면 Public 저장소로 만드세요. 프로젝트 내용은 저장소가 아니라 Supabase에 있어서 코드만 공개됩니다.)

## 5. 링크 공유 · 받은 사람 댓글
- 3·4단계를 마치면 앱의 **도구 → 링크 공유**에서 링크를 만들 수 있어요.
- 받는 사람은 로그인 없이 링크를 열어 2D · 3D · 걷기로 보고, 허용하면 3D 위에 댓글을 남깁니다.
- 남긴 댓글은 **링크 공유 → 받은 댓글 가져오기**로 내 프로젝트에 들어옵니다.
- 이미 Supabase를 쓰고 있었다면 `supabase/schema.sql`을 한 번 더 Run 해서 `shares` 표를 만들어 주세요.

## 관리자 (v8)
- `www/config.js`의 `adminEmail`로 로그인하면 위쪽에 **관리자** 버튼이 생겨요: 사용자 목록 · 작업 기록 · 모든 프로젝트 보기 · 차단.
- 서버 권한은 `supabase/schema.sql`(v8 부분)이 지켜요. 관리자 이메일을 바꾸려면 SQL Editor에서
  `insert into public.admins (email) values ('새이메일') on conflict do nothing;`
- 차단하면 그 계정은 저장 · 작업 기록 올리기가 막혀요. 로그인 자체를 막으려면 Supabase → Authentication → Users → Ban user.

## 동기화 규칙
- 프로젝트별로 더 최근에 고친 쪽이 이깁니다. 같은 프로젝트를 PC와 폰에서 동시에 고치면 나중에 저장한 쪽만 남습니다.
- 자동 동기화를 켜면 앱을 열 때, 고친 뒤 15초 후, 5분마다 맞춥니다.
- "내 기물" 목록도 함께 맞춰집니다. 삭제한 프로젝트는 아직 서버에서 지워지지 않습니다.

## 내보내기 (구글 드라이브 · 네이버 메일)
- 안드로이드: 공유 창이 뜨면 Drive 또는 네이버 메일 앱을 고릅니다.
- PC: 파일을 저장한 뒤 드라이브 · 네이버 메일 페이지가 열리고, 거기에 끌어다 놓으면 됩니다.
  (두 서비스에 직접 올리려면 각 회사의 개발자 등록 · 앱 심사가 필요해서 이 방식이 현실적입니다.)

## 내 컴퓨터에서 직접 빌드하려면 (선택)
Node.js 20 설치 후
```
npm install
npm start            # PC 앱 바로 실행
npm run dist:win     # dist 폴더에 exe 생성
npx cap add android  # 안드로이드 스튜디오 필요
npm run android:apk
```

## v7에서 더해진 것
- 정렬선 · 거리 표시(Alt를 누르면 잠시 끄기), 선택하면 개체 옆에 뜨는 도구 막대(상세는 ☰ 상세), 미니맵, Ctrl+K 검색(초성 검색), 작업 기록(H)
- 걷기 모드(G): 키(cm)를 넣으면 눈높이 = 키 − 11cm, Q/E로 높낮이, 1~4로 아이 · 앉음 · 내 키 · 위에서
- 360° 파노라마(JPG · 보기 페이지), 실사 렌더(그림자 · 부드러운 빛, 최대 4K)
- A안 · B안 저장과 비교, 자재 · 물량 · 견적표(엑셀), DXF 도면 불러오기, 내 3D 모델(GLB · OBJ), 주방 자동 배치 제안, 3D 댓글 · 링크 공유
- 실사 렌더는 앱 안에서 계산하는 그림자 렌더입니다. 사진 같은 결과가 필요하면 OBJ로 내보내 블렌더 · D5 · 트윈모션을 쓰세요.

## 사진 4면 AI 인식 (선택)
- Claude 안(링크)에서 열면 따로 설정 없이 쓸 수 있습니다. 처음 한 번 "Claude에게 이미지를 보내도 될지" 묻습니다.
- exe · apk에서는 console.anthropic.com에서 만든 API 키를 앱의 "계정 · 동기화 → AI 인식 키"에 넣어야 합니다. 사진 한 장당 몇십 원 정도의 사용료가 그 키로 청구됩니다.
- 키는 그 기기에만 저장됩니다. 다른 사람과 공유하는 기기에는 넣지 마세요.
