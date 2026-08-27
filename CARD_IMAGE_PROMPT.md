# 카드형 이미지 프롬프트 교체

카드형(B) 카드 배경 사진의 프롬프트를 바꾼다.

- **대상**: `lib/concepts.js` 의 `card.style` · `lib/outline.js` 3단계 장면 지시
- **컨셉**: `card` (뱃지 B)

> ⚠️ **이 문서는 카드형에만 있는 것만 적는다.**
> 조립 순서 · 구도 표 · 장면 네 조각 규칙은 **`MAGAZINE_IMAGE_PROMPT.md` 와 공용**이므로
> 여기 옮겨 적지 않는다. 두 벌로 두면 한쪽만 고쳐져 조용히 어긋난다.
> 카드형도 같은 일반 경로(`buildPrompt()`)를 타므로 **순서 변경과 `SPACE` 변경이 함께 적용된다.**

---

## 1. 왜 바꾸나

카드형 `style` 에 매거진형과 **같은 종류의 문제가 셋** 있다.

```
bright natural documentary photograph, clear daylight, open sky or wide scene,
clean uncluttered composition with generous empty space in the middle and lower area,
cool blue leaning color grading, no text, ...
```

| | 무슨 일이 벌어지나 |
|---|---|
| `open sky or wide scene` | 주제가 서류·화면·실내여도 **하늘과 야외로 끌려간다.** 매거진형의 `cinematic` 과 같은 클램프다 |
| `cool blue leaning color grading` | **렌더러가 이미 하단 파랑 그라데이션을 그린다** (`layout.brand: #2673D2`). 사진까지 파랗게 만들면 **이중**이다 — 매거진형의 `darker toward the bottom` 과 정확히 같은 실수 |
| `generous empty space in the middle and lower area` | `SPACE[kind]` 가 이미 여백을 말한다. **같은 지시가 두 곳에** 있다 |

⚠️ **`bright` 는 유지한다.** 매거진형에서는 뺐지만 카드형은 밝은 것이 정체성이다.

### `open sky` 를 뺀 것은 야외를 막은 것이 아니다

부정 지시(`no sky`)는 하나도 넣지 않았다. **고정부에서 강제를 뺐을 뿐**이다.
고정부에 있으면 주제와 무관하게 매번 붙어서 실내 주제에도 하늘이 따라온다.

야외가 맞는 주제면 **장면(`shot`)에 직접 쓴다.** 고정부에 있을 때보다 오히려 선명하게 나온다.
밝고 트인 느낌은 `bright` · `clear even daylight` · `open shadows` 가 준다 —
`open sky` 는 밝기가 아니라 **장소를 못박는 말**이라 성격이 다르다.

> 밝은 야외를 카드형의 기본값으로 삼고 싶다면 자리는 고정부가 아니라 `lib/outline.js` 의
> 장면 지시다 — 「카드형은 가능하면 밝은 야외·트인 공간을 고른다」로 넣으면
> 주제가 실내를 요구할 때는 알아서 빠진다.

---

## 2. 새 고정 블록

`concepts.js` 의 `card.style` 을 이 값으로 바꾼다.

```
bright natural documentary photograph, clear even daylight, neutral white balance,
true-to-life colors, high detail, sharp focus, open shadows with clean highlights,
no text, no letters, no words, no typography, no watermark, no logo, no signature
```

### 이전 값과 달라진 곳

| | 이전 | 새 값 |
|---|---|---|
| 장소 | `open sky or wide scene` | **제거** — 장면(shot)이 정한다 |
| 색 | `cool blue leaning color grading` | `neutral white balance, true-to-life colors` |
| 여백 | `generous empty space in the middle and lower area` | **제거** — `SPACE[kind]` 가 맡는다 |
| 품질 | 없음 | `high detail, sharp focus` |
| 밝기 | `bright natural documentary photograph, clear daylight` | `bright natural documentary photograph, clear even daylight, open shadows with clean highlights` |

