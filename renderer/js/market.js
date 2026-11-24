// 상권분석 (v2.1.39): 주소 → 반경 1km 건물 · 도로 · 하천 지도 + 업종별 경쟁사 (소상공인시장진흥공단 상가정보 · 행정안전부 일반음식점 인허가)
// 좌표: 찾은 주소(경위도)를 0,0 으로 한 m 평면 (x = 동쪽 +, y = 남쪽 +) — site.js 와 같음
import * as SITE from './site.js';

const R_MAX = 1000, V_MIN = 80, V_DEF = 300;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => [...el.querySelectorAll(q)];
const withTimeout = (p, ms, code = 'E-TIME') => Promise.race([p, new Promise((_, bad) => setTimeout(() => bad(new SITE.NetError(code, `${Math.round(ms / 1000)}초 안에 응답이 없어요`)), ms))]);

/* ======================= 1. 소상공인시장진흥공단 상가(상권)정보: 반경 내 음식점 ======================= */
const SEMAS = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius';
/** 공공데이터포털 응답에서 오류 문구 찾기 (XML · JSON 모두) */
function portalErr(t) {
  const s = String(t || ''), m = s.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>|<errMsg>([^<]+)<\/errMsg>|"resultMsg"\s*:\s*"([^"]+)"/);
  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE KEY IS NOT REGISTERED|등록되지 않은|SERVICE_ACCESS_DENIED|PERMISSION_DENIED|SERVICE_KEY_IS_NULL/i.test(s)) return new SITE.NetError('E-KEY', '키가 이 서비스에 등록되지 않았어요 (활용신청 후 1~2시간 걸릴 수 있어요)');
  if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS/i.test(s)) return new SITE.NetError('E-LIMIT', '오늘 쓸 수 있는 호출 수를 넘었어요');
  if (/INVALID_REQUEST_PARAMETER/i.test(s)) return new SITE.NetError('E-PARAM', '요청 값이 맞지 않아요');
  if (/^\s*</.test(s) && m) return new SITE.NetError('E-API', m[1] || m[2] || m[3]);
  return null;
}
export async function loadStores(lon, lat, R, key, step = () => {}) {
  const out = [], seen = new Set(); let total = 0, stdr = '';
  for (let page = 1; page <= 15; page++) {
    const u = `${SEMAS}?serviceKey=${encodeURIComponent(key)}&pageNo=${page}&numOfRows=1000&radius=${R}&cx=${lon.toFixed(7)}&cy=${lat.toFixed(7)}&indsLclsCd=I2&type=json`;
    const t = await withTimeout(SITE.netGet(u), 60000), e = portalErr(t); if (e) throw e;
    let j; try { j = JSON.parse(t); } catch { throw new SITE.NetError('E-JSON', t.slice(0, 160)); }
    const H = j.header || (j.response && j.response.header) || {}, B = j.body || (j.response && j.response.body) || {};
    if (H.resultCode === '03' || /NODATA/i.test(H.resultMsg || '')) break;
    if (H.resultCode && H.resultCode !== '00') throw new SITE.NetError('E-API', H.resultMsg || H.resultCode);
    stdr = stdr || H.stdrYm || ''; total = +B.totalCount || total;
    const it = Array.isArray(B.items) ? B.items : B.items && B.items.item ? [].concat(B.items.item) : [];
    for (const s of it) { if (!s || seen.has(s.bizesId)) continue; seen.add(s.bizesId); out.push(s); }
    step(`상가정보 음식점 ${out.length}${total ? '/' + total : ''}곳`);
    if (!it.length || out.length >= total) break;
  }
  return { stores: out, total, stdr };
}
/** 상가 한 곳 → 우리 형식 */
export function normStore(s, P) {
  const lon = +s.lon, lat = +s.lat, [x, y] = P.fwd(lon, lat);
  return { id: s.bizesId, nm: String(s.bizesNm || '').trim(), br: String(s.brchNm || '').trim(), mc: s.indsMclsCd || '', mn: s.indsMclsNm || '', sc: s.indsSclsCd || '', sn: s.indsSclsNm || '', adr: s.rdnmAdr || s.lnoAdr || '', road: s.rdnm || '', bno: s.bldMnno || '', bsl: s.bldSlno || '', flr: s.flrNo || '', sido: s.ctprvnNm || '', sgg: s.signguNm || '', dong: s.adongNm || s.ldongNm || '', lon, lat, x, y };
}

