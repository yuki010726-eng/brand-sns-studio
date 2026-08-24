# 기획 — 외부 AI 원고 반입 + 팀 공용 메모리 (v2)

작성 2026-08-24. **아직 구현 없음. 요청자 승인 전 문서다.**
현재 구조와 지난 실패 이력은 `CLAUDE.md` 를 근거로 삼는다(절 번호로 인용).

---

## 0. 한 장 요약

```
[1단계] 상품·주제 선택            (지금과 같음)
   ↓
[2단계] 아이디어 문서화 — 안이 셋으로 갈린다
   ├ ① 브리프 만들기 ──▶ 복사 ──▶ 외부 AI(ChatGPT·Claude·Gemini)에서 대화하며 원고 완성
   ├ ② 원고 가져오기 ◀── 붙여넣기 ──▶ 파서 → 블로그·인스타·쓰레드·카드로 분리 → 검문소
   └ ③ 앱 내 AI 생성 (지금 경로 · 키 있는 사람만 · 폴백으로 유지)
   ↓
[3단계] 카드뉴스 템플릿            (지금과 같음 — 입력만 ②에서 온다)
   ↓
[채택] 복사·게시 → 신호가 Supabase 에 쌓인다
   ↓
   └──▶ 다음 브리프에 자동 주입(팀 규칙 · 골든 예시 · 새 사실) ──▶ 처음으로
```

**핵심은 마지막 화살표다.** 브리프를 사람이 매번 손으로 고치면 그냥 프롬프트 복붙 도구고,
쌓인 신호가 다음 브리프를 바꿔야 "여러 사람이 쓸수록 좋아지는 시스템"이 된다.

---

## 1. 왜 바꾸나 — 지금 구조의 천장 세 개

세 개 다 `CLAUDE.md` 에 이미 원인 분석이 끝나 있고, **프롬프트로는 안 뚫린다**고 적혀 있는 것들이다.

| # | 천장 | 근거 | v2 가 뚫는 방식 |
|---|---|---|---|
| ① | 재료가 안 늘어난다 — 같은 상품이면 같은 12~16개 사실을 영원히 돌려쓴다 | 8-18 ③ (미해결로 명시) | 사실 제보·승인 큐 + 외부 AI 대화에서 나온 재료를 반입 |
| ② | 지시가 1.3만 자인데 모델 여력이 규칙 준수에 다 쓰인다 | 8-18 ② | 강한 외부 모델(추론 상한 없음) + 브리프 예산 상한 |
| ③ | 코드가 모델 대신 읽고 있었다 | 8-24 | 사람이 외부 AI 와 대화로 고친 결과를 그대로 받는다 |

부수 효과 두 개.

- **API 비용 0원.** 지금은 세트당 4회 호출(8-26). 외부 AI 왕복은 각자 이미 쓰는 구독으로 해결된다.
- **키 배포 문제 소멸.** 개인 키 방식(8-7)의 마찰이 사라진다. 여러 사람이 쓰게 만들려면 이게 크다.

**버리지 않는 것:** 앱 내 AI 경로(③)는 지운다는 뜻이 아니다. 키가 있는 사람에겐 여전히 빠르고,
파서가 실패했을 때 폴백이다. "키가 없어도 앱은 끝까지 동작한다"는 기존 원칙(8-26)을 그대로 지킨다.

---

## 2. 브리프 — 앱이 내보내는 것

2단계 첫 탭. 화면에 큰 텍스트 박스 하나 + 「복사」 버튼. **편집 가능**하게 둔다(외부 AI 와 대화하며 손보게).

### 2-1. 브리프에 들어가는 것

| 블록 | 출처 | 상한 |
|---|---|---|
| 역할·목표 | 브리프 템플릿(DB) | 고정 |
| 상품 팩트시트 | `products` + `product_proofs` | **주제 관련도순 상위 K개** |
| 주제·톤·타깃 | 1단계 입력 | — |
| 문체 가이드 | `styles`(수집한 블로그 스타일, 8-28) | 1개 |
| 지켜야 할 규정 | `content_rules`(신설·DB) | **최대 N개** |
| 잘 쓴 예시 | 골든 세트(신설·DB) | **최대 2편** |
| 출력 형식 계약 | 고정 | 고정 |

> ⚠️ **상한을 반드시 건다.** 8-18 ②가 이 프로젝트에서 이미 한 번 일어난 사고다.
> 규정을 DB 로 옮기면 사람들이 계속 추가하고, 브리프는 조용히 2만 자가 된다.
> 그때부터 외부 모델도 똑같이 "좋은 글"이 아니라 "규칙 준수"에 여력을 쓴다.
> 규정은 개수 상한 + 우선순위(사실성 > 표현 > 취향)로 잘라서 넣는다.

