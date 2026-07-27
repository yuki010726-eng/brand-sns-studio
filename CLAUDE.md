# CLAUDE.md — 브랜드 SNS 스튜디오

Claude Code가 세션 시작 시 자동으로 읽는 프로젝트 지침이다.
**다음 작업은 STEP 4다. 아래 「다음 작업」 절부터 보면 된다.**

---

## 1. 이 프로젝트가 뭔가

브랜드 4개 상품의 SNS 게시물을 만드는 도구. 흐름은 4단계다.

```
1단계 상품·주제 선택 → 2단계 아이디어 문서화 → 3단계 카드 이미지 → 4단계 카드뉴스 템플릿
```

상품 4종: KBS N 브랜드어워즈 / 포브스 브랜드어워즈 / KCST 대한민국 고객만족도 신뢰도 대상 / 중소기업 AI TV CF

| 단계 | 파일 | 상태 |
|---|---|---|
| 1 | `pages/home.js` | ✅ 완료 |
| 2 | `pages/copy.js` + `lib/copywriter.js` | ✅ 완료 |
| 3 | `pages/image.js` + `lib/concepts.js` `lib/imageprompt.js` `lib/openai.js` `lib/imagestore.js` | ✅ 완료 |
| 4 | `pages/template.js` | ⬜ **자리표시자 — 다음 작업** |
| 5 | `pages/library.js` | ⬜ 자리표시자 (보관함 검색·필터·정렬) |

---

## 2. 실행

빌드 도구를 쓰지 않는다. ES 모듈을 쓰므로 `file://`로 열면 동작하지 않는다. 반드시 서버로 띄운다.

```bash
python -m http.server 5610
```

`.claude/launch.json`에 등록돼 있으므로 `preview_start`로 실행하면 된다.
`python`이 없고 `py`만 있으면 `launch.json`의 `runtimeExecutable`을 `py`로 바꾼다.
`serve.cmd`를 더블클릭해도 된다 (python → py → python3 순으로 시도).

### 캐시 주의

`python -m http.server`는 캐시 헤더를 붙이지 않아, 코드를 고쳐도 브라우저가 옛 파일을 쓴다.
브라우저에서 검증하기 전에 반드시 캐시를 비운다.

```js
Promise.all([...document.styleSheets].filter(s=>s.href).map(s=>fetch(s.href,{cache:'reload'})))
  .then(()=>location.reload())
```

JS 모듈까지 바꿨다면 해당 파일도 `fetch(path,{cache:'reload'})` 한 뒤 reload 한다.
이걸 빼먹으면 "고쳤는데 반영이 안 된다"고 잘못 판단하게 된다.

---

## 3. 절대 임의로 바꾸지 말 것

### 디자인 토큰 (`styles/tokens.css`)

```
--primary #3182F6 / --primary-dark #1B64DA / --text #4E5968 / --sub #8B95A1
--bg #F2F4F6 / --surface #FFFFFF / --border #E5E8EB
```

버튼은 둥근 알약: `border-radius:999px; padding:12px 22px; font-weight:700`
폰트는 Noto Sans KR (400/500/700). 아이콘은 라인, 24x24, `stroke-width:1.5`, `fill:none`.

### 접근성 (요청자 지정 규칙 — 디자인 값과 충돌하면 이쪽이 우선)

