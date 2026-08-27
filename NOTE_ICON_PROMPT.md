# 노트형 아이콘 프롬프트 교체

노트형(C) 표지 아이콘을 만드는 프롬프트를 바꾼다. 다른 컨셉(매거진·카드·직관)은 건드리지 않는다.

- **대상**: `lib/imageprompt.js` 의 `noteIconPrompt()`
- **호출 경로**: `buildPrompt()` → `concept.id === 'note'` 일 때만
- **레퍼런스**: 쓸모실험실(`sslmo.lab`) — `lib/concepts.js` 의 `note.ref` 에 이미 적혀 있다

> **2판 (2026-08-27)** — 그림체를 **빈티지 손그림(felt-tip marker)** 으로 바꾸고,
> 프롬프트를 **6단 구조**로 세웠다. 1판의 `clean editorial pictogram` 은 폐기했다.
> 실측 근거는 7절에 있다.

---

## 1. 왜 바꾸나

### 1판에서 고친 것

| | 무슨 일이 벌어졌나 |
|---|---|
| `thick uniform black outlines` (선 굵기 한 종류) | 뭉툭하고 투박해졌다 |
| 무엇을 그릴지 지정이 없음 | 모델이 아는 가장 안전한 그림(전구·톱니바퀴)으로 돌아갔다 |
| `plain flat off-white background` | 카드 종이색 위에 사각형 자국이 남았다 → 투명 배경으로 |

### 2판에서 다시 고친 것 — **그림체**

요청자 지정: **"빈티지스러우면서도 손그림 같은 느낌이 중요하다."**

1판의 `precise confident linework, geometric clarity, crisp corners` 는 그 반대로 간다 —
자로 그은 듯한 아이콘팩 느낌이 나온다. 2판은 **펠트펜으로 한 번에 그은 선**으로 바꿨다.

⚠️ **손그림이라고 거칠게 만들면 안 된다.** `dry-brush` · `scratchy` · `sketchy` 는
   지저분해지고 배경 제거까지 망가진다. **선이 흔들리되 가장자리는 깨끗한 것**이 목표다.
   2절 블록에 그 둘을 같이 못박아 뒀다.

---

## 2. 새 스타일 블록

프롬프트 뒤쪽에 고정으로 붙는 부분이다. 그대로 쓴다.

```
hand-drawn ink illustration in black line on transparent background,
drawn with a felt-tip marker at an even medium thickness — thicker than a fineliner,
thinner than a brush pen, every stroke is one confident continuous pass whose edge waves
and wobbles clearly enough to read as hand-drawn, but the edge stays clean:
no rough dry-brush texture, no scratchy or broken edges, no blobs,
line weight stays consistent across the whole drawing,
FLAT FILLS ONLY with no texture, no hatching, no cross-hatching, no stippling,
no sketchy fill strokes, no scribbles, no shading, no gradient,
no cast shadows, no drop shadows, no 3D volume, no perspective, flat front-on view,
simple clear shapes, the whole illustration reads as ONE connected silhouette,
elements overlap and touch, generous even margin, nothing touching the frame edges,
1:1 square, transparent background, isolated cutout with no outline or halo around it,
not taken from an icon library, no icon-pack look, no white outline around the shape,
no floating disconnected elements,
no text, no letters, no numbers, no watermark, no logo, no signature
```

### 1판과 달라진 곳

| | 1판 | 2판 |
|---|---|---|
| 화풍 | `clean editorial pictogram illustration` | `hand-drawn ink illustration, drawn with a felt-tip marker` |
| 선 | `two-weight line hierarchy` (외곽 굵게 / 내부 얇게) | **한 굵기**로 통일 + `edge waves and wobbles` |
| 마감 | `precise confident linework, geometric clarity, crisp corners` | `simple clear shapes` — 정밀함을 뺐다 |
| 채움 | `flat solid black fills` | `FLAT FILLS ONLY` + 채움 기법 부정 7종 |
| 아이콘팩 | 없음 | `not taken from an icon library, no icon-pack look` |
| 후광 | `isolated cutout` | `isolated cutout with no outline or halo around it` |