### 2-2. 출력 형식 계약 (파싱의 근거)

**왕복 1회로 4종을 한 번에 받는다.** 브리프 안에서 순서를 못박는다 —
"먼저 블로그 본문을 완성하고, **그 완성본을 요약해서** 인스타·쓰레드·카드를 만들 것."
8-26 에서 확인된 순서다. 블로그를 안 보고 쓴 인스타는 카드와 어긋난다.

```
===BLOG===
# 제목
> 후킹 한 줄
## 소제목
본문 문단…
📷 [이미지 1 · 표지]
⤷ 캡션
===INSTAGRAM===
본문…
#해시태그 #…
===THREADS===
본문(300자 이내)
===CARDS===
1 | 카드 제목 | 카드 본문
2 | …
```

**마크다운 규약(`##` 소제목 · `📷` · `⤷`)을 새로 만들지 않고 지금 것을 그대로 쓴다.**
`previewHTML()` · `blogCardSource()` · `deckFromBlog()` 가 이미 이 규약 위에 서 있어서,
계약만 맞추면 3단계 카드뉴스까지 **코드 수정 없이** 연결된다. (⚠️ `HEAD_MARK` 는 `■` 가 아니라 `##`, 8-18 참고)

---

## 3. 반입 — 앱이 받는 것

2단계 둘째 탭. 붙여넣기 박스 하나. 붙여넣는 순간 세 가지가 돈다.

### 3-1. 파서 (`lib/importer.js` · 신설)

1. 구분자로 4블록 분리. 대소문자·공백·`=` 개수 관대하게.
2. 구분자가 없으면 휴리스틱 폴백 — 해시태그 밀집 = 인스타, 300자 이하 단문 = 쓰레드, 나머지 = 블로그.
3. 그래도 안 되면 **전부 블로그 탭에 넣고 사람이 나눈다.** 반입은 절대 실패로 끝나지 않는다.

### 3-2. 검문소 (import gate) — 여기가 v2 의 안전장치다

외부 AI 는 우리 규정을 모른다. 그래서 반입 직후 **막지 않고 표시**한다(기존 `validateDraft` 는 게이트를 사실성 위반으로만 좁혀 뒀다).

| 검사 | 구현 | 판정 |
|---|---|---|
| 금지 표현 | `findBanned` + `BANNED_PHRASES` → 나중에 `content_rules` | 빨강 · 수정 권고 |
| 근거 없는 단정 | `findRisky(text, product)` | 빨강 |
| 주제 이탈 | `offTopic` | 노랑 |
| 글자 수 | `CHANNELS[].limit` + 본문 카운터(8-14 ⑤) | 노랑 |
| **숫자 대조** ⭐ | 본문의 숫자·%·연도·금액·고유명사를 뽑아 팩트시트와 대조 | 팩트에 없으면 **노랑 「확인 필요」** |

⭐ 숫자 대조가 새로 필요한 이유: 앱 내 AI 는 팩트시트 밖으로 못 나가게 프롬프트로 묶여 있었지만,
**외부 AI 는 인터넷에서 배운 걸 자연스럽게 섞어 온다.** "업계 1위", "2019년부터", "월 100만원"이
자료에 있는 값인지 지어낸 값인지 사람 눈으로는 안 걸러진다. 규정이 세 번 뒤집힌 상품(비용·성과)에서
이건 실제 사고로 이어진다. **자동 삭제는 하지 않는다 — 표시만 하고 사람이 정한다.**

### 3-3. 분리 보정

파싱된 인스타·쓰레드가 비었거나 검문소에서 떨어지면 채널별로 세 가지 선택지를 준다.

- **규칙 기반 재구성** (0원·즉시) — 원고 문장을 골라 압축. 문장이 블로그와 겹치는 한계는 있다.
- **파생 브리프 복사** (0원) — 그 채널만 다시 외부 AI 에 맡기는 짧은 브리프.
- **앱 내 AI 파생** — 기존 `derivePosts()` 를 원문만 반입 원고로 바꿔 재사용. 1회 호출.

---

## 4. 공용 메모리 — "기억하고 발전시킨다"의 실체

### 4-1. 먼저 나눠야 한다

"메모리"를 한 덩어리로 두면 반드시 실패한다. 성격이 다른 게 여섯 개고, **자동 반영해도 되는 것과
사람이 승인해야 하는 것이 갈린다.**