/* ======================= 2. 업종 · 브랜드 ======================= */
// 상권업종분류 (표준산업분류 기반, 2023 개편): I201 한식 · I202 중식 · I203 일식 · I204 서양식 · I205 동남아 · I206 기타 외국 · I207 구내식당 · 뷔페 · I210 기타 간이 · I211 주점 · I212 비알코올(카페)
const NOT_MEAL = ['I21001', 'I21002', 'I21008', 'I21201']; /* 빵 · 떡 · 아이스크림 · 카페 (휴게음식점 · 제과점 쪽) */
export const CATS = [
  { k: '치킨집', sc: ['I21006'], re: /치킨|통닭|닭강정|chicken/i, brandCat: 1 },
  { k: '삼겹살', sc: ['I20107'], re: /삼겹|오겹|목살|흑돼지|이베리코|생고기/ },
  { k: '고깃집', sc: ['I20107', 'I20108', 'I20109', 'I20110'], re: /고기|갈비|한우|정육식당|숯불구이|화로구이/ },
  { k: '호프', sc: ['I21103'], re: /호프|비어|맥주|beer|펍\b|pub/i },
  { k: '안주 · 요리주점', sc: ['I21104'], re: /포차|포장마차|이자카야|주막|요리주점|술집|안주/ },
  { k: '한식', mc: ['I201'] },
  { k: '일식', mc: ['I203'], re: /스시|초밥|돈까스|돈가스|라멘|우동|소바|이자카야|오마카세/ },
  { k: '양식', mc: ['I204'], re: /파스타|스테이크|비스트로|브런치|레스토랑/ },
  { k: '파인다이닝', only: /다이닝|dining|오마카세|omakase|비스트로|bistro|퀴진|cuisine|트라토리아|trattoria|코스요리|파인/i, note: '공식 분류가 없어서 상호명(다이닝 · 오마카세 · 비스트로 · 퀴진 등)으로 찾아요' },
  { k: '중식', mc: ['I202'], re: /중화|반점|짜장|짬뽕|양꼬치|훠궈|딤섬|중국집/ },
  { k: '라멘', only: /라멘|ramen|멘야|츠케멘|돈코츠|토리파이탄|이치란/i, sc: ['I20303'], scName: /라멘/ },
  { k: '분식', sc: ['I21007'], re: /분식|김밥|떡볶|만두|순대|라볶/ },
  { k: '떡볶이', only: /떡볶|떡뽁|엽떡|신전|죠스|배떡|응급실|국대떡|두끼|청년다방|걸작떡/ },
  { k: '배달', sc: ['I21006', 'I21003', 'I20103', 'I20201', 'I21004'], re: /배달|딜리버리|delivery|도시락/i, note: '배달 주력 업종(치킨 · 피자 · 족발보쌈 · 중식 · 버거)과 상호에 배달 · 도시락이 든 곳' },
  { k: '피자', sc: ['I21003'], re: /피자|pizza/i },
  { k: '버거', sc: ['I21004'], re: /버거|burger/i },
  { k: '족발 · 보쌈', sc: ['I20103'], re: /족발|보쌈/ },
  { k: '국밥 · 찌개 · 탕', sc: ['I20102'], re: /국밥|해장국|찌개|설렁탕|곰탕|감자탕|순대국/ },
  { k: '곱창 · 막창', sc: ['I20109'], re: /곱창|막창|대창/ },
  { k: '닭갈비 · 찜닭 · 오리', sc: ['I20110'], re: /닭갈비|찜닭|오리/ },
  { k: '횟집 · 해산물', sc: ['I20111', 'I20112', 'I20113'], re: /횟집|수산|조개|해물|아구|대게|복어|회센터|활어/ },
  { k: '냉면 · 국수', sc: ['I20105', 'I20106'], re: /냉면|국수|칼국수|밀면|막국수/ },
  { k: '돈가스 · 덮밥 · 카레', sc: ['I20302'], re: /돈까스|돈가스|카츠|덮밥|규동|카레/ },
  { k: '초밥 · 회(일식)', sc: ['I20301'], re: /스시|초밥|사시미|오마카세/ },
  { k: '마라탕 · 훠궈', sc: ['I20202'], re: /마라|훠궈/ },
  { k: '아시안 · 쌀국수', mc: ['I205'], re: /쌀국수|베트남|태국|팟타이|분짜/ },
  { k: '백반 · 한정식', sc: ['I20101'], re: /백반|한정식|기사식당|밥상/ },
  { k: '샌드위치 · 샐러드', sc: ['I21005'], re: /샌드위치|샐러드|토스트|써브웨이|subway/i },
  { k: '뷔페', sc: ['I20702'], re: /뷔페|buffet/i },
  { k: '일반음식점 전체', all: 1 },
];
const G = { 자사: { c: '#e60012', o: 0 }, 메이저: { c: '#1d3f9a', o: 1 }, 중견: { c: '#f07f13', o: 2 }, 브랜드: { c: '#7a49cf', o: 3 }, 개인: { c: '#5f6875', o: 4 } };
export const GROUPS = G;
const CH = ['치킨집', '배달'];
// [표시 이름, 상호 정규식, 묶음, 업종, 핀 글자]
export const BRANDS = [
  ['페리카나', /페리카나|pelicana/i, '자사', CH, '페'],
  ['교촌치킨', /교촌/, '메이저', CH, '교'], ['bhc', /bhc|비에이치씨/i, '메이저', CH, 'b'], ['BBQ', /bbq|비비큐/i, '메이저', CH, 'B'],
  ['굽네치킨', /굽네/, '중견', CH], ['처갓집양념치킨', /처갓집/, '중견', CH], ['푸라닭', /푸라닭/, '중견', CH], ['네네치킨', /네네\s?치킨|nene/i, '중견', CH], ['60계치킨', /60계/, '중견', CH, '60'],
  ['호식이두마리치킨', /호식이/, '중견', CH], ['지코바', /지코바/, '중견', CH], ['노랑통닭', /노랑통닭/, '중견', CH], ['자담치킨', /자담/, '중견', CH], ['멕시카나', /멕시카나|맥시카나/, '중견', CH],
  ['또래오래', /또래오래/, '중견', CH], ['바른치킨', /바른치킨/, '중견', CH], ['깐부치킨', /깐부/, '중견', CH], ['땅땅치킨', /땅땅치킨/, '중견', CH], ['가마치통닭', /가마치/, '중견', CH],
  ['오븐마루', /오븐마루/, '중견', CH], ['훌랄라', /훌랄라/, '중견', CH], ['티바두마리치킨', /티바/, '중견', CH], ['둘둘치킨', /둘둘치킨/, '중견', CH], ['기영이숯불두마리치킨', /기영이/, '중견', CH],
  ['치킨플러스', /치킨플러스/, '중견', CH], ['순살만공격', /순살만공격/, '중견', CH], ['썬더치킨', /썬더치킨/, '중견', CH], ['부어치킨', /부어치킨/, '중견', CH], ['꾸브라꼬', /꾸브라꼬/, '중견', CH],
  ['후라이드참잘하는집', /후라이드참잘|후참잘/, '중견', CH], ['사과나무치킨', /사과나무치킨/, '중견', CH], ['디디치킨', /디디치킨/, '중견', CH], ['치킨마루', /치킨마루/, '중견', CH], ['림스치킨', /림스치킨/, '중견', CH],
  ['보드람치킨', /보드람/, '중견', CH], ['또봉이통닭', /또봉이/, '중견', CH], ['아웃닭', /아웃닭/, '중견', CH], ['코리엔탈깻잎두마리치킨', /코리엔탈|깻잎두마리/, '중견', CH], ['가마로강정', /가마로/, '중견', CH], ['만석닭강정', /만석닭강정/, '중견', CH],
  ['KFC', /kfc|케이에프씨/i, '중견', [...CH, '버거'], 'K'], ['맘스터치', /맘스터치/, '중견', [...CH, '버거']],
  ['엽기떡볶이', /엽기떡볶이|엽떡/, '브랜드', ['떡볶이', '분식', '배달']], ['신전떡볶이', /신전떡볶이|신전/, '브랜드', ['떡볶이', '분식']], ['죠스떡볶이', /죠스/, '브랜드', ['떡볶이', '분식']], ['배떡', /배떡/, '브랜드', ['떡볶이', '분식', '배달']],
  ['응급실떡볶이', /응급실/, '브랜드', ['떡볶이', '분식']], ['국대떡볶이', /국대떡볶이/, '브랜드', ['떡볶이', '분식']], ['두끼', /두끼/, '브랜드', ['떡볶이', '분식']], ['청년다방', /청년다방/, '브랜드', ['떡볶이', '분식']],
  ['김밥천국', /김밥천국/, '브랜드', ['분식']], ['김가네', /김가네/, '브랜드', ['분식']], ['고봉민김밥', /고봉민/, '브랜드', ['분식']], ['바르다김선생', /바르다김선생/, '브랜드', ['분식']],
  ['도미노피자', /도미노/, '브랜드', ['피자', '배달']], ['피자헛', /피자헛/, '브랜드', ['피자', '배달']], ['미스터피자', /미스터피자/, '브랜드', ['피자', '배달']], ['파파존스', /파파존스/, '브랜드', ['피자', '배달']], ['피자스쿨', /피자스쿨/, '브랜드', ['피자', '배달']], ['반올림피자', /반올림피자/, '브랜드', ['피자', '배달']], ['피자알볼로', /피자알볼로/, '브랜드', ['피자', '배달']], ['피자마루', /피자마루/, '브랜드', ['피자', '배달']],
  ['롯데리아', /롯데리아/, '브랜드', ['버거']], ['맥도날드', /맥도날드/, '브랜드', ['버거']], ['버거킹', /버거킹/, '브랜드', ['버거']], ['노브랜드버거', /노브랜드버거/, '브랜드', ['버거']], ['프랭크버거', /프랭크버거/, '브랜드', ['버거']],
  ['원할머니보쌈', /원할머니/, '브랜드', ['족발 · 보쌈', '배달']], ['가장맛있는족발', /가장맛있는족발/, '브랜드', ['족발 · 보쌈', '배달']], ['장충동왕족발', /장충동왕족발/, '브랜드', ['족발 · 보쌈', '배달']], ['족발야시장', /족발야시장/, '브랜드', ['족발 · 보쌈', '배달']],
  ['홍콩반점', /홍콩반점/, '브랜드', ['중식', '배달']], ['짬뽕지존', /짬뽕지존/, '브랜드', ['중식']], ['탕화쿵푸', /탕화쿵푸/, '브랜드', ['마라탕 · 훠궈', '중식']], ['라화쿵부', /라화쿵부/, '브랜드', ['마라탕 · 훠궈', '중식']],
  ['역전할머니맥주', /역전할머니/, '브랜드', ['호프']], ['생활맥주', /생활맥주/, '브랜드', ['호프']], ['크라운호프', /크라운호프/, '브랜드', ['호프']], ['봉구비어', /봉구비어/, '브랜드', ['호프']], ['금별맥주', /금별맥주/, '브랜드', ['호프']],
  ['투다리', /투다리/, '브랜드', ['안주 · 요리주점']], ['한신포차', /한신포차/, '브랜드', ['안주 · 요리주점']], ['용용선생', /용용선생/, '브랜드', ['안주 · 요리주점']],
  ['명륜진사갈비', /명륜진사/, '브랜드', ['고깃집']], ['새마을식당', /새마을식당/, '브랜드', ['고깃집', '삼겹살']], ['하남돼지집', /하남돼지/, '브랜드', ['고깃집', '삼겹살']], ['서래갈매기', /서래갈매기/, '브랜드', ['고깃집']], ['육쌈냉면', /육쌈/, '브랜드', ['냉면 · 국수']],
  ['본죽', /본죽/, '브랜드', ['한식']], ['한솥도시락', /한솥/, '브랜드', ['배달', '한식']], ['역전우동', /역전우동/, '브랜드', ['일식']], ['멘야산다이메', /산다이메/, '브랜드', ['라멘', '일식']],
  ['아웃백', /아웃백/, '브랜드', ['양식']], ['빕스', /빕스|vips/i, '브랜드', ['양식', '뷔페']], ['애슐리', /애슐리/, '브랜드', ['뷔페', '양식']],
];
const flat = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
export function brandOf(nm) { const f = flat(nm); for (const b of BRANDS) if (b[1].test(f) || b[1].test(nm)) return { n: b[0], g: b[2], cats: b[3], ch: b[4] || b[0][0] }; return null; }
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 상가 s 가 업종 cat 에 드는가 */
export function inCat(s, cat) {
  if (cat.all) return !NOT_MEAL.includes(s.sc);
  const b = s.b; if (b && b.cats.includes(cat.k)) return true;
  const nm = s.nm + ' ' + s.br;
  if (cat.only) return !NOT_MEAL.includes(s.sc) && (cat.only.test(nm) || (cat.scName && cat.sc && cat.sc.includes(s.sc) && cat.scName.test(s.sn)));
  if (cat.sc && cat.sc.includes(s.sc)) return true;
  if (cat.mc && cat.mc.includes(s.mc)) return true;
  return !!(cat.re && !NOT_MEAL.includes(s.sc) && cat.re.test(nm));
}
export function freeCat(word) { const w = String(word || '').trim(); if (!w) return null; const re = new RegExp(w.split(/[,\s/]+/).filter(Boolean).map(reEsc).join('|'), 'i'); return { k: w, free: 1, test: (s) => !NOT_MEAL.includes(s.sc) && (re.test(s.nm + ' ' + s.br) || re.test(s.sn) || re.test(s.mn)) }; }
export const groupOf = (s) => (s.b ? s.b.g : '개인');