⚠️ **`uniform` · `even weight` · `crisp` · `precise` 를 되살리지 말 것.** 아이콘팩으로 돌아간다.
⚠️ **`no hatching` 이하 부정 7종을 빼지 말 것.** 손그림을 지시하는 순간 모델이
   빗금·점묘로 채우려 든다. 실제로 모래를 점묘로 그려서 걸렸다.

---

## 3. FILL 규칙 — 2판에서 새로 생긴 칸

**무엇을 흰색으로 비우고 무엇을 회색으로 채울지 반드시 지정한다.** 안 적으면 전부 같은 무게로
그려져서 주연이 안 보인다.

```
FILL: <주연> is left WHITE and empty inside so it stands out;
      <조연> is filled with one flat mid-grey (#DCDCDC) so it sits back;
      solid black only for the outlines and <작은 디테일>.
      no stars, no sparkles, no rays.
```

| 자리 | 무엇이 오나 |
|---|---|
| **WHITE (비움)** | 주제의 **주장을 지고 있는 것**. 트로피 · 봉투 · 인증 배지 |
| **flat mid-grey #DCDCDC** | 무대 역할. 건물 · 가게 정면 · 모래 · 시계 몸통 |
| **solid black** | 외곽선 + 아주 작은 디테일(창문 · 눈금 · 문) 뿐 |

⚠️ **주연을 회색으로 채우지 말 것.** 흰 것이 눈에 먼저 들어온다 — 그 자리에 주장이 와야 한다.
⚠️ `no stars, no sparkles, no rays` 는 FILL 절에 같이 둔다. 강조를 지시하면 모델이
   별표 버스트로 때우려 하고, 그건 주 사물에 닿지 않아 실루엣을 가른다.

---

## 4. 프롬프트 구조 — 6단

**순서를 지킨다.** 요청자가 확인한 트로피 프롬프트가 이 형태다.

```
1. a single centered illustration that expresses this idea: "<주제 문장>".
2. the sentence is a QUESTION / STATEMENT — <문장이 무엇을 하고 있는지 한 줄>.
3. use only symbols any reader understands without insider knowledge: <A>는 <a>, <B>는 <b>.
4. SUBJECT: <주연>, <조연>, <둘의 관계를 동사로>.
5. <이 주제에서 틀리게 그려질 수 있는 것을 부정문으로>.
6. FILL: ... / <2절 스타일 블록>
```

### 2단 — 문장 성격을 반드시 적는다

의문문인지 서술문인지에 따라 그림이 달라진다.

```
QUESTION  → the winner is not decided yet   (아직 안 정해졌다는 상태를 그려야 한다)
STATEMENT → it is already in place and keeps working  (이미 그렇다는 상태)
```

### 3단 — 상식 기호로만 그린다

업계 사람만 아는 기호를 쓰면 안 읽힌다. **회사 = 건물, 상 = 트로피, 접수 = 봉투,
인증 = 둥근 배지, 시간 = 시계.** 이 대응을 프롬프트에 직접 적어 준다.

### 5단 — 부정문은 이 주제에서 실제로 나올 오답만 적는다

일반 금지(글자·그림자 등)는 2절 블록에 이미 있다. 5단에는 **이 주제에서 뒤집히기 쉬운 것**만
적는다 — 「모래를 멈추지 마라」 처럼.

---

## 5. SUBJECT 작성 규칙

품질은 스타일 블록이 아니라 **무엇을 그리라고 적느냐**에서 갈린다.

⚠️ **①이 전부다.** 나머지는 그림을 깔끔하게 만드는 규칙이고, ①은 그림이 **주제와 상관있게**
만드는 규칙이다. ①을 어기면 아무리 잘 그려져도 못 쓴다.

### ① 주제의 명사가 아니라 주장을 그린다

```
주제: 상은 쓰기 시작하는 순간부터 일합니다
✗ a trophy standing on a shelf                        ← '상'이라는 명사만 옮겼다
✗ a trophy cup being used as a pen holder             ← '쓴다'를 딴 뜻으로 옮긴 말장난
✓ an award emblem badge fixed at the top of a product page sheet   ← '활용한다'를 그렸다
```

