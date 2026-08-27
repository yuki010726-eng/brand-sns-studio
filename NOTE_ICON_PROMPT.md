# 노트형 아이콘 프롬프트 교체

노트형(C) 표지 아이콘을 만드는 프롬프트를 바꾼다. 다른 컨셉(매거진·카드·직관)은 건드리지 않는다.

- **대상**: `lib/imageprompt.js` 의 `noteIconPrompt()`
- **호출 경로**: `buildPrompt()` → `concept.id === 'note'` 일 때만
- **레퍼런스**: 쓸모실험실(`sslmo.lab`) — `lib/concepts.js` 의 `note.ref` 에 이미 적혀 있다

---

## 1. 왜 바꾸나

지금 나오는 그림이 **투박하고, 요소들이 그냥 나란히 놓인 것처럼 보인다.** 원인이 세 개다.

### ① 선 굵기가 한 종류다

현재 프롬프트: `thick uniform black outlines`

레퍼런스는 **외곽선이 굵고 내부 선이 얇다.** 전부 같은 굵기로 못박아서 뭉툭해진다.

### ② 무엇을 그릴지가 없다

현재 프롬프트는 "이 뜻을 표현해라"까지만 말하고 사물을 지정하지 않는다. 이미지 모델은 지시가
추상적이면 자기가 아는 가장 안전한 그림(전구·톱니바퀴)으로 돌아간다.

⚠️ 이건 `lib/imageprompt.js` 에 이미 적혀 있는 교훈과 같은 것이다 — 사진 프롬프트에서
`avoid generic stock-photo scenes` 를 넣은 이유(2026-08-20)와 원인이 똑같다.

### ③ 배경이 흰색으로 못박혀 있다

현재 프롬프트: `plain flat off-white background`

카드의 종이색 위에 얹었을 때 사각형 자국이 남지 않게 하려고 넣은 값인데, **투명 배경이면
애초에 그 문제가 없다.** `lib/cardrender.js` 의 `drawImageIcon()` 은 `drawContain()` 으로
그리므로 알파 PNG 가 종이색 위에 그대로 합성된다. 렌더러는 고칠 것이 없다.

---

## 2. 새 스타일 블록

프롬프트 뒤쪽에 고정으로 붙는 부분이다. 그대로 쓴다.

```
clean editorial pictogram illustration in black on transparent background,
two-weight line hierarchy: thick confident outer contour, noticeably thinner interior lines,
flat solid black fills with one or two flat light grey (#E8E8E8) panels for depth, no other color,
no shading, no gradient, no texture, no perspective, front-on flat view,
precise confident linework, geometric clarity, crisp corners, sticker-like,
the whole illustration reads as ONE connected silhouette, elements overlap and touch,
deliberate balanced composition, generous even margin, nothing touching the frame edges,
1:1 square, transparent background, isolated cutout,
no floating disconnected elements, no icon collage, no scattered props,
no text, no letters, no numbers, no watermark, no logo, no signature
```

### 이전 값과 달라진 곳

| | 이전 | 새 값 |
|---|---|---|
| 화풍 | `bold hand-drawn marker illustration` | `clean editorial pictogram illustration` |
| 선 | `thick uniform black outlines` (한 종류) | `two-weight line hierarchy` (외곽 굵게 / 내부 얇게) |
| 마감 | `rounded friendly shapes, slightly retro cartoon feel` | `precise confident linework, geometric clarity, crisp corners` |
| 배경 | `plain flat off-white background` | `transparent background, isolated cutout` |
| 통합 | 없음 | `reads as ONE connected silhouette, elements overlap and touch` |
| 부정 | 없음 | `no floating disconnected elements, no icon collage, no scattered props` |

⚠️ **`uniform` · `even weight` 를 되살리지 말 것.** 투박함의 직접 원인이다.

⚠️ **손그림(`hand-drawn marker`) 쪽이 레퍼런스에 더 가깝지만 채택하지 않았다.** 비교해 본 결과
   선이 뭉툭해지는 쪽으로 작용했다. 되돌리려면 위 표의 1·3행 두 줄만 이전 값으로 바꾸면 된다.