/* ======================= 3. 행정안전부 일반음식점 인허가: 개업일 · 영업상태 ======================= */
const PERMIT = 'https://apis.data.go.kr/1741000/general_restaurants/info';
// 개방자치단체코드 (서울 25개 구 · 인허가 데이터의 시군구 코드). 다른 지역은 화면에서 한 번 넣으면 기억
const SEOUL = { 종로구: '3000000', 중구: '3010000', 용산구: '3020000', 성동구: '3030000', 광진구: '3040000', 동대문구: '3050000', 중랑구: '3060000', 성북구: '3070000', 강북구: '3080000', 도봉구: '3090000', 노원구: '3100000', 은평구: '3110000', 서대문구: '3120000', 마포구: '3130000', 양천구: '3140000', 강서구: '3150000', 구로구: '3160000', 금천구: '3170000', 영등포구: '3180000', 동작구: '3190000', 관악구: '3200000', 서초구: '3210000', 강남구: '3220000', 송파구: '3230000', 강동구: '3240000' };
const LSC = 'byr.opnCodes', LSP = 'byr.permitCache';
const jget = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const areaKey = (s) => `${s.sido} ${s.sgg}`.trim();
export function opnCode(s) { const my = jget(LSC, {})[areaKey(s)]; if (my) return my; if (/서울/.test(s.sido)) return SEOUL[String(s.sgg).split(' ').pop()] || null; return null; }
export function setOpnCode(area, code) { const m = jget(LSC, {}); if (code) m[area] = code; else delete m[area]; jset(LSC, m); }