검증은 질문 하나로 한다. **그림만 보고 주제의 주장을 되말할 수 있나?**

⚠️ **주장을 뒤집지 말 것.** "상은 쓰면 일한다" 에 거미줄 낀 트로피를 그려서 *안 쓰면 방치된다* 는
   정반대 그림이 나왔다. 주장의 반대편은 부정문이지 그 주제가 아니다.
⚠️ **낱말의 다른 뜻으로 옮기지 말 것.** "상을 **쓴다**"(활용)를 "펜을 **쓴다**"(필기)로 옮겨
   트로피에 펜을 꽂았다. **주제 문장이 어느 뜻으로 쓴 낱말인지 먼저 정하고 그린다.**
⚠️ **상품을 하찮게 만드는 그림은 주장을 맞혀도 실패다.** 되물을 것 하나 —
   **이 그림이 상품을 사고 싶게 만드는가, 우습게 만드는가.**

### ② 사물을 나열하지 않는다

```
✗ a clipboard holding a checklist, a certification stamp on top of it, a sparkle burst at the upper left
✓ a round certification stamp pressed down onto a checklist sheet
```

### ③ 주연 하나 + 조연 하나까지, 조연은 주연에 닿아야 한다

떠 있는 요소가 하나라도 있으면 실루엣이 갈라진다.

### ④ 관계를 동사로 쓴다

```
✗ a calendar page and some business cards
✓ a business card tucked into the calendar's spiral binding
```

### ⑤ ⭐ 종이를 다른 사물에 감거나 두르지 말 것 — 2판에서 추가

**접힌 종이는 실루엣이 약해서, 감는 순간 종이로 안 읽힌다.** 천 · 띠 · 커프스 · 리본으로 보인다.
실측에서 두 판 연속 걸렸다(7절).

```
✗ a folded application sheet wrapped around the hourglass waist like a band
✓ an envelope pushed halfway down into a slot, its flap still visible above
```

**종이는 모서리와 봉투 덮개가 보이는 채로 어딘가에 반쯤 들어가 있어야** 종이로 남는다.

### ⑥ ⭐ 두 기호를 억지로 붙이지 말고 하나로 합친다 — 2판에서 추가

주제가 개념 둘(시간 + 접수)을 요구할 때, 두 사물을 나란히 놓거나 하나를 다른 하나에
매다는 방식은 계속 실패했다. **한쪽에 다른 쪽의 기능을 넣어 하나의 사물로 만든다.**

```
✗ 모래시계 + 신청서를 목에 끼운다      → 시간이 멈춘 그림 (주장이 뒤집힘)
✗ 모래시계 + 신청서를 목에 두른다      → 흰 커프스로 보임 (종이가 아님)
✓ 시계 몸통 윗면에 투입구를 내고 봉투를 반쯤 밀어 넣는다   → 「시간 안에 넣는다」가 한 덩어리
```

⚠️ 이건 ③의 「조연은 주연에 닿아야 한다」보다 한 단계 위다. **닿는 것으로 안 되면 합친다.**

### ⑦ 스타일 블록의 금지 항목과 충돌시키지 않는다

| SUBJECT 에 쓰면 안 되는 것 | 충돌하는 금지 항목 | 대신 |
|---|---|---|
| 선반 · 책상 · 바닥 · 벽 · 지면선 | `isolated cutout` | 사물만. 놓인 자리를 그리지 않는다 |
| 날짜 · 금액 · 시계 숫자판 | `no text, no numbers` | 눈금과 바늘만. 숫자는 안 쓴다 |
| 점선 · 끊어진 선 · 흩어진 조각 · 모래알 | `no floating disconnected elements` · `no stippling` | 덩어리 하나로 |
| 리본 로제트 · 술 · 깃털 · 주름 | 손그림 한 굵기 선 | 굵은 외곽선 하나로 잡히는 형태로 |

### ⑧ 은유는 한 겹으로

`계산기 + 동전 + 재생버튼` 처럼 개념이 셋이면 그림이 셋으로 갈라진다. 하나로 줄인다.

---

## 6. 완성 예시