---

## 3. SUBJECT 작성 규칙 — 여기가 핵심

품질은 스타일 블록이 아니라 **무엇을 그리라고 적느냐**에서 갈린다. 규칙 세 개를 지킨다.

### ① 사물을 나열하지 않는다

요소를 `A + B + C` 로 적으면 모델이 각각 그려서 나란히 놓는다. 그게 "그냥 합쳐놓은 느낌"의
직접 원인이다.

```
✗ a clipboard holding a checklist, a certification stamp on top of it, a sparkle burst at the upper left
✓ a round certification stamp pressed down onto a checklist sheet
```

### ② 주연 하나 + 조연 하나까지, 조연은 주연에 닿아야 한다

떠 있는 요소가 하나라도 있으면 실루엣이 갈라진다. 조연은 주연을 **감거나 · 꽂히거나 · 얹히거나 ·
눌러야** 한다.

### ③ 관계를 동사로 쓴다

`A와 B가 있다` 가 아니라 `A가 B를 하고 있다`. 동사가 들어가야 구도가 생긴다.

```
✗ a calendar page and some business cards
✓ a business card tucked into the calendar's spiral binding
```

### ④ 스타일 블록의 금지 항목과 충돌시키지 않는다

**실제로 뽑아 보고 걸린 것들이다.** SUBJECT 를 쓴 다음 2절의 금지 줄과 대조한다.

| SUBJECT 에 쓰면 안 되는 것 | 충돌하는 금지 항목 | 대신 |
|---|---|---|
| 선반 · 책상 · 바닥 · 벽 | `isolated cutout` | 사물만. 놓인 자리를 그리지 않는다 |
| 날짜 · 금액 · 화면 속 UI | `no text, no numbers` | 숫자 없이도 읽히는 사물로 바꾼다 |
| 점선 · 끊어진 선 · 흩어진 조각 | `no floating disconnected elements` | 붙어 있는 형태로 바꾼다 |
| 리본 로제트 · 술 · 깃털 · 주름 | `two-weight line hierarchy` | 굵은 외곽선 하나로 잡히는 형태로 |

### ⑤ 은유는 한 겹으로

`계산기 + 동전 + 재생버튼` 처럼 개념이 셋이면 그림이 셋으로 갈라진다. 하나로 줄인다.

---

## 4. SUBJECT 예시 6개

규칙대로 쓴 실물이다. 새 주제를 쓸 때 이 형태를 따른다.

**전부 실제로 뽑아서 확인했다.** 1번이 기준선이고, 2~6번은 1번의 형태에 맞춰 다시 쓴 것이다.

```
1. 인증마크, 붙이기 전에 확인할 네 가지
SUBJECT: a round certification stamp pressed down onto a checklist sheet,
the sheet curling up slightly at one corner under the pressure

2. 상은 쓰기 시작하는 순간부터 일합니다
SUBJECT: a trophy cup being used as a pen holder,
three pens standing upright inside it

3. 월 100만원이 비싼지 싼지는 CPV를 봐야 압니다
SUBJECT: a magnifying glass held over a single large coin,
the coin appearing enlarged inside the lens

4. '1위'만 적힌 문구는 근거를 물었을 때 댈 것이 없습니다
SUBJECT: a thick heavy medal resting on top of one thin sheet of paper,
the sheet buckling in the middle under its weight

5. 수상 후 2주 안에 할 일
SUBJECT: a trophy cup tipped forward,
a small stack of business cards spilling out of its mouth

6. ○○부문 선정 소식을 전합니다
SUBJECT: a megaphone,
a small trophy emerging out of its horn
```

### 2~6번을 다시 쓴 이유

처음 쓴 것들이 이미지로는 못 쓸 수준이었다. 전부 **3절 ④의 충돌**에 걸린 것이다.