⚠️ **`cool blue` 를 되살리지 말 것.** 사진이 파랗고 그 위에 파란 그라데이션이 얹히면
   카드 전체가 한 색으로 눌린다.

---

## 3. ⭐ 밝은 톤에서는 빈 공간이 안 산다

**이것이 카드형에만 있는 규칙이다.**

매거진형과 카드형에 같은 「빈 시상식장」 장면을 넣었더니 매거진형은 통과하고 카드형은 실패했다.
요청자 지적 — *"1번(어두운 것)일 때는 웅장함이 느껴져서 넘어갈 수 있었지만, 2번의 밝은 느낌에
사람도 없고 요소도 없으니 빈 것 같은 느낌이 난다."*

| | 어두운 사진 (매거진형) | 밝은 사진 (카드형) |
|---|---|---|
| 여백이 하는 일 | 안 보이는 부분이 상상으로 메워진다 → **무게** | 다 보이므로 빈 게 그냥 빈 것 → **빈틈** |

**그래서 카드형은 매거진형보다 화면을 더 채워야 한다.** 같은 장면을 톤만 바꿔 옮기면 무너진다.

### 채우는 방법 두 가지

**① 「준비 중」 상태로 바꾼다** — 완성된 장면보다 요소가 자연히 늘어난다.

```
✗ 텅 빈 시상식장, 의자 열, 무대
✓ 준비 중인 시상식장 — 스태프, 좌석마다 놓인 팸플릿, 연단, 대기 중인 상자들
```

**② 작은 요소를 반복시킨다** — 넓은 화면을 채우는 가장 효율적인 장치다.

```
a folded programme already placed on every seat
```

의자 열을 따라 팸플릿이 반복되면서 프레임이 찬다.

---

## 3-2. 일상 집기는 장소를 안 적으면 집으로 간다

선반 · 테이블 · 수납장처럼 **집에도 있는 집기**를 쓸 때, 장소를 안 적으면 모델이 스스로 정한다.
그리고 가장 흔한 답이 **집**이다.

실제로 걸렸다 — `a pale wooden display shelf divided into several compartments` 로 「부문」을
그리려 했더니 화장품·커피머신·인형·기저귀·운동화가 놓인 **가정집 수납장**이 나왔다.
`different kind of product` 도 모델은 가장 흔한 해석인 **생활잡화**로 받는다.

**장소와 그 공간에만 있는 집기를 함께 적어 성격을 못박는다.**

| 집으로 가는 말 | 대신 |
|---|---|
| `display shelf` · `pale wooden` | `display plinths` · `charcoal grey` |
| (장소 없음) | `inside a bright gallery` · `in an exhibition hall` |
| (동선 없음) | `a low rope barrier` · `polished concrete floor` |

⚠️ **공간에만 있는 집기 하나가 가장 세다.** 관람 동선(로프 배리어)이나 전시 받침대는
   집에 없으므로, 그 하나로 「내 집 선반」과 「전시장」이 갈린다.

> 이 규칙은 매거진형에도 해당한다 — `MAGAZINE_IMAGE_PROMPT.md` 5절 ① 참고.

---

## 3-3. 밝은 배경에는 진한 피사체

카드형은 배경이 밝아야 한다. 그런데 **피사체까지 밝으면 형태가 안 잡힌다.**

2판에서 걸렸다 — `white display plinths` 를 `bright exhibition hall` 에 두었더니
밝은 것 위에 밝은 것이라 **뭐가 있는지 안 보였다.** 게다가 `tall windows down the far wall` 이
역광이라 앞의 물체가 더 죽었다.

**밝은 게 문제가 아니라 대비가 없는 게 문제다.** 카드형은 배경을 밝게 유지해야 하므로
**피사체를 진하게** 가는 쪽이 맞다.

| | 이렇게 |
|---|---|
| 피사체 | `charcoal grey` · `dark walnut` · `deep navy` |
| 배경 | `a plain white wall behind` · `bright gallery` |
| 조명 | **측광** (`soft daylight from the left`). 정면 창은 역광이 된다 |