### 「포브스 어워즈, 어떤 기업이 받을까?」 — 요청자 확인 통과, **기준선**

```
a single centered illustration that expresses this idea: "포브스 어워즈, 어떤 기업이 받을까?". the sentence is a QUESTION — the winner is not decided yet. use only symbols any reader understands without insider knowledge: a company is a building, an award is a trophy. SUBJECT: a row of four simple office buildings standing side by side and touching each other, all the same shape and height, and one award trophy standing on top of the row spanning across their rooflines so it belongs to no single building. FILL: the trophy is left WHITE and empty inside so it stands out; the four buildings are filled with one flat mid-grey (#DCDCDC) so they sit back; solid black only for the outlines and the small windows. no stars, no sparkles, no rays. hand-drawn ink illustration in black line on transparent background, drawn with a felt-tip marker at an even medium thickness — thicker than a fineliner, thinner than a brush pen, every stroke is one confident continuous pass whose edge waves and wobbles clearly enough to read as hand-drawn, but the edge stays clean: no rough dry-brush texture, no scratchy or broken edges, no blobs, line weight stays consistent across the whole drawing, FLAT FILLS ONLY with no texture, no hatching, no cross-hatching, no stippling, no sketchy fill strokes, no scribbles, no shading, no gradient, no cast shadows, no drop shadows, no 3D volume, no perspective, flat front-on view, simple clear shapes, the whole illustration reads as ONE connected silhouette, elements overlap and touch, generous even margin, nothing touching the frame edges, 1:1 square, transparent background, isolated cutout with no outline or halo around it, not taken from an icon library, no icon-pack look, no white outline around the shape, no floating disconnected elements, no text, no letters, no numbers, no watermark, no logo, no signature
```

**왜 통과했나** — 「아직 안 정해졌다」를 *트로피가 어느 건물에도 속하지 않고 지붕들을 가로질러
걸쳐 있다*로 그렸다. 명사(기업·상)를 옮긴 것이 아니라 **문장이 하는 일(아직 미정)** 을 그렸다.

### 다른 SUBJECT 문형

```
1. 인증마크, 붙이기 전에 확인할 네 가지
SUBJECT: a round certification stamp pressed down onto a checklist sheet,
the sheet curling up slightly at one corner under the pressure

2. 상은 쓰기 시작하는 순간부터 일합니다
SUBJECT: an award emblem badge fixed at the top of a long product page sheet,
the sheet hanging down below it

3. 월 100만원이 비싼지 싼지는 CPV를 봐야 압니다
SUBJECT: a single large coin sliced into many thin equal slices,
the slices still stacked together

4. '1위'만 적힌 문구는 근거를 물었을 때 댈 것이 없습니다
SUBJECT: a thick heavy medal resting on top of one thin sheet of paper,
the sheet buckling in the middle under its weight
```

---

## 7. ⚠️ 실패 기록 — 「접수 마감까지 2주 남았습니다」 3연속

**같은 주제를 세 판 실패했다.** 셋 다 그림체는 맞았고 **뜻이 틀렸다.**
새 주제를 쓸 때 이 표를 먼저 본다.

| 판 | 그린 것 | 무엇이 틀렸나 |
|---|---|---|
| 1 | 신청서를 모래시계 목에 **끼움** | 목이 막혀 **모래가 멈췄다.** 「마감이 다가온다」의 정반대 — 시간이 멈춘 그림이 됐다 (5절 ①) |
| 2 | 신청서를 모래시계 목에 **두름** | 종이가 **흰 커프스**로 보였다. 접힌 종이는 감으면 종이로 안 읽힌다 (5절 ⑤) |
| 3 | 시계 윗면 투입구에 봉투를 반쯤 넣음 | — 이 형태로 정리됨 (5절 ⑥) |

### 여기서 나온 규칙 세 개

**① 흐름·진행을 뜻하는 기호는 멈추면 주장이 뒤집힌다.**
모래시계 · 계단 · 화살표 · 물줄기가 그렇다. 조연을 붙일 때 **흐름을 막는 자리에 놓지 않는다.**
막을 수밖에 없는 구조라면 그 기호 자체를 버린다.