| | 처음 쓴 것 | 걸린 이유 |
|---|---|---|
| 2 | 선반 위 트로피 + 거미줄 | 선반이 들어와 사물이 아니라 장면이 됐다 |
| 3 | 계산기 화면 속 재생 버튼 + 동전 | 화면 내부 UI · 은유가 세 겹 |
| 4 | 말풍선 꼬리가 점선으로 끊어짐 | `no floating disconnected elements` 와 정면 충돌 |
| 5 | 날짜에 동그라미 친 달력 | 숫자 없이는 달력으로 안 읽힌다 |
| 6 | 리본 로제트를 두른 트로피 | 주름·겹침이 많아 굵은 외곽선으로 안 잡힌다 |

⚠️ **SUBJECT 를 새로 쓸 때마다 3절 ④ 표와 대조할 것.** 스타일 블록만 지키고 SUBJECT 를
   검증하지 않으면 여기서 그대로 다시 걸린다.

---

## 5. 참고 구현

`noteIconPrompt()` 를 아래 형태로 바꾼다. 인자와 반환값은 그대로다 — 호출부는 손대지 않는다.

```js
function noteIconPrompt(card, title, subject) {
  const idea = subject || title || card.shot;
  return [
    `a single centered pictogram that expresses this idea: "${idea}"`,
    subject ? `the pictogram must visually communicate the meaning of this Korean editorial caption: "${subject}"` : '',
    card.shot ? `visual motif to draw from: ${card.shot}` : '',

    // ⚠️ 아래 두 줄이 「나열된 아이콘」을 막는다. 빼지 말 것.
    'draw ONE main object with at most one secondary element, and the secondary element must physically touch, overlap, wrap or rest on the main object',
    'describe them as a single action, never as a list of separate props',

    'clean editorial pictogram illustration in black on transparent background',
    'two-weight line hierarchy: thick confident outer contour, noticeably thinner interior lines',
    'flat solid black fills with one or two flat light grey (#E8E8E8) panels for depth, no other color',
    'no shading, no gradient, no texture, no perspective, front-on flat view',
    'precise confident linework, geometric clarity, crisp corners, sticker-like',
    'the whole illustration reads as ONE connected silhouette, elements overlap and touch',
    'deliberate balanced composition, generous even margin, nothing touching the frame edges',
    '1:1 square, transparent background, isolated cutout',
    'no floating disconnected elements, no icon collage, no scattered props',
    'no text, no letters, no numbers, no watermark, no logo, no signature',
  ].filter(Boolean).join('. ');
}
```

---

## 6. 투명 배경을 못 만드는 모델일 때

`transparent background` 를 알아듣는 모델(gpt-image 계열)이면 위 그대로 나온다.
못 알아듣는 모델이면 **마지막 배경 두 줄만** 아래로 바꾸고 배경 제거를 한 번 더 태운다.

```
pure white #FFFFFF background, no shadow, no reflection, no ground plane
```

⚠️ **그림자와 바닥면을 막는 게 핵심이다.** 흑백 픽토그램은 그림자만 없으면 흰 배경이 깨끗하게
   떨어진다. 그림자가 남으면 제거 후 테두리에 회색 얼룩이 붙는다.

---

## 7. 하지 말 것

- **이미지 안에 한글을 넣지 않는다.** 레퍼런스의 말풍선 문구("너 기빨려" 등)는 디자인에서
  얹은 것이다. 이미지 모델은 한글을 거의 못 그리고, 시도하면 글자 모양 얼룩이 생겨 배경 제거까지
  지저분해진다. 말풍선은 **빈 채로** 뽑고 텍스트는 카드 레이어에서 얹는다.
- **별표 버스트를 프롬프트에 넣지 않는다.** 레퍼런스의 시그니처지만 주 사물에 닿지 않는 요소라,
  넣는 순간 실루엣이 갈라진다. 쓰려면 이미지가 아니라 **카드 레이어에서** 얹는다.
- **컨셉을 가리지 않고 적용하지 않는다.** 이 프롬프트는 노트형 전용이다. 카드형(B)은 실사
  사진(`bright natural documentary photograph`)이고 결이 완전히 다르다.

---

## 8. 검증

나온 그림을 **눈을 가늘게 뜨고 본다.**