### 멀어 보이면 열을 프레임 밖으로 잇는다

「여럿」을 보여주려고 전체를 다 담으면 카메라가 물러나 요소가 작아진다.

```
✗ a row of plinths, all of them visible
✓ the row running out past both edges of the frame, the plinths filling most of the frame
```

몇 개인지 안 세어도 **여럿인 게 읽히면서** 가까이 갈 수 있다.

---

## 4. 인물 규칙

행사·매장처럼 **사람이 있어야 성립하는 장면**에서는 사람을 넣는다.
`localeFor()` 가 장면의 사람 단어(`staff` · `people` · `worker` …)를 보고 자동으로 전환한다.

```
사람 단어 없음 → shot in South Korea, no people in frame
사람 단어 있음 → all people are Korean with East Asian faces, shot in South Korea
```

⚠️ **한 벌에 한 장만.** `CLAUDE.md` 8-20 의 「인물 정면은 6컷 중 최대 1개」 규칙이 그대로 산다.
   전부 사람 사진이 되면 8-20 이 고친 문제로 되돌아간다.

---

## 5. 조명 메뉴 — 카드형용

매거진형의 하드라이트·검은 폴오프는 카드형에 쓰지 않는다.

```
bright overcast daylight with no hard shadows
soft even daylight from a window to the left
late morning sun from the side, clean open shadows
backlit by a tall window, bright and airy
tall windows down one side filling the room with bright flat light
```

### 재질

매거진형이 어두운 고급 재질(dark stone · navy velvet)을 쓴다면 카드형은 밝은 쪽이다.

```
pale oak · light grey desk · white plaster wall · pale wood shelf · light carpet
```

---

## 6. 완성 예시 — 같은 4주제

매거진형 문서의 같은 주제와 나란히 두고 보면 **구도는 같고 재질·조명만 다르다.**

### 1 · 포브스 어워즈, 어떤 기업이 받을까? (표지 · 선택 구도)

```
bright natural documentary photograph, clear even daylight, neutral white balance, true-to-life colors, high detail, sharp focus, open shadows with clean highlights, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the lower third of the frame free of clutter and important detail so text can be placed there. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a thick stack of clipped document folders on a pale desk beside a tall window, one cream envelope pushed out from between the layers, a rubber stamp and a plain award trophy standing softly out of focus behind, bright overcast daylight filling the room with no hard shadows, shot at desk level with shallow depth of field. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "포브스 어워즈, 어떤 기업이 받을까?". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

### 2 · 9월 29일, 어떤 행사인가요? (본문 · 사람 있음)

⚠️ 3절의 규칙이 실제로 적용된 장면이다. 텅 빈 홀로 두면 밋밋해진다.

```
bright natural documentary photograph, clear even daylight, neutral white balance, true-to-life colors, high detail, sharp focus, open shadows with clean highlights, no text, no letters, no words, no typography, no watermark, no logo, no signature. all people are Korean with East Asian faces, shot in South Korea. keep the composition simple with a calm area in the middle of the frame for a text panel. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a ceremony hall being prepared in the early afternoon, two staff members in dark uniforms straightening the rows of chairs, a folded programme already placed on every seat, a podium and a row of award boxes waiting on the raised platform, tall windows down one side filling the room with bright flat light, shot wide from the back of the room with deep focus. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "9월 29일, 어떤 행사인가요?". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

### 3 · 우리 브랜드는 어느 분야일까요? (본문 · 비어 있음 구도)

⚠️ 3-2 · 3-3 절의 규칙이 둘 다 적용된 장면이다. **두 번 실패하고 세 번째에 나온 것**이다.