**② 접힌 종이는 감지 말고 반쯤 넣는다.** (5절 ⑤)

**③ 개념 둘은 붙이지 말고 합친다.** (5절 ⑥)

⚠️ 세 판 모두 **2절 스타일 블록은 완벽하게 작동했다.** 그림체가 잘 나온다고 통과시키면 안 된다.
   10절 검증 순서를 반드시 1번부터 본다.

---

## 8. 참고 구현

`noteIconPrompt()` 를 아래 형태로 바꾼다. 인자와 반환값은 그대로다 — 호출부는 손대지 않는다.

```js
const NOTE_STYLE = [
  'hand-drawn ink illustration in black line on transparent background',
  'drawn with a felt-tip marker at an even medium thickness — thicker than a fineliner, thinner than a brush pen, every stroke is one confident continuous pass whose edge waves and wobbles clearly enough to read as hand-drawn, but the edge stays clean: no rough dry-brush texture, no scratchy or broken edges, no blobs, line weight stays consistent across the whole drawing',
  'FLAT FILLS ONLY with no texture, no hatching, no cross-hatching, no stippling, no sketchy fill strokes, no scribbles, no shading, no gradient, no cast shadows, no drop shadows, no 3D volume, no perspective, flat front-on view',
  'simple clear shapes, the whole illustration reads as ONE connected silhouette, elements overlap and touch',
  'generous even margin, nothing touching the frame edges',
  '1:1 square, transparent background, isolated cutout with no outline or halo around it',
  'not taken from an icon library, no icon-pack look, no white outline around the shape',
  'no floating disconnected elements',
  'no text, no letters, no numbers, no watermark, no logo, no signature',
].join(', ');

function noteIconPrompt(card, title, subject) {
  const idea = subject || title || card.icon || card.shot;
  return [
    `a single centered illustration that expresses this idea: "${idea}"`,

    // ⚠️ 아래 세 줄이 「주제와 상관없는 그림」을 막는다. 이 줄들이 제일 중요하다. 빼지 말 것.
    'draw what the sentence CLAIMS, not the objects it mentions. the picture must let a viewer restate the claim. never draw the opposite of the claim',
    'if the sentence is a question, show that the answer is not decided yet; if it is a statement, show it as already true',
    'use only symbols any reader understands without insider knowledge: a company is a building, an award is a trophy, an application is an envelope, a certification is a round badge, time is a clock',

    'if a Korean word in the sentence has more than one meaning, use the meaning the sentence intends. never picture a different sense of the word',
    'never depict the award, certificate or product being used casually, as a joke, or for an unintended purpose. it must look valuable',

    // ⚠️ 아래 세 줄이 「나열된 아이콘」과 「알아볼 수 없는 조연」을 막는다. 빼지 말 것.
    'draw ONE main object with at most one secondary element, and the secondary element must physically touch, overlap, wrap or rest on the main object',
    'describe them as a single action, never as a list of separate props',
    'never wrap or band a sheet of paper around another object — paper must keep its corners visible, half inserted into a slot or opening',

    // ⚠️ 흐름 기호를 막으면 주장이 뒤집힌다 (7절 ①)
    'if the drawing contains anything that flows or progresses, it must be shown still flowing, never blocked or stopped',

    card.icon || card.shot ? `visual motif to draw from: ${card.icon || card.shot}` : '',

    'FILL: the object that carries the claim is left WHITE and empty inside so it stands out; the supporting object is filled with one flat mid-grey (#DCDCDC) so it sits back; solid black only for the outlines and the smallest details. no stars, no sparkles, no rays',

    NOTE_STYLE,
  ].filter(Boolean).join('. ');
}
```

---

## 9. 하지 말 것

- **이미지 안에 한글을 넣지 않는다.** 레퍼런스의 말풍선 문구는 디자인에서 얹은 것이다.
  말풍선은 **빈 채로** 뽑고 텍스트는 카드 레이어에서 얹는다.
- **별표 버스트를 프롬프트에 넣지 않는다.** 주 사물에 닿지 않아 실루엣이 갈라진다.
  쓰려면 이미지가 아니라 **카드 레이어에서** 얹는다.