| # | 종류 | 예 | 지금 | 반영 |
|---|---|---|---|---|
| 1 | **사실 자산** | "KCST 주최는 대한민국고객만족평가원" | `product_proofs` (수동 입력) | **승인 필수** |
| 2 | **규정** | "'저렴한' 금지", "금액 공개 가능" | 코드 하드코딩 + CLAUDE.md | **승인 필수** |
| 3 | **브리프 레시피** | 잘 먹히는 브리프 템플릿 v3 | 없음 | 승인 후 기본값 |
| 4 | **골든 세트** | 실제로 게시해서 잘 된 원고 | `copy_selections`(개인) | 별표만 누르면 됨 |
| 5 | **편집 신호** | 사람이 매번 지우는 표현 | 개인 `user_copy_preferences` | 집계 → **후보로 제안** |
| 6 | **주제 이력** | 이미 쓴 주제·성과 | 없음 | 자동 |

**1·2 는 절대 자동 반영하지 않는다.** 규정이 2026-08-14 → 08-20 로 두 번 뒤집힌 이력이 있고,
그때마다 "이전 판을 따르지 말 것"을 사람이 명시해야 했다. 자동 학습이 손대면 아무도 어느 판이
맞는지 모르게 된다. 대신 **발효일·근거·작성자를 남긴다.**

### 4-2. 발전 루프

```
브리프(규정 N + 골든 2편 + 사실 K개)
   → 외부 AI → 반입 → 검문소 → 사람이 편집 → 채택(복사·게시)
   → 신호 저장: 생성문 ↔ 최종문 diff · 별표 · 검문소에서 걸린 항목
   → 집계: 자주 지워지는 표현 = 금지 후보 / 자주 추가되는 표현 = 권장 후보 / 별표 = 골든
   → 관리자 승인 → content_rules · 골든 세트 갱신
   → 다음 브리프가 달라진다
```

**여러 사람이 쓸수록 좋아지는 지점은 딱 두 곳이다** — 골든 예시가 늘고, 규칙 후보의 표본이 는다.
나머지(사실·규정)는 사람 수와 무관하게 관리자 작업량이다. 기대치를 여기에 맞춰 잡는 게 맞다.

### 4-3. 스키마 초안

기존 6개 테이블(`users` `studio_state` `products` `product_proofs` `copy_selections` `user_copy_preferences`)은 **건드리지 않는다.** 위에 얹는다.

```sql
-- 007: 팀
create table teams (id uuid primary key, name text not null);
alter table users add column team_id uuid references teams(id);
alter table users add column role text not null default 'member';  -- member | admin

-- 008: 팀 공유 게시물 (골든 세트의 그릇)
create table team_posts (
  id uuid primary key, team_id uuid not null, author_id uuid not null,
  product_id text, topic text not null, tone text,
  blog text, instagram text, threads text, cards jsonb,   -- [{title, body}]
  source text not null,           -- external_ai | api | rule
  external_model text,            -- 'gpt-5' 등 자기기입
  brief_id uuid, brief_text text, -- 어떤 브리프로 뽑았는지
  is_golden boolean default false, rating smallint,
  visibility text default 'team', -- team | private
  published_at date, created_at timestamptz default now()
);

-- 009: 규정 (코드 하드코딩을 옮긴다)
create table content_rules (
  id uuid primary key, team_id uuid not null,
  kind text not null,             -- banned | risky | required | guide
  scope text not null default 'global', product_id text, channel text,
  pattern text not null, reason text not null,
  status text not null default 'proposed',   -- proposed | active | retired
  effective_from date, supersedes uuid,      -- 뒤집힌 이력을 잇는다
  created_by uuid, approved_by uuid, priority smallint default 50
);

-- 010: 사실 제보 큐 (8-18 ③ 의 해결)
create table proof_suggestions (
  id uuid primary key, product_id text not null, content_type text not null,
  content text not null, source_url text, note text,
  status text default 'proposed', created_by uuid, reviewed_by uuid
);
-- 승인되면 product_proofs 로 복사하는 RPC 하나.

-- 011: 브리프 템플릿
create table brief_templates (
  id uuid primary key, team_id uuid, name text, version int,
  body text not null, status text default 'draft', created_by uuid
);

-- 012: 규칙 후보 (편집 diff 집계 결과)
create table rule_candidates (
  id uuid primary key, team_id uuid, kind text, pattern text,
  evidence_count int default 0, sample_ids uuid[], status text default 'proposed'
);
```

**RLS 원칙 세 줄.**
- 읽기: 같은 팀 + `status='approved'` 인 사용자면 팀 자산 전부 읽는다.
- 쓰기: 자기 행만. 규정·사실은 누구나 `proposed` 로만 넣는다.
- 승인: `status` 를 `active` 로 바꾸는 건 **`security definer` RPC 안에서 admin 만.** 테이블 직접 update 정책은 안 연다.

