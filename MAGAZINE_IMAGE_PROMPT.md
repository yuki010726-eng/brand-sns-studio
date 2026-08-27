# 매거진형 이미지 프롬프트 교체

매거진형(A) 카드 배경 사진의 프롬프트를 바꾼다. **어떤 주제가 들어와도 주제에 맞는 고품질 사진이
나오게 하는 것**이 목표다.

- **대상**: `lib/imageprompt.js` · `lib/concepts.js` · `lib/outline.js`
- **컨셉**: `magazine` (뱃지 A)
- ⚠️ 노트형(C)은 `noteIconPrompt()` 로 갈라져 나가므로 이 변경의 영향을 받지 않는다 —
  별도 문서(`NOTE_ICON_PROMPT.md`) 참고.

---

## 1. 왜 바꾸나

요청자 지적 두 가지에서 출발했다 — **"어떤 주제를 넣어도 비슷해 보인다"**,
**"너무 어둡고 누렇게 나온다"**. 실제로 이미지를 뽑아 보며 원인을 넷 찾았다.

### ① 화풍이 주제를 덮고 있었다

프롬프트가 **주제를 먼저 말하고 화풍을 나중에 말한다.** 뒤에 오는 지시가 이기므로 화풍이 항상 주제를 덮는다.

⚠️ 텍스트 프롬프트는 이 원리를 이미 배웠다 — `CLAUDE.md` 8-34 에서 **스타일 블록을 채널 규칙
뒤로 옮긴** 이유가 같다. 이미지 프롬프트만 반대로 돼 있었다.

### ② 고정부에 무드 형용사가 들어 있었다

`cinematic` · `dramatic directional lighting` · `rich saturated colors` · `magazine cover quality`
네 개가 매 장 똑같이 붙어 톤을 통째로 묶었다. 게다가 앞쪽 주제 절이 "not a mood or an
atmosphere" 라고 말하고 있어 **앞뒤가 싸운다.**

### ③ 하단을 이중으로 어둡게 하고 있었다

고정부에 `darker toward the bottom of the frame` 이 있는데, 매거진형은 **렌더러가 이미 하단
검정 그라데이션을 그린다** (`lib/concepts.js` 의 `layout.overlay: 'bottom-dark'`).
사진이 어두울 이유가 없다. 모델은 저 문장을 "하단만" 이 아니라 **"전체를 어둡게"** 로 받는다.

### ④ 색온도 지시가 하나도 없었다

화이트밸런스 관련 단어가 프롬프트 어디에도 없다. **지시가 없으면 모델은 "고급스러움 = 따뜻한
금색" 으로 간다.** 시상식·트로피 주제는 학습 데이터가 샹들리에·골드로 몰려 있어 더 심하다.

---

## 2. 조립 순서를 뒤집는다

| | 지금 | 바꾼 뒤 |
|---|---|---|
| 1 | 주제·캡션 | 고정 블록 (화풍·색·재질) |
| 2 | `card.shot` | `localeFor(shot)` |
| 3 | `FRAMING[index]` | `SPACE[kind]` (여백) |
| 4 | `localeFor(shot)` | stock-photo 금지 절 |
| 5 | `SPACE[kind]` | `vertical 4:5` |
| 6 | **`concept.style`** | `card.shot` (장면) |
| 7 | stock-photo 금지 절 | **주제 문장 + 우선권 선언** |

마지막 절에 **충돌하면 주제가 이긴다**를 명시한다.

```
THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about:
"{주제}". Show the concrete object or action it refers to.
If the style above pulls toward a generic mood, the subject wins.
```

### ⚠️ `FRAMING` 배열은 없앤다

지금 `FRAMING` 은 **카드 번호로만 회전**한다 — 1번 카드는 언제나 wide, 2번은 언제나 macro.
주제가 뭐든 6장 구성이 항상 같아서 **「다 비슷하다」의 구조적 원인**이다.

카메라는 이제 `shot` 이 직접 갖는다(5절 ④). 두 곳에서 프레이밍을 지시하면 서로 싸운다.

---

## 3. 새 고정 블록

`concept.style` 을 이 값으로 바꾼다.

```
realistic editorial photograph, neutral white balance, no overall warm or amber color grading,
true-to-life colors, high detail, sharp focus,
strong tonal contrast with clean highlights and deep shadows, premium materials and finish,
no text, no letters, no words, no typography, no watermark, no logo, no signature
```