- **컨셉을 가리지 않고 적용하지 않는다.** 이 프롬프트는 노트형 전용이다.
- **`precise` · `crisp` · `geometric` 을 되살리지 않는다.** 아이콘팩으로 돌아간다 (1절).
- **점묘·빗금으로 채우지 않는다.** 모래를 점으로 그려서 걸렸다 (2절).
- **종이를 감지 않는다.** (5절 ⑤ · 7절)
- **흐름을 막지 않는다.** (7절 ①)

---

## 10. 검증

**순서가 있다. 1번부터 본다.**

**1 — 주제 적합도.** 주제 문장을 가리고 그림만 남긴 뒤, 그림만 보고 주제의 주장을 되말할 수
있는지 본다. 못 하면 나머지는 볼 것도 없이 실패다.

**2 — 주장이 뒤집히지 않았나.** 흐름이 멈춰 있거나, 방치·중단으로 보이지 않는지 본다 (7절 ①).

**3 — 조연이 무엇인지 알아볼 수 있나.** 종이가 천으로, 배지가 동전으로 보이면 실패다 (5절 ⑤).

**4 — 실루엣.** 눈을 가늘게 뜨고 본다. 덩어리 **하나**로 읽히면 통과.

**5 — 주연이 흰색인가.** 주장을 진 사물이 회색으로 채워졌으면 FILL 절이 안 먹은 것이다 (3절).

⚠️ **2·3·4를 먼저 보지 말 것.** 잘 그려졌는지부터 보면 주제와 상관없는 예쁜 그림을 통과시킨다.
   실제로 그렇게 다섯 개를 통과시켰고, 2판에서도 같은 실수를 두 번 더 했다 (7절).

---

## 11. ⚠️ 주제와 그림을 잇는 자리가 아직 없다

**프롬프트만 갈아끼우면 여기서 다시 막힌다.** 6절 SUBJECT 는 사람이 손으로 쓴 것이고,
**지금 앱에는 「주제 → 어떤 사물로 그릴까」를 정하는 자리가 없다.**

### 지금 흐름

1. `lib/outline.js` 3단계가 `shot` 을 만드는데, 지시문이 **"어울리는 사진 장면(shot)을 영문으로
   적습니다"** 로 못박혀 있다 (428행). JSON 스키마도 `"이 항목에 어울리는 사진 장면"` 이다 (559행).
2. 그 **사진 장면**이 `noteIconPrompt()` 에서 `visual motif to draw from:` 으로 픽토그램
   프롬프트에 그대로 붙는다.

사진용 장면을 픽토그램 재료로 주고 있다.

### 권하는 방식 — `icon` 필드를 하나 더 받는다

같은 호출에서 두 벌을 만들고, 노트형이면 `icon` 을, 나머지 컨셉이면 `shot` 을 쓴다.

```
"shot": "이 항목에 어울리는 사진 장면 (영문)",
"icon": "이 항목을 그림 하나로 그린다면 무엇을 그릴지 (영문). 납작하고 단순한 사물 둘,
         조연은 주연에 닿아 있어야 하고, 관계를 동사로 쓴다. 종이는 감지 말고 반쯤 넣는다.
         흐르는 것은 멈추지 않는다. 배경·바닥·글자·숫자는 쓰지 않는다"
```

- 컨셉을 몰라도 된다 — 두 벌을 다 만들어 두고 나중에 고른다
- **API 호출이 안 늘어난다.** 출력 토큰만 조금 는다

손댈 곳은 네 군데다.

| 파일 | 무엇을 |
|---|---|
| `lib/outline.js` 428행 | 3단계 지시문에 `icon` 항목을 더한다 |
| `lib/outline.js` 559행 | JSON 스키마에 `icon` 을 더한다 |
| `lib/outline.js` 861행 근처 | 파싱부 `trim` 목록에 `icon` 을 더한다 |
| `lib/imageprompt.js` | `noteIconPrompt()` 를 8절 형태로 교체한다 |

⚠️ `card.icon` 이 비어 있을 때는 `card.shot` 으로 폴백한다. 기존에 저장된 덱에는 `icon` 이 없다.