---

## 5. 화면 — 단계를 늘리지 않는다

8-27 에서 「스타일 수집」을 단계에서 설정으로 뺀 이유가 그대로 적용된다.
게시물마다 반복하지 않는 일은 단계로 세우면 흐름을 막는 것처럼 보인다.

| 위치 | 무엇 | 성격 |
|---|---|---|
| 2단계 탭 ① | 브리프 만들기·복사 | 게시물마다 |
| 2단계 탭 ② | 원고 가져오기·검문소 | 게시물마다 |
| 2단계 기존 | 채널 탭·편집·미리보기 | 그대로 |
| 헤더 메뉴 | 팀 자료실(골든·규정·사실 제보) | 가끔 |
| 헤더 메뉴 | 관리자 승인함 (admin 만 보임) | 가끔 |

`STEPS` 배열은 안 바꾼다. `store.js` 에 추가되는 상태는 `imported`(원문·파싱결과·검문결과) 하나,
`sources` 에 `'import'` 값 하나.

---

## 6. 구현 순서

각 단계가 **혼자서 쓸모 있는 상태**로 끝나게 자른다. Phase 1 만 해도 오늘 흐름이 돌아간다.

### Phase 1 — 외부 AI 왕복 (Supabase 무변경)
`lib/brief.js` `lib/importer.js` 신설 · `pages/copy.js` 에 탭 2개 · 검문소 UI.
**검증:** 상품 1개로 브리프 복사 → 외부 AI → 붙여넣기 → 4채널 채워짐 → 3단계 카드 6장이 그대로 나옴.
숫자 대조가 팩트에 없는 수치를 실제로 잡는지 원고 1편으로 확인.

### Phase 2 — 팀 공유 (007 · 008 · 011)
팀 자료실 화면. 채택한 게시물 저장 + 별표. 브리프에 **골든 2편 자동 주입**.
**검증:** 계정 2개로 로그인해 A 가 저장한 골든이 B 의 브리프에 들어가는지. 남의 `private` 은 안 보이는지.

### Phase 3 — 규정·사실을 DB 로 (009 · 010)
`data/banned-phrases.js` → `content_rules` 로 이관(코드는 폴백 상수로 남김).
제보 폼 + 관리자 승인함.
**검증:** 규정 1건을 화면에서 추가 → 코드 수정 없이 검문소가 잡는지. `effective_from` 이 지난 규정만 적용되는지.

### Phase 4 — 자동 학습 (012)
생성문 ↔ 최종문 diff 집계 → `rule_candidates` → 승인함에 뜬다.
**검증:** 같은 표현을 3번 지운 뒤 후보로 올라오는지.

> ⚠️ Phase 3 이 Phase 2 보다 먼저 필요해질 수 있다. **규정이 또 뒤집히면** 그때가 신호다.

---

## 7. 리스크

| 리스크 | 대비 |
|---|---|
| 외부 AI 가 없는 사실을 지어낸다 | 검문소 숫자 대조 · 자동 삭제 금지 · 사람이 판정 |
| 브리프가 계속 길어져 8-18 ② 재발 | 규정 N개 · 예시 2편 · 팩트 K개 상한. 브리프 글자 수를 화면에 표시 |
| 파싱 실패 | 3단 폴백(구분자 → 휴리스틱 → 전문 블로그행) |
| 사람마다 규칙을 다르게 넣는다 | 제안은 자유, 승인은 admin 1인 |
| RLS 실수로 남의 글이 보인다 | 계정 2개 교차 확인을 각 Phase 검증에 고정 |
| `localStorage` 용량 | 반입 원문은 길다. 팀 자산은 DB 로, 로컬엔 현재 게시물만 |
| 규정 이력이 다시 뒤엉킨다 | `supersedes` + `effective_from` + `reason` 필수. 이력이 곧 근거다 |

---

## 8. 요청자 결정이 필요한 것

1. **배포.** 지금은 "배포하지 않는다 · 각자 로컬 실행"(2026-08-10 결정)이다.
   여러 사람이 쓰려면 이게 가장 큰 마찰이다(비개발자가 git clone + 서버 실행). `vercel.json` 은 이미 있다.
2. **왕복 횟수.** 브리프 1개로 4종을 한 번에(권장) vs 블로그 먼저 받고 파생을 따로.
3. **공유 기본값.** 저장 시 팀 공개가 기본(권장) vs 개인 비공개가 기본.
4. **승인자.** admin 은 요청자 1인인가.
5. **앱 내 AI 경로.** 유지(권장 · 폴백) vs 제거(코드 단순화).