### 이전 값과 달라진 곳

| | 이전 | 새 값 |
|---|---|---|
| 화풍 | `cinematic editorial news photograph` | `realistic editorial photograph` |
| 조명 | `dramatic directional lighting` | **제거** — 장면(shot)이 정한다 |
| 색 | `rich saturated colors` | `neutral white balance, no overall warm or amber color grading, true-to-life colors` |
| 구도 | `wide dynamic composition` | **제거** — 장면이 정한다 |
| 품질 | `magazine cover quality` | `high detail, sharp focus` |
| 고급감 | 없음 | `strong tonal contrast with clean highlights and deep shadows, premium materials and finish` |
| 하단 | `darker toward the bottom` | **제거** — 렌더러가 그린다 |

⚠️ **무드 형용사와 밝기를 여기에 되살리지 말 것.** 무드를 넣으면 모든 주제가 같은 사진이 되고,
   밝기(`bright`·`open shadows`)를 넣으면 그림자가 사라져 싸구려 사무실 사진이 된다. 둘 다 실측으로 확인했다.

⚠️ `no overall warm or amber color grading` 은 **전체 색보정만 막고 금색 물체는 허용**한다.
   `no gold` 처럼 물체를 막으면 시상식 장면이 회의실이 된다.

### `SPACE` 문구도 바꾼다

"어둡게" 가 아니라 **"비우라"** 로.

| kind | 문구 |
|---|---|
| `cover` | `keep the lower third of the frame free of clutter and important detail so text can be placed there` |
| `body` | `keep the composition simple with a calm area in the middle of the frame for a text panel` |
| `outro` | `calm balanced composition with open space in the lower half` |

---

## 4. 구도 표 — 여기가 핵심

**구도가 곧 의미다.** 이걸 안 맞추면 사물을 아무리 잘 골라도 다른 말을 하는 사진이 나온다.
장면을 쓰기 전에 **주제가 무엇을 말하려는지부터** 정한다.

| 주제가 말하는 것 | 구도 | 예 |
|---|---|---|
| **선택·선정** — 여럿 중 하나가 뽑힌다 | 하나만 튀어나오거나 밝다 | 서류 더미에서 한 장이 밀려 나옴 |
| **범위·규모** — 얼마나 많이 닿나 | **같은 것이 반복된다**, 넓게 | 창마다 같은 TV 불빛 |
| **비교·비율** — 어느 쪽이 큰가 | 두 무더기의 크기 차이 | 설문 카드 두 더미, 한쪽이 두 배 |
| **순서·절차** — 무엇부터 하나 | 하나가 앞에, 나머지는 뒤로 | 접수 양식 한 장 + 만년필 |
| **시간·기한** — 얼마 남았나 | 계측기 + 대상 하나 | 스톱워치 + 카드 한 장 |
| **축적·지속** — 오래 남는다 | 줄지어 쌓인 것 | 신문 아카이브 |
| **자리·부착** — 어디에 붙나 | 붙어 있는 접점 클로즈업 | 매장 유리문의 인증 스티커 |
| **비어 있음·미정** — 우리 자리는? | 칸이 나뉘고 하나가 빈다 | 진열장 한 칸이 비어 있음 |

⚠️ **구도를 재탕하지 말 것.** 실제로 걸렸다 — 「어디까지 나가나요」(범위)에
「여럿 중 하나만 다르다」(선택) 구도를 썼더니, 그림은 잘 나왔는데 **도달 범위가 아니라
차별화를 말하는 사진**이 됐다. 잘 나온 구도를 다른 주제에 옮기면 예쁜데 딴말을 한다.

---

## 5. 장면 작성 규칙

`card.shot` 은 네 조각으로 쓴다. **사진의 품질은 전부 이 칸에서 나온다.** 고정 블록은 톤만 잡는다.

### ① 사물과 장소 — 주제가 벌어지는 자리

주제에 나오는 명사가 아니라 **그 일이 일어난 흔적**을 담는다. 사물 하나만 미니멀하게 두면
「정리·보관」으로 읽힌다.