/* EPSG:5174 (Bessel 중부원점 TM, 보정계수 없음) → WGS84 경위도 */
export function tmToWgs(X, Y) {
  const a = 6377397.155, f = 1 / 299.1528128, e2 = 2 * f - f * f, k0 = 1, lat0 = (38 * Math.PI) / 180, lon0 = ((127 + 10.405 / 3600) * Math.PI) / 180, FE = 200000, FN = 500000;
  const M = (p) => a * ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256) * p - ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * p) + ((15 * e2 * e2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * p) - ((35 * e2 ** 3) / 3072) * Math.sin(6 * p));
  const ep2 = e2 / (1 - e2), m1 = M(lat0) + (Y - FN) / k0, mu = m1 / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256)), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) + ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) + ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) + ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(p1) ** 2, T1 = Math.tan(p1) ** 2, N1 = a / Math.sqrt(1 - e2 * Math.sin(p1) ** 2), R1 = (a * (1 - e2)) / (1 - e2 * Math.sin(p1) ** 2) ** 1.5, D = (X - FE) / (N1 * k0);
  const lat = p1 - ((N1 * Math.tan(p1)) / R1) * ((D * D) / 2 - ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 + ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720);
  const lon = lon0 + (D - ((1 + 2 * T1 + C1) * D ** 3) / 6 + ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) / Math.cos(p1);
  // Bessel → WGS84 (7변수: -115.80, 474.99, 674.11, 1.16″, -2.31″, -1.63″, 6.43ppm)
  const N = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2), x = N * Math.cos(lat) * Math.cos(lon), y = N * Math.cos(lat) * Math.sin(lon), z = N * (1 - e2) * Math.sin(lat);
  const sec = Math.PI / 648000, rx = 1.16 * sec, ry = -2.31 * sec, rz = -1.63 * sec, sc = 1 + 6.43e-6;
  const X2 = -115.8 + sc * (x - rz * y + ry * z), Y2 = 474.99 + sc * (rz * x + y - rx * z), Z2 = 674.11 + sc * (-ry * x + rx * y + z);
  const A = 6378137, F = 1 / 298.257223563, E2 = 2 * F - F * F, p = Math.hypot(X2, Y2); let la = Math.atan2(Z2, p * (1 - E2));
  for (let i = 0; i < 6; i++) { const Nn = A / Math.sqrt(1 - E2 * Math.sin(la) ** 2); la = Math.atan2(Z2 + E2 * Nn * Math.sin(la), p); }
  return [(Math.atan2(Y2, X2) * 180) / Math.PI, (la * 180) / Math.PI];
}
const ymd = (v) => { const m = String(v || '').replace(/[^0-9]/g, '').match(/^(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}.${m[2]}.${m[3]}` : ''; };
const pickK = (o, re) => { for (const [k, v] of Object.entries(o || {})) if (re.test(k) && v != null && String(v).trim() !== '') return v; return ''; };
const STAT = { '01': '영업/정상', '02': '휴업', '03': '폐업', '04': '취소/말소', '05': '제외/삭제' };
function permitOf(it) {
  const st = pickK(it, /^SALS_STTS_NM$|^TRDSTATENM$|영업상태명/i) || STAT[String(pickK(it, /^SALS_STTS_CD$|^TRDSTATEGBN$/i)).padStart(2, '0')] || '';
  const open = ymd(pickK(it, /LCPMT|PRMS_?YMD|APVPERMYMD|인허가일자|LCNS.*(YMD|DE)/i)), close = ymd(pickK(it, /CLSBIZ|DCBYMD|폐업일자/i)), x = +pickK(it, /CRD_INFO_X|^X$/i), y = +pickK(it, /CRD_INFO_Y|^Y$/i);
  return { nm: pickK(it, /BPLC_NM|BPLCNM|사업장명/i), adr: pickK(it, /ROAD_NM_ADDR|RDNWHLADDR|도로명/i) || pickK(it, /LOTNO_ADDR|SITEWHLADDR|지번/i), open, close, st, active: /영업|정상/.test(st) || String(pickK(it, /^SALS_STTS_CD$/i)) === '01', kind: pickK(it, /BZSTAT_SE_NM|UPTAENM|업태/i), ll: x && y ? tmToWgs(x, y) : null };
}
async function permitGet(code, cond, key) {
  const q = Object.entries({ 'cond[OPN_ATMY_GRP_CD::EQ]': code, ...cond }).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  const t = await withTimeout(SITE.netGet(`${PERMIT}?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=100&returnType=JSON&${q}`), 70000), e = portalErr(t); if (e) throw e;
  let j; try { j = JSON.parse(t); } catch { throw new SITE.NetError('E-JSON', t.slice(0, 160)); }
  const B = (j.response && j.response.body) || j.body || {}, it = B.items && (Array.isArray(B.items) ? B.items : B.items.item ? [].concat(B.items.item) : []);
  return { items: it || [], raw: (it && it[0]) || null };
}
const bigram = (s) => { const f = flat(s).replace(/[^0-9a-z가-힣]/g, ''), o = new Set(); for (let i = 0; i < f.length - 1; i++) o.add(f.slice(i, i + 2)); return o; };
const sim = (a, b) => { const A = bigram(a), B = bigram(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return (2 * n) / (A.size + B.size); };
const distLL = (a, b) => Math.hypot((a[0] - b[0]) * 88200, (a[1] - b[1]) * 110900);
/** 경쟁점 목록에 인허가(개업일 · 영업상태)를 붙인다. 같은 건물은 한 번만 묻는다. */
export async function enrichPermits(list, key, step = () => {}, isStop = () => false) {
  const cache = jget(LSP, {}), now = Date.now(), todo = [], diag = {}; let done = 0, hit = 0;
  for (const s of list) { const c = cache[s.id]; if (c && now - c.at < 30 * 864e5) { s.pm = c; hit++; } else todo.push(s); }
  const byB = new Map(); for (const s of todo) { const code = opnCode(s); if (!code) { s.pm = { need: areaKey(s) }; continue; } const k = code + '|' + s.road + ' ' + s.bno; if (!byB.has(k)) byB.set(k, { code, road: s.road, bno: s.bno, list: [] }); byB.get(k).list.push(s); }
  const jobs = [...byB.values()]; step(`개업일 확인: 저장된 것 ${hit}곳 · 새로 물어볼 건물 ${jobs.length}곳`);
  const match = (s, its) => { let best = null, bs = 0; for (const it of its) { const p = permitOf(it), d = p.ll ? distLL(p.ll, [s.lon, s.lat]) : 999, b1 = s.b, b2 = brandOf(p.nm), sc = (b1 && b2 && b1.n === b2.n ? 0.6 : 0) + sim(s.nm + s.br, p.nm) + (d < 25 ? 0.3 : d < 60 ? 0.15 : 0) + (p.active ? 0.05 : 0); if (sc > bs) { bs = sc; best = p; } } return bs >= 0.45 ? best : null; };
  const work = async () => {
    while (jobs.length && !isStop()) { const J = jobs.shift(); let its = [];
      try {
        if (J.road && J.bno && !diag.noLike) { const r = await permitGet(J.code, { 'cond[ROAD_NM_ADDR::LIKE]': `${J.road} ${J.bno}` }, key); its = r.items.filter((it) => new RegExp(reEsc(J.road) + '\\s*' + J.bno + '(?![0-9])').test(permitOf(it).adr)); if (r.raw && !diag.keys) diag.keys = Object.keys(r.raw).join(','); }
        for (const s of J.list) { if (match(s, its)) continue; if (diag.noLike) break; const r = await permitGet(J.code, { 'cond[BPLC_NM::LIKE]': (s.br || s.nm).slice(0, 12) }, key); its = its.concat(r.items); if (r.raw && !diag.keys) diag.keys = Object.keys(r.raw).join(','); }
      } catch (e) { if (e.code === 'E-PARAM') { diag.noLike = 1; step('⛔ 인허가 API 가 주소 · 이름 검색(LIKE)을 받지 않아요 — 개업일 확인을 멈춰요'); } else if (e.code === 'E-KEY' || e.code === 'E-LIMIT') { jobs.length = 0; step('⛔ 인허가: ' + e.message); } else step('인허가 응답 늦음 · 건너뜀 (' + (e.code || e.message) + ')'); }
      for (const s of J.list) { const p = match(s, its); s.pm = p ? { open: p.open, close: p.close, st: p.st, active: p.active, nm: p.nm, kind: p.kind, at: now } : { none: 1, at: now }; cache[s.id] = s.pm; }
      done++; jset(LSP, cache); step(`개업일 확인 ${done}/${done + jobs.length} 건물 (공공 서버가 느려 한 건물에 10~40초)`, true);
    }
  };
  await Promise.all([work(), work()]);
  if (diag.keys) step('인허가 필드: ' + diag.keys.slice(0, 300));
  return diag;
}

/* ======================= 4. 원형 상권 지도 (네이버 · 구글 지도 느낌, 캔버스) ======================= */
const ROADC = { motorway: ['#f6c25b', '#d99a2b'], trunk: ['#f8cf72', '#dca43b'], primary: ['#fde7a6', '#e2c27a'], secondary: ['#fff3cc', '#dfcf9f'] };
const cenOf = (P) => [P.reduce((a, q) => a + q[0], 0) / P.length, P.reduce((a, q) => a + q[1], 0) / P.length];
export class MarketMap {
  constructor(cv, tip) {
    this.cv = cv; this.g = cv.getContext('2d'); this.tip = tip; this.vr = V_DEF; this.c = [0, 0]; this.site = null; this.pins = []; this.dots = []; this.o = [0, 0]; this.hover = null; this.sel = null; this.placed = []; this.onPick = null; this.onPin = null; this.onZoom = null;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(cv.parentElement); this.bind(); this.resize();
  }
  resize() { const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); this.W = Math.max(50, r.width); this.H = Math.max(50, r.height); this.cv.width = Math.round(this.W * d); this.cv.height = Math.round(this.H * d); this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px'; this.dpr = d; this.draw(); }
  get s() { return (Math.min(this.W, this.H) / 2 - 14) / this.vr; }
  w2s(x, y) { const s = this.s; return [this.W / 2 + (x - this.c[0]) * s, this.H / 2 + (y - this.c[1]) * s]; }
  s2w(px, py) { const s = this.s; return [this.c[0] + (px - this.W / 2) / s, this.c[1] + (py - this.H / 2) / s]; }
  set(site, o) { this.site = site; this.o = o || [0, 0]; this.draw(); }
  setPins(pins, dots) { this.pins = pins || []; this.dots = dots || []; this.draw(); }
  center(x, y) { this.c = [x, y]; this.clamp(); this.draw(); }
  clamp() { const d = Math.hypot(...this.c), lim = R_MAX; if (d > lim) this.c = [(this.c[0] / d) * lim, (this.c[1] / d) * lim]; }
  zoomTo(vr, px = this.W / 2, py = this.H / 2) { const before = this.s2w(px, py); this.vr = Math.max(V_MIN, Math.min(R_MAX, vr)); const after = this.s2w(px, py); this.c = [this.c[0] + before[0] - after[0], this.c[1] + before[1] - after[1]]; if (this.vr >= R_MAX - 1) this.c = [0, 0]; this.clamp(); this.draw(); this.onZoom && this.onZoom(this.vr); }
  zoomBy(f) { this.zoomTo(this.vr * f); }
  bind() {
    const cv = this.cv, P = new Map(); let pinch = null, moved = false, down = null;
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); this.zoomTo(this.vr * Math.exp(e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); P.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]); moved = false; down = [e.clientX - r.left, e.clientY - r.top];
      if (P.size === 2) { const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), vr: this.vr, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; } });
    cv.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(), p = [e.clientX - r.left, e.clientY - r.top];
      if (!P.has(e.pointerId)) { this.hoverAt(p[0], p[1]); return; }
      const q = P.get(e.pointerId); P.set(e.pointerId, p);
      if (P.size === 2 && pinch) { const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d > 10) this.zoomTo((pinch.vr * pinch.d) / d, pinch.m[0], pinch.m[1]); moved = true; return; }
      if (P.size === 1) { if (!moved && Math.hypot(p[0] - down[0], p[1] - down[1]) < 5) return; moved = true; const s = this.s; this.c = [this.c[0] - (p[0] - q[0]) / s, this.c[1] - (p[1] - q[1]) / s]; this.clamp(); this.draw(); this.hideTip(); } });
    const up = (e) => { const was = P.has(e.pointerId); P.delete(e.pointerId); if (P.size < 2) pinch = null; if (!was || moved) return; const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, pin = this.pinAt(x, y);
      if (pin) { this.sel = pin.s.id; this.showTip(pin, x, y); this.draw(); this.onPin && this.onPin(pin.s); return; }
      const w = this.s2w(x, y), bi = this.buildingAt(w[0], w[1]); this.hideTip(); if (bi != null && this.onPick) this.onPick(bi); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { P.delete(e.pointerId); pinch = null; });
    cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.hover = null; this.hideTip(); this.draw(); } });
  }
  buildingAt(x, y) { const B = (this.site && this.site.buildings) || []; for (let i = B.length - 1; i >= 0; i--) { const p = B[i].p; if (Math.abs(p[0][0] - x) > 200 || Math.abs(p[0][1] - y) > 200) continue; if (SITE.inPoly(x, y, p)) return i; } return null; }
  pinAt(x, y) { for (let i = this.placed.length - 1; i >= 0; i--) { const q = this.placed[i]; if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return q; } return null; }
  hoverAt(x, y) { const p = this.pinAt(x, y); this.cv.style.cursor = p ? 'pointer' : 'grab'; const id = p ? p.s.id : null; if (id !== this.hover) { this.hover = id; this.draw(); } if (p) this.showTip(p, x, y); else if (!this.sel) this.hideTip(); }
  showTip(q, x, y) { const t = this.tip; if (!t) return; t.innerHTML = tipHtml(q.s); t.hidden = false; const tw = t.offsetWidth, th = t.offsetHeight; t.style.left = Math.max(6, Math.min(this.W - tw - 6, x - tw / 2)) + 'px'; t.style.top = (y - th - 18 > 6 ? y - th - 18 : y + 22) + 'px'; }
  hideTip() { if (this.tip) this.tip.hidden = true; }
  draw() {
    const g = this.g, W = this.W, H = this.H, d = this.dpr || 1; if (!g) return; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = '#d9dbde'; g.fillRect(0, 0, W, H);
    const S = this.site; if (!S) { g.fillStyle = '#7d838c'; g.font = '600 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('주소를 찾으면 반경 1km 상권 지도가 그려져요', W / 2, H / 2); return; }
    const s = this.s, T = (x, y) => this.w2s(x, y), [ox, oy] = T(0, 0), Rp = R_MAX * s, vis = this.vr * 1.6;
    const path = (P, close) => { g.beginPath(); for (let k = 0; k < P.length; k++) { const [x, y] = T(P[k][0], P[k][1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } if (close) g.closePath(); };
    const bx0 = this.c[0] - vis - 30, bx1 = this.c[0] + vis + 30, by0 = this.c[1] - vis - 30, by1 = this.c[1] + vis + 30, bb = (o) => o._bb || (o._bb = o.p.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [1e9, 1e9, -1e9, -1e9]));
    const near = (P, o) => { const b = o ? bb(o) : bb({ p: P }); return b[2] >= bx0 && b[0] <= bx1 && b[3] >= by0 && b[1] <= by1; };
    g.save(); g.beginPath(); g.arc(ox, oy, Rp, 0, Math.PI * 2); g.fillStyle = '#f3f1ec'; g.fill(); g.clip(); g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = '#d3ebc5'; for (const a of S.green || []) { if (a.p.length > 2 && near(a.p, a)) { path(a.p, 1); g.fill(); } }
    g.fillStyle = '#aad3f2'; for (const a of S.water || []) { if (a.p.length > 2 && near(a.p, a)) { path(a.p, 1); g.fill(); } }
    g.strokeStyle = '#aad3f2'; for (const r of S.rivers || []) { if (!near(r.p, r)) continue; g.lineWidth = Math.max(1.6, r.w * s); path(r.p); g.stroke(); }
    const roads = (S.roads || []).filter((r) => near(r.p, r)), rank = (k) => ({ motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2 }[k] || 1), foot = (r) => r.w < 3;
    roads.sort((a, b) => rank(a.k) - rank(b.k));
    for (const pass of [0, 1]) for (const r of roads) { if (foot(r)) continue; const c = ROADC[r.k] || ['#ffffff', '#d9d4ca'], w = Math.max(pass ? 1.2 : 2.4, r.w * s + (pass ? 0 : 2)); g.strokeStyle = pass ? c[0] : c[1]; g.lineWidth = w; path(r.p); g.stroke(); }
    if (this.vr <= 350) { g.setLineDash([3, 3]); g.strokeStyle = '#cbc5b9'; g.lineWidth = 1; for (const r of roads) if (foot(r)) { path(r.p); g.stroke(); } g.setLineDash([]); }
    const B = S.buildings || []; g.fillStyle = '#ffffff'; g.strokeStyle = '#d5cfc3'; g.lineWidth = 0.8;
    for (let i = 0; i < B.length; i++) { if (i === S.hit || !near(B[i].p, B[i])) continue; path(B[i].p, 1); g.fill(); if (s > 0.35) g.stroke(); }
    if (B[S.hit]) { path(B[S.hit].p, 1); g.fillStyle = '#ffd21a'; g.fill(); g.strokeStyle = '#b98a00'; g.lineWidth = 2; g.stroke(); }
    // 도로 이름 (가까이 볼 때)
    if (this.vr <= 520) { const done = new Set(), hp = B[S.hit] ? T(...cenOf(B[S.hit].p)) : null; g.font = '600 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const r of roads.slice().reverse()) { if (!r.name || done.has(r.name) || rank(r.k) < (this.vr <= 220 ? 1 : 2)) continue; let best = null, L = 0; for (let k = 1; k < r.p.length; k++) { const a = T(...r.p[k - 1]), b = T(...r.p[k]), l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > L) { L = l; best = [a, b]; } }
        if (!best || L < g.measureText(r.name).width + 24) continue; let [a, b] = best; if (b[0] < a[0]) [a, b] = [b, a]; const at = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], free = ([x, y]) => x > 20 && y > 20 && x < W - 20 && y < H - 20 && !(hp && Math.hypot(x - hp[0], y - hp[1]) < 90);
        const m = [0.5, 0.3, 0.7, 0.2, 0.8].map(at).find(free); if (!m) continue; const [mx, my] = m; done.add(r.name);
        g.save(); g.translate(mx, my); g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0])); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(r.name, 0, 0); g.fillStyle = '#6b6457'; g.fillText(r.name, 0, 0); g.restore(); } }
    g.restore();
    // 반경 고리 300 · 500 · 1000
    g.save(); g.setLineDash([6, 5]); g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom';
    for (const rr of [300, 500, 1000]) { const rp = rr * s; g.strokeStyle = rr === 1000 ? 'rgba(60,70,90,.55)' : 'rgba(47,125,246,.55)'; g.lineWidth = rr === 1000 ? 1.6 : 1.3; const [cx, cy] = T(this.o[0], this.o[1]); g.beginPath(); g.arc(rr === 1000 ? ox : cx, rr === 1000 ? oy : cy, rp, 0, Math.PI * 2); g.stroke(); const lx = (rr === 1000 ? ox : cx) + rp * 0.707 + 4, ly = (rr === 1000 ? oy : cy) - rp * 0.707; if (lx > 0 && lx < W - 30 && ly > 12 && ly < H) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(lx - 2, ly - 14, 38, 14); g.fillStyle = rr === 1000 ? '#3c465a' : '#1f63d6'; g.fillText(rr === 1000 ? '1km' : rr + 'm', lx, ly); } }
    g.restore();
    // 전체 음식점 (작은 점)
    if (this.dots.length) { g.fillStyle = 'rgba(95,104,117,.45)'; for (const p of this.dots) { const [x, y] = T(p.x, p.y); if (x > -4 && y > -4 && x < W + 4 && y < H + 4) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); } } }
    // 찾은 상가 표시
    if (B[S.hit]) { const [x, y] = T(...cenOf(B[S.hit].p)), lab = S.hitName || '내 상가'; g.font = '800 12px system-ui, sans-serif'; const tw = g.measureText(lab).width + 14; g.fillStyle = '#1b1d21'; roundRect(g, x - tw / 2, y - 34, tw, 20, 10); g.fill(); g.fillStyle = '#ffd21a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, x, y - 24); }
    this.layoutPins(); this.drawPins();
    // 축척
    const nice = [10, 20, 50, 100, 200, 300, 500], m = nice.find((v) => v * s > 70) || 500, bw = m * s; g.fillStyle = 'rgba(255,255,255,.9)'; roundRect(g, 12, H - 34, bw + 52, 22, 6); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(20, H - 18); g.lineTo(20 + bw, H - 18); g.stroke(); g.fillStyle = '#333'; g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(m + 'm', 26 + bw, H - 22);
  }
  layoutPins() {
    const PW = 26, PH = 34, out = [], W = this.W, H = this.H, rects = [], hit = (r) => rects.some((q) => r.x < q.x + q.w - 1 && r.x + r.w > q.x + 1 && r.y < q.y + q.h - 1 && r.y + r.h > q.y + 1);
    const S = this.site, B = S && S.buildings[S.hit]; if (B) { const [x, y] = this.w2s(...cenOf(B.p)); rects.push({ x: x - 60, y: y - 36, w: 120, h: 24 }); }
    const order = this.pins.slice().sort((a, b) => (a.id === this.sel ? -1 : b.id === this.sel ? 1 : 0) || G[groupOf(a)].o - G[groupOf(b)].o || a.d - b.d);
    const offs = [[0, 0]]; for (const r of [30, 50, 72, 96]) for (let k = 0; k < 10; k++) { const t = (k / 10) * Math.PI * 2 - Math.PI / 2; offs.push([Math.cos(t) * r, Math.sin(t) * r * 0.8]); }
    for (const s of order) { const [ax, ay] = this.w2s(s.x, s.y); if (ax < -40 || ay < -40 || ax > W + 40 || ay > H + 60) continue; let ok = null;
      for (const [dx, dy] of offs) { const r = { x: ax + dx - PW / 2, y: ay + dy - PH, w: PW, h: PH }; if (!hit(r)) { ok = r; break; } }
      if (ok) { rects.push(ok); out.push({ ...ok, s, ax, ay, off: Math.abs(ok.x + PW / 2 - ax) > 1 || Math.abs(ok.y + PH - ay) > 1 }); } else out.push({ s, ax, ay, hidden: 1, x: ax - 4, y: ay - 4, w: 8, h: 8 }); }
    this.placed = out;
  }
  drawPins() {
    const g = this.g;
    for (const q of this.placed) if (q.hidden) { g.fillStyle = G[groupOf(q.s)].c; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(q.ax, q.ay, 4, 0, Math.PI * 2); g.fill(); g.stroke(); }
    for (const q of this.placed) if (q.off && !q.hidden) { g.strokeStyle = 'rgba(30,35,45,.65)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(q.x + q.w / 2, q.y + q.h); g.lineTo(q.ax, q.ay); g.stroke(); g.fillStyle = '#1e232d'; g.beginPath(); g.arc(q.ax, q.ay, 2.6, 0, Math.PI * 2); g.fill(); }
    for (const q of this.placed) { if (q.hidden) continue; const big = q.s.id === this.sel || q.s.id === this.hover; balloon(g, q.x + q.w / 2, q.y + q.h, big ? 1.22 : 1, G[groupOf(q.s)].c, q.s.b ? q.s.b.ch : (q.s.nm || '?')[0], q.s.pm && q.s.pm.active === false); }
  }
  /** 보고서 그림: 머리말 + 지도 */
  snapshot(title, lines) { const d = this.dpr || 1, hh = 26 + lines.length * 18, c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height + Math.round(hh * d); const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); g.scale(d, d); g.fillStyle = '#111'; g.font = '800 16px system-ui, sans-serif'; g.textBaseline = 'top'; g.fillText(title, 12, 8); g.font = '500 12.5px system-ui, sans-serif'; g.fillStyle = '#444'; lines.forEach((l, i) => g.fillText(l, 12, 30 + i * 18)); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(this.cv, 0, Math.round(hh * d)); return c; }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** 아래로 뾰족한 풍선 핀: (tx, ty) = 뾰족한 끝 */
function balloon(g, tx, ty, k, col, ch, closed) {
  const r = 11 * k, dd = 23 * k, cx = tx, cy = ty - dd, a = Math.acos(r / dd);
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 4 * k; g.shadowOffsetY = 1.5;
  g.beginPath(); g.moveTo(tx, ty); g.arc(cx, cy, r, Math.PI / 2 + a, Math.PI / 2 - a + Math.PI * 2, false); g.closePath(); g.fillStyle = closed ? '#9aa0a8' : col; g.fill(); g.restore();
  g.lineWidth = 1.8; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(tx, ty); g.arc(cx, cy, r, Math.PI / 2 + a, Math.PI / 2 - a + Math.PI * 2, false); g.closePath(); g.stroke();
  const t = String(ch || '').slice(0, 2); g.fillStyle = '#fff'; g.font = `800 ${(t.length > 1 ? 9.5 : 11.5) * k}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, cx, cy + 0.5);
}
export function tipHtml(s) {
  const p = s.pm || {}, st = p.need ? `<i>개업일: ${esc(p.need)} 코드가 필요해요</i>` : p.none ? '<i>인허가 자료에서 못 찾았어요</i>' : p.st || p.open ? `개업 ${esc(p.open || '-')} · <b class="${p.active === false ? 'bad' : 'ok'}">${esc(p.st || '')}</b>${p.close ? ` · 폐업 ${esc(p.close)}` : ''}` : '<i>개업일 확인 전</i>';
  return `<b>${esc(s.b ? s.b.n : s.nm)}</b>${s.b ? `<small>${esc(s.nm)} ${esc(s.br)}</small>` : s.br ? `<small>${esc(s.br)}</small>` : ''}<span>${esc(s.sn || s.mn)} · ${Math.round(s.d)}m${s.flr ? ` · ${esc(s.flr)}층` : ''}</span><span>${st}</span><span class="g" style="--c:${G[groupOf(s)].c}">${esc(groupOf(s))}</span>`;
}

