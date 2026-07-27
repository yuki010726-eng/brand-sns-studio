# 브랜드 SNS 스튜디오

상품을 고르고 주제를 적으면 → 채널별 글귀를 문서화하고 → 이미지를 만들고 → 템플릿에서 카드뉴스를 완성하는 SNS 게시물 제작 도구.

## 실행

빌드 도구 없이 동작하는 정적 사이트지만, ES 모듈을 쓰기 때문에 `file://` 로는 열리지 않는다. 로컬 서버로 실행할 것.

```bash
python -m http.server 5610 --directory brand-sns-studio
```

이후 http://localhost:5610 접속. (Claude Code 에서는 `.claude/launch.json` 의 `brand-sns-studio` 설정으로 자동 실행된다.)

## 다른 컴퓨터에서 이어서 작업하기

이 폴더는 OneDrive 안에 있으므로 파일은 자동으로 따라온다. 새 컴퓨터에서 할 일은 아래가 전부다.

1. OneDrive 동기화가 끝났는지 확인 (탐색기에서 폴더 아이콘이 초록 체크인지)
2. Python 설치 여부 확인 — `python --version` (안 되면 `py --version`)
3. 프로젝트 폴더를 작업 디렉토리로 열고 서버 실행

```bash
python -m http.server 5610
```

`python`이 없고 `py`만 있으면 `.claude/launch.json`의 `runtimeExecutable`을 `py`로 바꾼다.
Node가 깔려 있다면 `npx serve -l 5610` 같은 정적 서버도 상관없다. ES 모듈을 쓰므로
`file://`로 직접 열면 동작하지 않는다는 점만 지키면 된다.

### 따라오지 않는 것 (브라우저에 저장되는 값)

파일이 아니라 브라우저 안에 있어서 컴퓨터를 옮기면 사라진다. 모두 새 컴퓨터에서 다시 만들면 된다.

| 값 | 저장 위치 | 복구 방법 |
|---|---|---|
| 선택한 상품·주제·톤·글귀 | localStorage | 1~2단계를 다시 진행 (글귀는 자동 생성) |
| 컨셉 선택 | localStorage | 3단계에서 다시 선택 |
| 카드 이미지 | IndexedDB | 다시 생성하거나 업로드 |
| OpenAI API 키 | localStorage | 3단계 설정에서 다시 입력 |

**API 키는 의도적으로 파일에 저장하지 않는다.** 새 컴퓨터에서 직접 다시 넣어야 한다.
생성해 둔 카드 이미지가 아깝다면 옮기기 전에 3단계에서 내려받아 두고, 새 컴퓨터에서 업로드하면 된다.

## 구조

```
index.html            SPA 셸
app.js                해시 라우터 (guard 지원)
store.js              전역 상태 + localStorage 영속화 + 4단계 정의
styles/
  tokens.css          디자인 토큰 (색·radius·폰트·모션)
  base.css            리셋 · 타이포 · 포커스링 · 접근성
  components.css      btn / card / input / chip / stepper / toast
  pages.css           페이지 레이아웃
assets/icons.js       라인 아이콘 24x24 (stroke 1.5)
data/products.js      4개 상품 기준 정보 · 채널 정의 · 금지 표현
lib/copywriter.js     채널별 글귀 생성기 + 금지 표현 검사
components/           header · stepper · product-card · toast
pages/                home · copy · image · template · library
```

### 글귀 생성기 교체 지점

`lib/copywriter.js` 의 `generate(channelId, ctx)` 가 유일한 생성 진입점이다.
PART 2에서 실제 AI API로 바꿀 때 이 함수만 교체하면 `pages/copy.js` 는 수정하지 않아도 된다.
`findBanned(text, banned)` 는 편집 중에도 매 입력마다 호출되므로 동기 함수로 유지할 것.

## 진행 상황