- 덩어리 **하나**로 읽히면 통과
- 두세 덩어리로 갈라져 보이면 실패 → SUBJECT 가 나열식으로 쓰였는지 먼저 본다

**기준선은 1번(도장이 종이를 눌러 모서리가 휨)이다.** 실제로 뽑아서 통과한 유일한 첫 판이고,
2~6번은 이 형태에 맞춰 다시 쓴 것이다. 새 주제의 결과가 1번보다 못하면 SUBJECT 를 의심한다.

1번이 통과한 조건 네 가지 — 새로 쓸 때도 이 넷을 맞춘다.

- 사물이 **둘**이고 둘 다 납작하고 단순하다
- 접촉이 **동작**이다 (누른다 · 꽂힌다 · 감는다 · 쏟아진다)
- 놓인 자리(바닥·선반·책상)를 그리지 않는다
- 글자나 숫자가 없어도 뜻이 읽힌다

---

## 9. ⚠️ 주제와 그림을 잇는 자리가 아직 없다

**프롬프트만 갈아끼우면 여기서 다시 막힌다.** 4절 SUBJECT 는 사람이 손으로 쓴 것이고,
**지금 앱에는 「주제 → 어떤 사물로 그릴까」를 정하는 자리가 없다.**

### 지금 흐름

1. `lib/outline.js` 3단계가 `shot` 을 만드는데, 지시문이 **"어울리는 사진 장면(shot)을 영문으로
   적습니다"** 로 못박혀 있다 (428행). JSON 스키마도 `"이 항목에 어울리는 사진 장면"` 이다 (559행).
2. 그 **사진 장면**이 `noteIconPrompt()` 에서 `visual motif to draw from:` 으로 픽토그램
   프롬프트에 그대로 붙는다.

사진용 장면을 픽토그램 재료로 주고 있다. 카드 본문(`q`·`a`)을 아무리 고쳐도 해결되지 않는다 —
그림을 정하는 건 본문이 아니라 `shot` 이다.

### 단순히 outline 을 고칠 수도 없다

"노트형이면 사물을 적어라" 로 바꾸려면 아웃라인이 컨셉을 알아야 하는데, **아웃라인 시점에는
컨셉이 아직 안 정해져 있다.** 컨셉은 `pages/template.js` 에서 고르고 그건 뒤 단계다.
`buildPrompt(ctx, retryNote)` 에 conceptId 가 아예 안 들어간다.

### 권하는 방식 — `icon` 필드를 하나 더 받는다

같은 호출에서 두 벌을 만들고, 노트형이면 `icon` 을, 나머지 컨셉이면 `shot` 을 쓴다.

```
"shot": "이 항목에 어울리는 사진 장면 (영문)",
"icon": "이 항목을 픽토그램 하나로 그린다면 무엇을 그릴지 (영문). 납작하고 단순한 사물 둘,
         조연은 주연에 닿아 있어야 하고, 관계를 동사로 쓴다. 배경·바닥·글자·숫자는 쓰지 않는다"
```

- 컨셉을 몰라도 된다 — 두 벌을 다 만들어 두고 나중에 고른다
- **API 호출이 안 늘어난다.** 출력 토큰만 조금 는다
- 노트형 이미지 프롬프트가 지금처럼 규칙 조립으로 남는다 (API 를 한 번도 안 부르는 장점 유지)

손댈 곳은 네 군데다.

| 파일 | 무엇을 |
|---|---|
| `lib/outline.js` 428행 | 3단계 지시문에 `icon` 항목을 더한다 |
| `lib/outline.js` 559행 | JSON 스키마에 `icon` 을 더한다 |
| `lib/outline.js` 861행 근처 | 파싱부 `trim` 목록에 `icon` 을 더한다 |
| `lib/imageprompt.js` | `noteIconPrompt()` 가 `card.shot` 대신 `card.icon` 을 쓰게 한다 |

⚠️ `card.icon` 이 비어 있을 때는 `card.shot` 으로 폴백한다. 기존에 저장된 덱에는 `icon` 이 없다.