```
bright natural documentary photograph, clear even daylight, neutral white balance, true-to-life colors, high detail, sharp focus, open shadows with clean highlights, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the composition simple with a calm area in the middle of the frame for a text panel. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a close view of a row of charcoal grey display plinths in a bright gallery, the row running out past both edges of the frame, each plinth holding one large product from a different industry, the plinth in the centre standing completely empty, the plinths filling most of the frame, soft daylight from the left, a plain white wall behind, shot at eye level with even focus. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "우리 브랜드는 어느 분야일까요?". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

| 판 | 무엇이 틀렸나 |
|---|---|
| 1판 `pale wooden display shelf` | **가정집 수납장**으로 나왔다. 장소를 안 적어 모델이 집으로 채웠고, `different kind of product` 도 생활잡화로 갔다 (3-2절) |
| 2판 `white plinths` + `exhibition hall` | 장소는 잡혔는데 **너무 멀고 안 보였다.** 흰 받침대 + 밝은 홀이라 대비가 없고, 정면 창이 역광이었다 (3-3절) |
| 3판 (위) | 열을 **프레임 밖으로 이어지게** 해서 「여럿」을 유지한 채 가까이 갔다 |

### 4 · 판단하기 어렵다면 무료 상담 받아보세요. (마무리 · 자리 구도)

```
bright natural documentary photograph, clear even daylight, neutral white balance, true-to-life colors, high detail, sharp focus, open shadows with clean highlights, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. calm balanced composition with open space in the lower half. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a desk telephone handset lifted off its cradle resting beside an open blank notepad and a pen, pale oak desk by a bright window, morning light spilling across the page, shot close from a low three-quarter angle with shallow depth of field. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "판단하기 어렵다면 무료 상담 받아보세요". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

---

## 7. 하지 말 것 — 카드형에만 해당

공용 항목은 `MAGAZINE_IMAGE_PROMPT.md` 7절에 있다.

| | 무슨 일이 벌어지나 |
|---|---|
| `cool blue leaning color grading` | 파란 사진 위에 파란 그라데이션이 얹혀 **카드가 한 색으로 눌린다** |
| `open sky or wide scene` 를 고정부에 | 실내 주제에도 **하늘이 따라온다** |
| 고정부에 여백 지시 | `SPACE[kind]` 와 **같은 말을 두 번** 한다 |
| 매거진형 장면을 톤만 바꿔 재사용 | **빈 공간이 안 산다.** 3절 참고 |
| 매거진형 조명(하드라이트·검은 폴오프) | 카드형의 밝은 정체성과 충돌한다 |
| 일상 집기에 장소를 안 적음 | **가정집**이 된다. 3-2절 참고 |
| 밝은 배경에 밝은 피사체 | 형태가 안 잡혀 **뭐가 있는지 안 보인다.** 3-3절 참고 |
| 정면 창(`windows down the far wall`) | **역광**이라 앞의 물체가 죽는다. 측광으로 |
| 한 벌에 사람 사진 두 장 이상 | 8-20 이 고친 「전부 사람 사진」 문제로 되돌아간다 |

---

## 8. 검증

`MAGAZINE_IMAGE_PROMPT.md` 8절의 순서(구도 → 주제 적합도 → 톤)를 그대로 쓰되,
카드형은 **네 번째를 더 본다.**

4. **밀도** — 화면이 비어 보이지 않는가. 밝은 톤이라 여백이 그대로 빈틈으로 읽힌다.
   비면 3절의 두 방법(준비 중 상태 · 반복 요소)으로 채운다.

그리고 두 가지를 더 확인한다.

- **파랗지 않은가.** 렌더러 파랑 그라데이션이 얹히므로 사진은 중립이어야 한다.
  사진까지 파랗게 나오면 `cool blue leaning color grading` 이 어디선가 살아 있다.
- **피사체가 배경에서 떨어져 보이는가.** 밝은 배경에 밝은 피사체를 두면 형태가 안 잡힌다 (3-3절).
- **하단이 흰 박스에 가려지지 않는가.** 카드형 본문 장은 하단이 흰 박스로 덮인다.
  중요한 것이 거기 들어가면 `SPACE` 를 카드형용으로 따로 두어야 한다 (지금은 공용).

---

## 9. 손댈 곳