- 모든 버튼에 `aria-label`, 장식 아이콘은 `aria-hidden="true"`
- **명도 대비 4.5:1 이상**
  - `--sub`(#8B95A1)는 흰 배경 3.08:1이라 본문 텍스트에 쓰지 않는다. 아이콘·구분선·비활성만.
  - 작은 보조 텍스트는 `--sub-strong`(#5F6B7A) — 흰 배경 5.43:1 / 회색 배경 4.92:1
  - CTA 배경은 `--cta-bg`(=`--primary-dark`). `#3182F6`+흰 글자는 3.71:1로 미달이라
    **요청자 승인을 받아** 변경했다. 되돌리려면 `--cta-bg` 한 줄만 바꾸면 된다.
- `:focus-visible` 3px 아웃라인. 시각적으로 숨긴 radio/checkbox도 label에 포커스링을 전달한다.
- 이미지 `alt` 필수. canvas는 `role="img"` + `aria-label`.

### 폼 컨트롤에 `autocomplete="off"`

새로고침 시 브라우저가 예전 선택을 복원하며 `change`를 발생시켜 **저장된 상태를 덮어쓴다.**
실제로 컨셉 선택이 초기화되는 버그가 있었다. 라디오·체크박스·textarea에 반드시 붙인다.

---

## 4. 콘텐츠 사실성 원칙 (위반 시 재작업)

상품 정보 출처는 `07_BRAND_INFORMATION.md`(기준일 2026-07-23)이며 `data/products.js`에 옮겨져 있다.

- 매출 상승·광고 성과를 **보장하지 않는다**
- 공식 근거 없이 **최고·유일·1위·최고 권위** 단정 금지
- **종료된 행사**(`events[].status !== 'open'`)를 모집 중처럼 쓰지 않는다
- 마무리 문장은 반드시 `product.closings` 배열에서만 가져온다 (승인된 표현)
- KCST 심사 기준 비율 합계 100%를 정확히 유지한다
- AI TV CF의 '300만 원' 관련 표현은 근거 확인 전까지 쓰지 않는다
- 생성 결과는 `BANNED_PHRASES` 검사를 통과해야 한다 (`lib/copywriter.js`의 `findBanned`)

각 상품의 `cautions` 배열은 화면에 항상 노출한다.

---

## 5. 작업 규칙

1. **단계별 진행 + 검수.** 한 번에 다 만들지 말고, 한 단계 끝나면 요청자 검수를 받고 다음으로 간다.
2. **배치가 애매하면 임의로 정하지 말고 질문한다.**
3. **백엔드·API·배포가 필요한 항목은 먼저 물어본다.** 지금은 PART 1(프론트엔드)이다.
4. **검증 없이 "완료"라고 하지 않는다.** 브라우저로 실제 확인하고, 못 한 검증은 못 했다고 말한다.
5. 기존 구조·네이밍을 따르고, 요청 범위 밖 리팩토링은 하지 않는다.

---

## 6. 지금까지 내린 결정과 이유

이 맥락을 모르면 되돌리기 쉬운 것들이다.

| 결정 | 이유 |
|---|---|
| 빌드 도구 없는 정적 구조 | 작업 PC에 node/npm이 없다. Vite를 쓰면 실행·검증이 불가능하다. |
| 카드뉴스 **1080×1080** | 인스타 피드에서 안 잘리고, 네이버 블로그 본문 폭(약 800px)에 축소만 하면 들어간다. 한 벌로 두 채널 커버. |
| 채널별 화법 완전 분리 | 처음엔 데이터를 불릿으로 덤프해서 "AI로 뽑은 것 같다"는 지적을 받았다. 지금은 `product.voice`의 문장 재료를 조합한다. |
| 쓰레드만 별도 화법(`voice.threads`) | 공지 톤이 아니라 "알게 된 걸 흘리는" 톤이 필요하다. **해시태그·계정·CTA를 넣지 않는다** — 하나라도 붙으면 광고 티가 나서 톤이 무너진다. |
| 블로그는 Q&A 구조 | 검색 유입용. 질문과 답을 `voice.qa`에 **쌍으로** 묶었다. 따로 뽑으면 소제목과 본문이 어긋난다. |
| 카드 장면(`shot`)도 qa 항목에 동봉 | 주제에 따라 순서가 바뀌어도 그림과 글이 어긋나지 않게. |
| 이미지 프롬프트는 **영문** | 이미지 모델이 영문 지시를 훨씬 정확히 따른다. |
| 프롬프트에 `no text, no letters` | 문구는 4단계에서 얹어야 수정 가능하고, 생성 이미지의 한글은 깨진다. |
| 이미지는 IndexedDB | localStorage(약 5MB)에 1024px PNG 6장이 안 들어간다. |
| OpenAI를 브라우저에서 직접 호출 | 백엔드가 없다. **요청자가 개인·내부용으로 쓰기로 합의한 방식이다.** |

---

## 7. API 키 취급 (중요)

- 키는 화면에서 요청자가 직접 입력하고 `localStorage`(`bboggl.openai-key`)에만 저장된다.
- **키를 코드·저장소·문서에 절대 넣지 않는다.** 대화로 받지도 않는다.
- 이 저장소는 Private이지만 그것과 무관하게 키는 파일에 두지 않는다.
- 커밋 전 `git grep -nI "sk-[A-Za-z0-9]\{16,\}"`로 확인하는 습관을 유지한다.

> ⚠️ 브라우저 직접 호출은 키가 노출되므로 **로컬·내부용 전용**이다.
> 외부 배포 시에는 서버 프록시로 옮기고 키를 서버에만 둔다 → PART 2.

---

## 8. 다음 작업 — STEP 4 카드뉴스 템플릿

`pages/template.js`가 자리표시자다. 만들 내용은 아래와 같다.

### 목표

3단계에서 준비한 **카드 이미지 위에 추천 문구가 미리 얹혀 나오고**, 그 자리에서 수정한다.
요청자가 명시한 요구사항이다 — "추천 글을 먼저 작성해주고 수정할 수 있도록".

### 재료는 이미 다 있다

- **문구**: `buildDeck({product, topic, tone, variant})` → 카드 6장의 `{kind, eyebrow, title, body, footer}`
  (`lib/copywriter.js`)
- **이미지**: `getImage(imageKey(productId, conceptId, i))` → Blob (`lib/imagestore.js`)
- **레이아웃**: `getConcept(id).layout` (`lib/concepts.js`) — 컨셉별 값이 정의돼 있다
- **Canvas 유틸**: `lib/cardrender.js`의 `wrap()`(한글 줄바꿈), `fit()`(글자 크기 자동 축소),
  `roundRect()`, `pill()`, `downloadCanvas()`, `ensureFonts()` — 모두 검증 완료

### 컨셉별 레이아웃 (레퍼런스: 바탕화면 `브랜드 sns 계정 정보/`)

| 컨셉 | 레퍼런스 계정 | 텍스트 처리 |
|---|---|---|
| `photo` 실사 사진형 | soosangmarket | 하단을 어둡게 깔고 흰 글씨. 본문 카드는 사진 위에 **흰 카드 박스**를 얹고 그 안에 문단 (`bodyStyle:'card'`) |
| `mono` 모노톤 일러스트형 | sslmo.lab | 밝은 배경에 검은 글씨. 핵심 문장은 **검정 하이라이트 박스**를 계단식으로 (`bodyStyle:'highlight'`) |
| `cinematic` AI 시네마틱형 | ai.brief.kr | 하단 어두운 그라데이션. 제목은 **흰색 + 네온그린**(`layout.accentText` #B9F73E) 2줄 |

세 컨셉 모두 공통: 상단에 pill 라벨, 하단 좌측에 계정 핸들.

### 확장 지점

현재 `renderCard()`는 텍스트 전용 카드를 그린다.
**배경 이미지를 먼저 `drawImage`로 깔고 그 위에 텍스트를 얹도록** 확장하면 된다.
이미지가 없는 카드는 지금의 단색·그라데이션 배경으로 폴백한다.

### 잊지 말 것

- 편집한 문구는 저장한다 (localStorage). 재생성 시 편집본을 말없이 덮어쓰지 않는다 —
  2단계 `pages/copy.js`에 이미 같은 패턴이 있으니 참고한다 (`drafts` vs `generated` 비교).
- 개별/전체 PNG 다운로드. 전체 저장은 브라우저가 연속 다운로드를 막으므로 350ms 간격을 둔다.
- 1080×1080 고정.

---

## 9. 검증 방법

브라우저 콘솔(`javascript_tool`)에서 돌린다. 매 단계 끝에 확인한다.

### 명도 대비 전수 감사 (실패 0건이어야 한다)

```js
(()=>{
const lum=c=>{const [r,g,b]=c.match(/\d+\.?\d*/g).slice(0,3).map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
const bgOf=el=>{let n=el;while(n&&n!==document.documentElement){const b=getComputedStyle(n).backgroundColor;if(b&&!/rgba\(0, 0, 0, 0\)|transparent/.test(b))return b;n=n.parentElement}return 'rgb(255,255,255)'};
const out=[];
document.querySelectorAll('body *').forEach(el=>{
 const t=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join('');
 if(!t)return;const cs=getComputedStyle(el);
 if(cs.visibility==='hidden'||cs.display==='none'||el.closest('.sr-only,.skip-link')||el.hidden)return;
 const size=parseFloat(cs.fontSize),w=parseInt(cs.fontWeight)||400;
 const large=size>=24||(size>=18.66&&w>=700);
 const L1=lum(cs.color),L2=lum(bgOf(el));
 const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
 if(ratio<(large?3:4.5))out.push(t.slice(0,20)+'|'+(el.className||el.tagName)+'|'+ratio.toFixed(2));});
return JSON.stringify({fails:out.length,list:out},null,1)})()
```

### 글귀 전수 검사 (금지 표현·길이·조사 오류)

상품 4 × 톤 4 × variant × 채널 3 조합을 전부 돌려 위반 0건인지 본다.
`generate()`와 `findBanned()`를 import해서 이중 루프로 검사한다. 과거 실행 기준 위반 0건이었다.

### 가로 스크롤

`resize_window`로 375px에서 `document.documentElement.scrollWidth === clientWidth`인지 확인한다.

---

## 10. 버전 관리

- 원격: `https://github.com/yuki010726-eng/brand-sns-studio` (**Private**)
- 기기를 옮기기 전에 반드시 커밋·푸시하고, 시작할 때 `git pull` 한다.
- 자동 동기화가 아니다. 안 하면 양쪽이 갈라진다.
- 브라우저에 저장된 값(글귀·이미지·API 키)은 기기 간에 따라가지 않는다. README 참고.