/* ======================= 5. 화면 ======================= */
const ST = { q: '', res: [], place: null, site: null, all: [], stdr: '', sel: ['치킨집'], free: '', list: [], log: '', busy: false, showAll: false, perm: '', stopPerm: false, keyOpen: false, map: null, ctx: null, zip: '' };
const LSSEL = 'byr.marketSel';
try { window.__byrMarket = ST; } catch {} /* 점검용 */
const log = (t) => { ST.log += (ST.log ? '\n' : '') + t; const el = $('#mkLog'); if (el) { el.hidden = false; el.textContent = ST.log; el.scrollTop = 1e9; } };
const live = (t) => { const el = $('#mkLive'); if (el) { el.hidden = !t; el.innerHTML = t ? `<span class="spin"></span><span>${esc(t)}</span>` : ''; } };
/** ctx: { toast, saveFile, open3d(place) } */
export function openMarket(ctx) {
  ST.ctx = ctx; try { const v = JSON.parse(localStorage.getItem(LSSEL) || 'null'); if (Array.isArray(v) && v.length) ST.sel = v; } catch {}
  const sec = $('#market'); sec.hidden = false;
  if (!ST.map) { ST.map = new MarketMap($('#mkCv'), $('#mkTip')); ST.map.onZoom = (vr) => { const z = $('#mkZv'); if (z) z.textContent = vr >= 999 ? '1km' : Math.round(vr) + 'm'; }; ST.map.onPick = pickBuilding; ST.map.onPin = (s) => { const li = $(`[data-mk-s="${s.id}"]`); if (li) { $$('.mkli.on').forEach((x) => x.classList.remove('on')); li.classList.add('on'); li.scrollIntoView({ block: 'nearest' }); } };
    $('#mkBack').onclick = () => { sec.hidden = true; ST.stopPerm = true; };
    $('#mkZin').onclick = () => ST.map.zoomBy(1 / 1.4); $('#mkZout').onclick = () => ST.map.zoomBy(1.4);
    $('#mkZ300').onclick = () => { ST.map.c = [...ST.map.o]; ST.map.zoomTo(V_DEF); }; $('#mkZ1k').onclick = () => ST.map.zoomTo(R_MAX); }
  renderPanel(); requestAnimationFrame(() => ST.map.resize());
}
const V = () => SITE.vworld();
function renderPanel() {
  const P = $('#mkPanel'), v = V(), has = !!ST.site;
  P.innerHTML = `
    <section class="mks"><b>1. 상가 주소 찾기</b>
      <div class="mkrow"><input id="mkQ" value="${esc(ST.q)}" placeholder="도로명 · 지번 · 건물 이름 (예: 강남대로 396)" autocomplete="off"><button class="btn pri" data-mk="find">찾기</button></div>
      <div class="btns"><button class="btn" data-mk="zip">우편번호 찾기</button>${ST.zip ? `<small class="hint">우편번호 ${esc(ST.zip)}</small>` : ''}</div>
      <div id="mkZip" hidden><div class="mkzipbar"><small>우편번호 · 도로명 · 지번 · 건물명으로 찾아요</small><button class="btn" data-mk="zipx">닫기</button></div><div id="mkZipIn"></div></div>
      <div class="sfres">${ST.res.map((r, i) => `<button class="sfr ${ST.place === r ? 'on' : ''}" data-mk-r="${i}"><b>${esc(r.title)}</b><small>${esc(r.sub || '')}</small></button>`).join('')}</div>
    </section>
    ${has ? `<section class="mks"><b>2. 하려는 업종</b>
      <div class="chips mkchips">${CATS.map((c) => `<button data-mk-c="${esc(c.k)}" aria-pressed="${ST.sel.includes(c.k)}">${esc(c.k)}</button>`).join('')}</div>
      <div class="mkrow"><input id="mkFree" value="${esc(ST.free)}" placeholder="직접 입력 (예: 닭발, 우동, 이자카야)" autocomplete="off"><button class="btn" data-mk="free">적용</button></div>
      ${CATS.filter((c) => ST.sel.includes(c.k) && c.note).map((c) => `<p class="hint">· ${esc(c.k)}: ${esc(c.note)}</p>`).join('')}
      <label class="mkck"><input type="checkbox" id="mkAll" ${ST.showAll ? 'checked' : ''}> 다른 음식점도 회색 점으로 보기</label>
    </section>
    <section class="mks" id="mkSum"></section>
    <section class="mks"><div class="mkrow2"><b>경쟁사 목록</b><small id="mkPerm" class="hint"></small></div><div id="mkList" class="mklist"></div></section>
    <section class="mks"><b>보고서</b><div class="btns"><button class="btn" data-mk="png">지도 그림 저장 (PNG)</button><button class="btn" data-mk="csv">목록 저장 (엑셀 CSV)</button><button class="btn" data-mk="perm">개업일 다시 확인</button><button class="btn" data-mk="3d">이 상가 3D 로 보기</button></div></section>` : ''}
    <section class="mks"><button class="mkfold" data-mk="keys" aria-expanded="${ST.keyOpen || !v.dkey}"><b>키 설정</b><small>${v.dkey ? '공공데이터포털 ✓' : '공공데이터포털 키 필요'} · ${v.key ? '브이월드 ✓' : '브이월드 없음 (OpenStreetMap 건물)'}</small></button>
      <div ${ST.keyOpen || !v.dkey ? '' : 'hidden'}>
        <label class="fld">공공데이터포털 인증키 (Decoding)<input id="mkDK" type="password" value="${esc(v.dkey || '')}" placeholder="상가(상권)정보 · 일반음식점 활용신청한 키" autocomplete="off"></label>
        <label class="fld">브이월드 인증키 (건물 모양 · 주소 찾기)<input id="mkVK" type="password" value="${esc(v.key || '')}" placeholder="없으면 OpenStreetMap 으로" autocomplete="off"></label>
        <label class="fld">브이월드에 등록한 서비스 URL<input id="mkVD" value="${esc(v.domain || '')}" placeholder="예: http://localhost"></label>
        <div class="btns"><button class="btn pri" data-mk="key">키 저장</button></div>
        <p class="hint">키는 이 기기와 로그인한 계정에만 저장돼요. 활용신청 직후에는 1~2시간 동안 "등록되지 않은 키" 가 나올 수 있어요.</p>
        ${areaNeedHtml()}
      </div></section>
    <section class="mks"><div class="ilive" id="mkLive" hidden></div><pre class="ilog" id="mkLog" ${ST.log ? '' : 'hidden'}>${esc(ST.log)}</pre></section>`;
  bindPanel(P); if (has) refresh(false);
}
function areaNeedHtml() {
  const need = [...new Set(ST.list.filter((s) => s.pm && s.pm.need).map((s) => s.pm.need))], have = jget(LSC, {});
  if (!need.length && !Object.keys(have).length) return '';
  return `<div class="mkarea"><b>개업일 조회용 지역 코드 (개방자치단체코드)</b><p class="hint">서울 25개 구는 들어 있어요. 다른 지역은 공공데이터포털 '행정안전부_식품_일반음식점' 페이지의 참고문서(개방자치단체코드_영업상태코드.xlsx)에서 7자리 코드를 찾아 한 번만 넣어 주세요.</p>
    ${[...new Set([...need, ...Object.keys(have)])].map((a) => `<label class="fld">${esc(a)}<input data-mk-area="${esc(a)}" value="${esc(have[a] || '')}" placeholder="예: 3930000" inputmode="numeric"></label>`).join('')}<div class="btns"><button class="btn" data-mk="area">코드 저장 · 다시 확인</button></div></div>`;
}
function bindPanel(P) {
  const q = $('#mkQ', P); q.onkeydown = (e) => { if (e.key === 'Enter') find(); };
  const fr = $('#mkFree', P); if (fr) fr.onkeydown = (e) => { if (e.key === 'Enter') { ST.free = fr.value.trim(); refresh(true); } };
  $$('[data-mk-r]', P).forEach((b) => (b.onclick = () => load(ST.res[+b.dataset.mkR])));
  $$('[data-mk-c]', P).forEach((b) => (b.onclick = () => { const k = b.dataset.mkC, i = ST.sel.indexOf(k); if (i >= 0) ST.sel.splice(i, 1); else ST.sel.push(k); try { localStorage.setItem(LSSEL, JSON.stringify(ST.sel)); } catch {} b.setAttribute('aria-pressed', String(ST.sel.includes(k))); refresh(true); }));
  const ca = $('#mkAll', P); if (ca) ca.onchange = () => { ST.showAll = ca.checked; refresh(false); };
  $$('[data-mk]', P).forEach((b) => (b.onclick = () => act(b.dataset.mk, b)));
}
async function act(a, b) {
  if (a === 'find') return find();
  if (a === 'zip') return openZip();
  if (a === 'zipx') { $('#mkZip').hidden = true; return; }
  if (a === 'free') { ST.free = $('#mkFree').value.trim(); return refresh(true); }
  if (a === 'keys') { ST.keyOpen = !(b.getAttribute('aria-expanded') === 'true'); return renderPanel(); }
  if (a === 'key') { SITE.setVworld({ ...V(), key: $('#mkVK').value.trim(), domain: $('#mkVD').value.trim(), dkey: $('#mkDK').value.trim() }); ST.keyOpen = false; ST.ctx.toast('키를 저장했어요'); renderPanel(); return; }
  if (a === 'area') { $$('[data-mk-area]').forEach((i) => setOpnCode(i.dataset.mkArea, i.value.replace(/[^0-9]/g, ''))); for (const s of ST.list) if (s.pm && s.pm.need) delete s.pm; ST.ctx.toast('지역 코드를 저장했어요'); return runPermits(); }
  if (a === 'perm') { const c = jget(LSP, {}); for (const s of ST.list) { delete c[s.id]; delete s.pm; } jset(LSP, c); return runPermits(); }
  if (a === 'csv') return saveCsv();
  if (a === 'png') return savePng();
  if (a === '3d') { if (ST.place) { $('#market').hidden = true; ST.ctx.open3d(ST.place); } }
}
async function find() {
  ST.q = $('#mkQ').value.trim(); if (!ST.q) return; ST.log = ''; live('주소 찾는 중…');
  try { ST.res = await SITE.geocode(ST.q); if (!ST.res.length) log('찾지 못했어요 · 도로명 주소나 지번, 우편번호 찾기로 다시 해 보세요'); }
  catch (e) { ST.res = []; log('⛔ ' + errTxt(e)); }
  live(''); renderPanel(); if (ST.res.length === 1) load(ST.res[0]);
}
/* 우편번호 찾기: 카카오(다음) 우편번호 서비스 — 키 없음, 화면 안에 끼워 넣기 */
let zipLoad = null;
function zipScript() {
  if (window.daum && window.daum.Postcode) return Promise.resolve();
  if (zipLoad) return zipLoad;
  const one = (src) => new Promise((ok, bad) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => { s.remove(); bad(new Error('load')); }; document.head.appendChild(s); });
  zipLoad = one('https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js').catch(() => one('https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js')).catch((e) => { zipLoad = null; throw e; });
  return zipLoad;
}
async function openZip() {
  const box = $('#mkZip'), inn = $('#mkZipIn'); box.hidden = false; inn.innerHTML = '<p class="hint">우편번호 서비스를 여는 중…</p>';
  try { await zipScript(); } catch { inn.innerHTML = '<p class="hint">⛔ 우편번호 서비스를 열지 못했어요 (인터넷 연결 확인). 위 칸에 주소를 직접 넣어 [찾기] 해 주세요.</p>'; return; }
  inn.innerHTML = ''; new window.daum.Postcode({ width: '100%', height: '100%', oncomplete: (d) => { ST.zip = d.zonecode || ''; const addr = d.roadAddress || d.jibunAddress || d.address; ST.q = addr + (d.buildingName ? ` (${d.buildingName})` : ''); box.hidden = true; $('#mkQ').value = addr; ST.hitName = d.buildingName || ''; find(); } }).embed(inn, { autoClose: true });
}
const errTxt = (e) => { const c = (e && e.code) || ''; return /E-VW/.test(c) ? `브이월드 오류 (${e.message}) · 키 · 등록 URL 확인` : /E-NET0|E-NET$/.test(c) ? '인터넷 연결 또는 서버 응답이 없어요' : /E-NET4/.test(c) ? `서버가 거절했어요 (${c.slice(5)})` : (e && e.message) || String(e); };
async function load(r) {
  if (ST.busy) return; ST.busy = true; ST.place = r; ST.stopPerm = true; ST.log = ''; renderPanel(); $$('#mkPanel button').forEach((b) => (b.disabled = true));
  const t0 = Date.now(); let cur = ''; const iv = setInterval(() => live(cur ? `${cur} · ${Math.round((Date.now() - t0) / 1000)}초` : ''), 400);
  try {
    log(`📍 ${r.title} · 반경 1km`); const v = V(), step = (m) => { cur = m; if (/^✓|건너뜀|실패|비었|대신|⛔/.test(m)) log(m); };
    const pMap = SITE.loadSite(r.lon, r.lat, R_MAX, step, { dem: false, zones: false, pages: 12, bigWater: true });
    const pSt = v.dkey ? loadStores(r.lon, r.lat, R_MAX, v.dkey, step).catch((e) => { log('⛔ 상가정보: ' + errTxt(e)); return null; }) : Promise.resolve(null);
    if (!v.dkey) log('공공데이터포털 키가 없어 경쟁사는 빼고 지도만 그려요 (아래 키 설정)');
    const [site, st] = await Promise.all([pMap, pSt]);
    if (!site.buildings.length && !site.roads.length) throw new Error('이 범위에서 받은 지도 자료가 없어요');
    site.hitName = ST.hitName || (site.buildings[site.hit] && site.buildings[site.hit].name) || '내 상가'; ST.hitName = '';
    const P = SITE.proj(r.lon, r.lat); ST.site = site; ST.all = st ? st.stores.map((s) => { const n = normStore(s, P); n.b = brandOf(n.nm); return n; }).filter((s) => Number.isFinite(s.x)) : []; ST.stdr = st ? st.stdr : '';
    if (st) log(`✓ 상가정보 음식점 ${ST.all.length}곳${ST.stdr ? ` (${ST.stdr.slice(0, 4)}.${ST.stdr.slice(4, 6)} 기준)` : ''}`);
    const B = site.buildings[site.hit], o = B ? cenOf(B.p) : [0, 0]; ST.map.vr = V_DEF; ST.map.c = [...o]; ST.map.set(site, o); ST.map.onZoom(V_DEF);
  } catch (e) { console.error(e); log('⛔ ' + errTxt(e)); }
  finally { clearInterval(iv); live(''); ST.busy = false; renderPanel(); if (ST.site) runPermits(); }
}
function pickBuilding(i) { const S = ST.site; if (!S || i === S.hit) return; S.hit = i; S.hitName = S.buildings[i].name || '고른 상가'; const o = cenOf(S.buildings[i].p); ST.map.o = o; ST.map.center(...o); ST.ctx.toast('이 건물을 내 상가로 바꿨어요 · 거리를 다시 쟀어요'); refresh(true); }
function curCats() { return [...CATS.filter((c) => ST.sel.includes(c.k)), ...(ST.free ? [freeCat(ST.free)] : [])].filter(Boolean); }
function refresh(perm) {
  const S = ST.site; if (!S) return; const o = ST.map.o, cats = curCats(), inAny = (s) => cats.some((c) => (c.free ? c.test(s) : inCat(s, c)));
  for (const s of ST.all) s.d = Math.hypot(s.x - o[0], s.y - o[1]);
  const pr = new Map(ST.list.map((s) => [s.id, s.pm]));
  ST.list = ST.all.filter((s) => s.d <= R_MAX && inAny(s)).sort((a, b) => a.d - b.d); for (const s of ST.list) if (!s.pm && pr.get(s.id)) s.pm = pr.get(s.id);
  const ids = new Set(ST.list.map((s) => s.id)); ST.map.setPins(ST.list, ST.showAll ? ST.all.filter((s) => !ids.has(s.id) && !NOT_MEAL.includes(s.sc)) : []);
  renderSum(cats); renderList(); if (perm !== false) runPermits();
}
function renderSum(cats) {
  const el = $('#mkSum'); if (!el) return; const L = ST.list, n = (r) => L.filter((s) => s.d <= r).length, by = {}, gs = {};
  for (const s of L) { const k = s.b ? s.b.n : '개인 · 기타'; by[k] = (by[k] || 0) + 1; const g = groupOf(s); gs[g] = (gs[g] || 0) + 1; }
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 10), comp = L.filter((s) => groupOf(s) !== '자사'), nearC = comp[0], mine = L.filter((s) => groupOf(s) === '자사');
  const pm = L.filter((s) => s.pm && s.pm.open), yr = new Date(); yr.setFullYear(yr.getFullYear() - 1); const y1 = yr.toISOString().slice(0, 10).replace(/-/g, '.'), new1 = pm.filter((s) => s.pm.open >= y1).length, gone = L.filter((s) => s.pm && s.pm.active === false).length;
  el.innerHTML = `<div class="mkrow2"><b>요약 · ${esc(cats.map((c) => c.k).join(' + ') || '업종 없음')}</b><small class="hint">${ST.stdr ? `상가정보 ${ST.stdr.slice(0, 4)}.${ST.stdr.slice(4, 6)}` : ''}</small></div>
    <div class="mkkpi"><div><small>300m</small><b>${n(300)}</b></div><div><small>500m</small><b>${n(500)}</b></div><div><small>1km</small><b>${n(1000)}</b></div><div><small>가장 가까운 경쟁</small><b class="sm">${nearC ? `${esc(nearC.b ? nearC.b.n : nearC.nm)} ${Math.round(nearC.d)}m` : '-'}</b></div></div>
    <div class="mkgs">${Object.keys(G).map((g) => `<span style="--c:${G[g].c}"><i></i>${g} ${gs[g] || 0}</span>`).join('')}</div>
    ${mine.length ? `<p class="hint">자사(페리카나) ${mine.length}곳 · 가장 가까운 곳 ${Math.round(mine[0].d)}m</p>` : ''}
    ${top.length ? `<div class="mkbars">${top.map(([k, v]) => `<div><span>${esc(k)}</span><i style="width:${Math.max(6, (v / top[0][1]) * 100)}%"></i><b>${v}</b></div>`).join('')}</div>` : '<p class="hint">이 업종의 가게가 반경 1km 안에 없어요</p>'}
    ${pm.length ? `<p class="hint">개업일 확인 ${pm.length}곳 중 최근 1년 개업 ${new1}곳${gone ? ` · 인허가상 폐업 · 휴업 ${gone}곳 (회색 핀)` : ''}</p>` : ''}`;
}
function renderList() {
  const el = $('#mkList'); if (!el) return; const L = ST.list.slice(0, 300);
  el.innerHTML = L.length ? L.map((s) => { const p = s.pm || {}; return `<button class="mkli" data-mk-s="${s.id}"><i style="background:${G[groupOf(s)].c}"></i><span><b>${esc(s.b ? s.b.n : s.nm)}</b><small>${esc(s.b ? `${s.nm} ${s.br}` : s.br || s.sn)} · ${esc(s.sn)}${s.flr ? ` · ${esc(s.flr)}층` : ''}</small><small>${p.open ? `개업 ${esc(p.open)} · ${esc(p.st || '')}` : p.none ? '인허가 자료 없음' : p.need ? '지역 코드 필요' : '개업일 확인 전'}</small></span><em>${Math.round(s.d)}m</em></button>`; }).join('') + (ST.list.length > 300 ? `<p class="hint">가까운 300곳만 보여요 (전체 ${ST.list.length}곳은 CSV 로)</p>` : '') : '<p class="hint">해당 업종 가게가 없어요</p>';
  $$('[data-mk-s]', el).forEach((b) => (b.onclick = () => { const s = ST.list.find((q) => q.id === b.dataset.mkS); if (!s) return; $$('.mkli.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); ST.map.sel = s.id; if (ST.map.vr > 400) ST.map.vr = 300; ST.map.center(s.x, s.y); const q = ST.map.placed.find((p) => p.s.id === s.id); if (q) ST.map.showTip(q, q.x + q.w / 2, q.y); }));
}
let permRun = 0;
async function runPermits() {
  const v = V(), el = () => $('#mkPerm'); if (!v.dkey || !ST.list.length) return; const my = ++permRun; ST.stopPerm = false;
  const L = ST.list.slice(0, 80); /* 가까운 80곳까지 */ const cnt = L.filter((s) => !s.pm).length; if (!cnt) { renderSum(curCats()); return; }
  const step = (m, prog) => { if (my !== permRun) return; const e = el(); if (e) e.textContent = m; if (!prog) log(m); if (prog) { renderList(); renderSum(curCats()); ST.map.draw(); } };
  try { await enrichPermits(L, v.dkey, step, () => ST.stopPerm || my !== permRun); } catch (e) { step('⛔ 인허가: ' + errTxt(e)); }
  if (my !== permRun) return; const e = el(); if (e) e.textContent = `개업일 확인 ${L.filter((s) => s.pm && s.pm.open).length}/${L.length}곳`;
  renderList(); renderSum(curCats()); ST.map.draw(); if (L.some((s) => s.pm && s.pm.need)) { const k = $('.mkfold'); if (k && k.getAttribute('aria-expanded') !== 'true') { ST.keyOpen = true; renderPanel(); } }
}
function reportLines() { const L = ST.list, n = (r) => L.filter((s) => s.d <= r).length; return [`업종: ${curCats().map((c) => c.k).join(' + ')} · 300m ${n(300)} · 500m ${n(500)} · 1km ${n(1000)}곳`, `출처: 소상공인시장진흥공단 상가(상권)정보${ST.stdr ? ` ${ST.stdr.slice(0, 4)}.${ST.stdr.slice(4, 6)}` : ''} · 행정안전부 일반음식점 인허가 · 브이월드 / OpenStreetMap · 만든 날 ${new Date().toLocaleDateString('ko-KR')}`]; }
async function savePng() {
  const c = ST.map.snapshot(`상권분석 · ${ST.place ? ST.place.title : ''}`, reportLines()), b = Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]), (x) => x.charCodeAt(0));
  if (await ST.ctx.saveFile({ title: 'PNG 이미지', defaultName: `상권분석-${(ST.place && ST.place.title) || ''}.png`.replace(/[\\/:*?"<>|]/g, ' '), extensions: ['png'], data: b })) ST.ctx.toast('지도 그림을 저장했어요');
}
async function saveCsv() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, rows = [['구분', '브랜드', '상호', '지점', '업종(소분류)', '거리(m)', '층', '도로명주소', '개업일(인허가)', '영업상태(인허가)', '폐업일', '위도', '경도']];
  for (const s of ST.list) { const p = s.pm || {}; rows.push([groupOf(s), s.b ? s.b.n : '', s.nm, s.br, s.sn, Math.round(s.d), s.flr, s.adr, p.open || '', p.st || '', p.close || '', s.lat, s.lon]); }
  const head = [`상권분석,${q(ST.place ? ST.place.title : '')}`, ...reportLines().map((l) => q(l)), ''].join('\r\n'), body = rows.map((r) => r.map(q).join(',')).join('\r\n');
  const data = new TextEncoder().encode('﻿' + head + '\r\n' + body);
  if (await ST.ctx.saveFile({ title: 'CSV (엑셀)', defaultName: `상권분석-${(ST.place && ST.place.title) || ''}.csv`.replace(/[\\/:*?"<>|]/g, ' '), extensions: ['csv'], data })) ST.ctx.toast(`목록 ${ST.list.length}곳을 CSV 로 저장했어요 · 엑셀에서 열려요`);
}