| 파일 | 무엇을 |
|---|---|
| `lib/concepts.js` card `style` | 2절의 새 고정 블록으로 교체. `NO_TEXT` 는 그대로 둔다 |
| `lib/outline.js` 3단계 장면 지시 | 3절(밝은 톤의 밀도) · 5절(카드형 조명·재질)을 지시문에 넣는다 |
| `lib/imageprompt.js` | **카드형 전용으로 고칠 것은 없다.** 순서·`SPACE`·`FRAMING` 변경은 `MAGAZINE_IMAGE_PROMPT.md` 9절에서 함께 처리된다 |

⚠️ 매거진형 문서의 변경이 **먼저** 들어가야 한다. 순서 뒤집기와 `SPACE` 교체가
   일반 경로에 적용된 뒤라야 이 문서의 `style` 교체가 의미를 갖는다.

---

## 10. 2026-08-27 실측 — 밀도 규칙이 구도를 이길 수 있다

3절(밝은 톤에서는 빈 공간이 안 산다)을 **무조건 적용하면 안 된다**는 것이 확인됐다.

주제 「접수 마감까지 2주 남았습니다」(「시간·기한」 구도)에서 3절 ②의 반복 요소를 썼더니,
서류 트레이가 프레임 밖까지 줄줄이 이어지면서 **「접수가 많다」는 사진**이 나왔다.
반복은 `MAGAZINE_IMAGE_PROMPT.md` 4절 표에서 **「범위·규모」 구도가 쓰는 장치**다.
밀도를 채우려다 구도를 갈아치운 것이다.

### 구도별로 채우는 방법이 다르다

| 구도 | 채우는 방법 |
|---|---|
| **범위·규모** | 3절 ②의 반복 요소. 같은 것이 프레임 밖까지 이어진다 |
| **시간·기한 · 선택 · 비교** | 반복 금지. **그 장소가 돌아가는 데 필요한 집기**로 채운다 |
| **자리·부착 · 비어 있음** | 접점 주변의 집기. 접점 자체는 하나로 유지한다 |

「필요한 집기」란 개수가 아니라 **종류**로 채우는 것이다 — 접수함 · 양식 더미 · 펜 · 도장.
같은 것을 여러 개 두는 것과 다른 것을 여러 종류 두는 것은 사진에서 전혀 다른 말을 한다.

### 통과한 장면 — 「접수 마감까지 2주 남았습니다」 (표지)

⚠️ 이 기하(뚜껑에 난 구멍 + 반쯤 들어간 봉투 + 바로 옆에 닿은 시계)는 **매거진형에도 그대로
   옮겨서 통과했다.** 한쪽이 통과하면 다른 쪽은 재질·조명만 바꿔 베낀다.

```
bright natural documentary photograph, clear even daylight, neutral white balance, true-to-life colors, high detail, sharp focus, open shadows with clean highlights, no text, no letters, no words, no typography, no watermark, no logo, no signature. shot in South Korea, no people in frame. keep the lower third of the frame free of clutter and important detail so text can be placed there. avoid generic stock-photo scenes: no person posing thoughtfully, no meeting room, no laptop on a desk unless the scene specifically calls for it. vertical 4:5 portrait composition. a dark walnut submissions box with a wide slot cut in its lid standing on a pale reception counter, one sealed cream envelope pushed halfway into the slot and still standing upright out of it, a charcoal desk clock standing right beside the box close enough to touch it, a short stack of blank entry forms and a pen lying next to them, a plain white wall behind, soft even daylight from a window to the left, the pale counter in front left clear and empty, shot close at counter level with even focus. THE SUBJECT IS WHAT MATTERS MOST: the photo must show what this Korean sentence is about: "접수 마감까지 2주 남았습니다". Show the concrete object or action it refers to. If the style above pulls toward a generic mood, the subject wins.
```

밀도가 **집기 네 종류**(접수함 · 시계 · 양식 더미 · 펜)로 찼고, 반복은 하나도 없다.
대비는 흰 벽 앞의 dark walnut · charcoal 이 잡았다 (3-3절).