```
✗ a stack of dark linen-bound books
     미니멀해서 심사·선정이 안 읽힌다
✓ a stack of clipped document folders, a rubber stamp and a metal award trophy blurred behind
     응모·심사·시상이 한 화면에
```

#### 장소를 함께 적는다

**집기만 적고 장소를 비워 두면 모델이 스스로 정한다.** 그리고 가장 흔한 답으로 간다 —
선반·테이블·수납장은 **집**으로, 사람이 앉는 실내는 **사무실**로.

실제로 걸렸다(카드형) — `a pale wooden display shelf divided into several compartments` 로
「부문」을 그리려 했더니 화장품·인형·운동화가 놓인 **가정집 수납장**이 나왔다.

**장소와, 그 공간에만 있는 집기를 같이 적는다.**

```
✗ a display shelf divided into several compartments
✓ a row of display plinths inside a bright gallery, a low rope barrier along the front
```

⚠️ **그 공간에만 있는 집기 하나가 가장 세다.** 관람 동선(로프 배리어) · 전시 받침대 ·
   접수 데스크는 집에 없으므로, 그 하나로 장소가 갈린다.

⚠️ 이건 `avoid generic stock-photo scenes` 절과 짝이다 — 그쪽은 기본값을 막고,
   이쪽은 **대신 갈 곳을 준다.** 막기만 하면 모델이 다른 기본값으로 옮겨갈 뿐이다.

### ② 상태 — 무슨 일이 일어나는 중인지

```
✗ sitting on the desk
✓ pushed out from between the layers and catching the light
```

### ③ 조명 — 반드시 여기에. 고정 블록에 넣지 않는다

장면마다 조명이 달라야 사진이 서로 안 닮는다. 고정 블록에 넣는 순간 전 장이 같아진다.

```
a single hard light raking in from the upper left, deep black falloff behind
one clean shaft of daylight across the subject, deep shadow around the frame edges
cool white spotlights washing the subject, dark surroundings
even cool light across the face of the subject
soft window light from the side, shadow falling to the right
the only light coming from the subject itself, deep blue night around it
```

### ④ 카메라 — 각도와 심도

```
shot close at desk level with shallow depth of field
low three-quarter angle, shallow depth of field
slight overhead angle, even focus
wide, subject centred, deep focus
```

### 재질 — 고급감은 여기서 온다

금색에 기대지 않는다.

```
dark stone · brushed steel · dark walnut · navy velvet · smoked glass · matte black lacquer
```

---

## 6. 완성 예시

### 선택·선정 구도 — 「포브스 어워즈, 어떤 기업이 받을까?」 (표지)

```
realistic editorial photograph, neutral white balance, no overall warm or amber color grading, true-to-life colors, high detail, sharp focus, strong tonal contrast with clean highlights and deep shadows, premium materials and finish, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the lower third of the frame free of clutter and important detail so text can be placed there. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a thick stack of clipped document folders seen close from the side on a dark stone desk, one pale cream envelope pushed out from between the layers and catching the light, a rubber stamp and a metal award trophy sitting blurred in the background, a single hard light raking in from the upper left, deep black falloff behind the stack, shot close at desk level with shallow depth of field. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "포브스 어워즈, 어떤 기업이 받을까?". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

### 범위·규모 구도 — 「월 100만원, 어디까지 나가나요?」 (표지)

```
realistic editorial photograph, neutral white balance, no overall warm or amber color grading, true-to-life colors, high detail, sharp focus, strong tonal contrast with clean highlights and deep shadows, premium materials and finish, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the lower third of the frame free of clutter and important detail so text can be placed there. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a dense block of Korean apartment towers at night seen from across an empty river park, dozens of living room windows lit from inside by the flicker of televisions, the same cool light repeating window after window across the whole facade, a few windows dark, deep blue night sky with no orange streetlight glow, shot wide from a low distant angle with deep focus, the empty park in front falling into shadow. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "월 100만원, 어디까지 나가나요?". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

### 비교·비율 구도 — 「소비자 평가가 절반을 넘습니다」 (본문)