| 단계 | 화면 | 상태 |
|---|---|---|
| STEP 1 | 디자인 시스템 · 셸 · 1단계 상품/주제 선택 | ✅ 완료 |
| STEP 2 | 2단계 아이디어 문서화 (블로그/인스타/쓰레드) | ✅ 완료 |
| STEP 3 | 3단계 카드 이미지 (컨셉 3종 · 프롬프트 · 생성/업로드) | ✅ 완료 |
| STEP 4 | 4단계 카드뉴스 템플릿 에디터 | 자리표시자 |
| STEP 5 | 보관함 검색·필터·정렬 | 자리표시자 |

### 다음에 할 일 — STEP 4 (카드뉴스 템플릿)

`pages/template.js` 가 아직 자리표시자다. 만들 내용:

- 3단계에서 준비한 카드 이미지(IndexedDB) 위에 **추천 문구를 미리 얹어서** 보여주고,
  그 자리에서 수정할 수 있게 한다. 문구는 `buildDeck()` 결과(title/body/eyebrow/footer)를 쓴다.
- 레이아웃은 선택한 컨셉을 따른다. `lib/concepts.js` 의 `layout` 에 컨셉별 값이 이미 정의돼 있다.
  - `photo` — 하단 어둡게 깔고 흰 글씨, 본문은 흰 카드 박스 (`bodyStyle: 'card'`)
  - `mono` — 밝은 배경에 검은 글씨, 핵심 문장은 검정 하이라이트 박스 (`bodyStyle: 'highlight'`)
  - `cinematic` — 하단 그라데이션, 흰색 + 네온그린(`accentText`) 2줄 제목
- 합성과 내보내기는 `lib/cardrender.js` 의 Canvas 유틸을 재사용한다.
  `wrap()`(한글 줄바꿈), `fit()`(글자 크기 자동 축소), `downloadCanvas()` 가 이미 검증돼 있다.
  현재 `renderCard()` 는 텍스트 전용 카드를 그리므로, 배경 이미지를 먼저 `drawImage` 로 깔고
  그 위에 텍스트를 얹도록 확장하면 된다.
- 규격은 1080×1080. 인스타 피드와 블로그 본문에 한 벌로 쓰기 위한 결정이다.

레퍼런스는 바탕화면 `브랜드 sns 계정 정보/` 의 세 계정 폴더
(soosangmarket = 컨셉 A, sslmo.lab = B, ai.brief.kr = C).

이후 STEP 5(보관함 검색·필터·정렬)를 하고, 그다음이 PART 2(백엔드)다.
PART 2에서는 이미지 생성 호출을 서버 프록시로 옮기고 API 키를 서버에만 둔다.

## 데이터 출처

`data/products.js` 의 상품 정보는 바탕화면 `07_BRAND_INFORMATION.md`(기준일 2026-07-23)를 옮긴 것이다.
일정·접수 상태·금액은 게시 시점에 공식 자료로 다시 확인해야 하며, 상품별 `cautions` 배열의 표현 주의 사항을 화면에 항상 노출한다.

## API 키 취급 (중요)

3단계의 이미지 자동 생성은 브라우저에서 OpenAI API를 **직접** 호출한다.
키는 사용자가 화면에서 입력하고 `localStorage`(`bboggl.openai-key`)에만 저장된다.
코드·저장소에는 키가 없다.

> ⚠️ 이 방식은 키가 브라우저에 노출되므로 **개인·내부용 로컬 실행 전용**이다.
> 외부에 배포하면 누구나 개발자 도구로 키를 꺼내 쓸 수 있다.
> 배포할 때는 서버 프록시(Netlify/Vercel Functions)로 옮기고 키를 서버에만 둘 것 — PART 2.

키가 없어도 3단계는 동작한다. 프롬프트를 복사해 외부 도구에서 이미지를 뽑아 업로드하면 된다.

## 접근성 규칙

- 모든 버튼에 `aria-label`, 아이콘은 `aria-hidden="true"`
- 본문 텍스트 명도 대비 4.5:1 이상 (`--sub-strong` 은 흰 배경 5.43:1 / 회색 배경 4.92:1)
- `:focus-visible` 3px 아웃라인, 시각적으로 숨긴 radio/checkbox 도 label 에 포커스링 전달
- 본문 바로가기 링크, `aria-live` 토스트, `prefers-reduced-motion` 대응