```
realistic editorial photograph, neutral white balance, no overall warm or amber color grading, true-to-life colors, high detail, sharp focus, strong tonal contrast with clean highlights and deep shadows, premium materials and finish, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the composition simple with a calm area in the middle of the frame for a text panel. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. two stacks of blank survey response cards standing side by side on a dark stone surface, the left stack clearly more than twice the height of the right one, a single hard light raking in from the upper left with deep black falloff behind them, shot close at desk level with shallow depth of field. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "소비자 평가가 절반을 넘습니다". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

---

## 7. 하지 말 것

전부 실제로 이미지를 뽑아 보며 걸린 것들이다.

| | 무슨 일이 벌어지나 |
|---|---|
| 고정 블록에 무드 형용사 (`cinematic` `dramatic` `moody`) | 모든 주제가 **같은 사진**이 된다 |
| 고정 블록에 밝기 (`bright` `well exposed` `open shadows`) | 그림자가 사라져 **싸구려 사무실 사진**이 된다 |
| `darker toward the bottom` | 렌더러가 이미 하단 그라데이션을 그린다. **이중으로 어두워진다** |
| 색온도 지시 생략 | **누렇게** 나온다 |
| 사물 하나만 미니멀하게 | 주제가 **안 읽힌다**. 「정리·보관」으로 보인다 |
| 시상식 주제에 `no chandeliers, no spotlights` | 연출 조명까지 막혀 **회의실**이 된다 |
| 화면·모니터에 단색 지시 (`glowing pale blue`) | **신호 없음 화면**이 되어 미완성으로 보인다 |
| 구도 재탕 | 그림은 예쁜데 **주제와 딴말**을 한다 |
| 집기만 적고 장소 생략 | 모델이 가장 흔한 기본값으로 채운다 — **집** 또는 **사무실**. 5절 ① 참고 |

⚠️ 화면이 나오는 주제는 **화면 내용을 안 그려도 되는 장면으로 우회**하는 게 안전하다 —
   창밖으로 새는 빛, 모니터 뒷면, 꺼진 화면에 비친 반사.

---

## 8. 검증

**순서가 있다. 1번부터 본다.**

1. **구도** — 주제가 「선택」인가 「범위」인가 「비교」인가. 4절 표와 맞는지 본다.
   안 맞으면 나머지는 볼 것도 없다.
2. **주제 적합도** — 주제 문장을 가리고 사진만 남긴 뒤, 사진만 보고 주제를 되말할 수 있는지 본다.
3. **톤** — 누렇지 않은가, 그림자가 살아 있나. 이건 5절 ③ 조명으로 조절한다.

⚠️ **3번을 먼저 보지 말 것.** 잘 나온 것부터 보면 주제와 상관없는 예쁜 사진을 통과시킨다.

한 벌(6장)을 뽑았으면 **여섯 장이 서로 확연히 달라야 정상**이다. 비슷하면 고정 블록에
무드나 밝기가 다시 들어갔는지부터 본다.

---

## 9. 손댈 곳

| 파일 | 무엇을 |
|---|---|
| `lib/concepts.js` magazine `style` | 3절의 새 고정 블록으로 교체. `NO_TEXT` 는 그대로 둔다 |
| `lib/imageprompt.js` `buildPrompt()` | 2절 순서로 재배열. 주제 절을 **맨 뒤**로 옮기고 우선권 문장을 붙인다 |
| `lib/imageprompt.js` `SPACE` | 세 문구를 3절 표대로 교체 (어둡게 → 비우라) |
| `lib/imageprompt.js` `FRAMING` | **배열 제거.** 카메라는 `shot` 이 갖는다. `opts.index` 도 함께 정리 |
| `lib/outline.js` 3단계 장면 지시 | 4절 구도 표와 5절 네 조각 규칙을 지시문에 넣는다. **여기가 안 바뀌면 shot 이 그대로라 나머지가 무의미하다** |

⚠️ **마지막 줄이 핵심이다.** `concept.style` 만 바꾸면 절반만 고쳐진다 — 장면을 만드는 건
   아웃라인이고, 지금 그 지시문은 「어울리는 사진 장면」까지만 말한다.
   구도 표가 거기에 들어가야 주제마다 다른 사진이 나온다.

⚠️ 노트형(C)은 `noteIconPrompt()` 로 갈라져 나가므로 **이 변경의 영향을 받지 않는다.**
   카드형(B)은 같은 일반 경로를 타므로 `style` 만 자기 값을 유지하면 된다 —
   **순서 변경과 `SPACE` 변경은 카드형에도 함께 적용된다.**
