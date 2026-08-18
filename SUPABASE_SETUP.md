# 이메일 로그인 · 관리자 승인 · 기기 간 이어서 작업 — 설치 안내

## 상품 데이터 이전

상품 기준 정보와 생성 설정은 `products`, 유형별 AI 참고 문장은 `product_proofs`에 나누어 저장합니다.

Supabase **SQL Editor**에서 다음 파일을 순서대로 실행합니다.

1. `supabase/003_create_products.sql`
2. `supabase/004_move_all_products_to_supabase.sql`
3. `supabase/005_create_copy_selections.sql`
4. `supabase/006_create_user_copy_preferences.sql`

이미 `003`과 `004`를 실행했다면 새 기능을 위해 `005`, `006`만 추가로 실행하면 됩니다. `004`는 `prompt_settings` 열을 추가하고 기존
4개 상품과 생성 자료를 한 번에 저장합니다. 이후 상품/근거 수정은 Supabase Table Editor에서
합니다. `product_proofs.is_active`를 끄면 다음 AI 생성부터 해당 묶음을 제외할 수 있습니다.

작업 내용을 계정에 붙여 두고 **집 PC 에서 쓴 걸 회사 PC 에서 이어서** 보기 위한 설정이다.
전부 무료이고, 한 번만 하면 된다. **10분** 정도 걸린다.

> ⚠️ 상품 원본은 Supabase에서 불러오므로 `003`과 `004`가 모두 적용되어 있어야 한다.

---

## 1. Supabase 프로젝트 만들기

1. <https://supabase.com> 에서 가입 (깃허브 계정으로 하면 빠르다)
2. **New project** — 이름은 아무거나, 리전은 `Northeast Asia (Seoul)`
3. 데이터베이스 비밀번호는 아무거나 정하고 **어딘가 적어 둔다** (앱에서는 안 쓴다)
4. 만들어지는 데 1~2분 걸린다

## 2. 표 만들기

왼쪽 메뉴 **SQL Editor** → **New query** → 아래를 통째로 붙여넣고 **Run**.

```sql
-- 계정 하나당 한 줄. 작업 내용은 통째로 jsonb 에 담는다.
create table if not exists public.studio_state (
  user_id    uuid primary key references auth.users on delete cascade,
  state      jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 행 수준 보안 — 이걸 켜야 남의 줄을 못 본다. 이게 실제 보호막이다.
alter table public.studio_state enable row level security;

create policy "본인 줄만 조회" on public.studio_state
  for select using (auth.uid() = user_id);

create policy "본인 줄만 추가" on public.studio_state
  for insert with check (auth.uid() = user_id);

create policy "본인 줄만 수정" on public.studio_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 3. 이메일 로그인 설정

**Authentication → Sign In / Providers → Email** 에서 이메일 로그인을 켠다.

관리자 승인은 `public.users.status`로 별도 관리하므로 **Confirm email은 끈다.** 그러면 신규
가입자는 이메일 링크 확인 없이 Auth 로그인이 가능하고, 앱은 `status = 'approved'`인 경우에만
접근을 허용한다.

이미 Confirm email이 켜진 상태에서 가입한 사용자는 **Authentication → Users**에서 해당 사용자의
이메일을 한 번 Confirm 처리해야 한다. 이메일 미확인과 관리자 승인 대기는 서로 다른 상태다.

## 4. 돌아올 주소 등록

**Authentication → URL Configuration**

| 항목 | 값 |
|---|---|
| Site URL | `http://localhost:5610` |
| Redirect URLs | `http://localhost:5610` |

> ⚠️ 나중에 도메인에 올리면 그 주소도 **여기에 추가**해야 한다.
> 등록 안 된 주소로 돌아오면 로그인이 조용히 실패한다.

## 5. 앱에 값 넣기

**Project Settings → API** 에서 두 값을 복사해 `lib/supabase.js` 위쪽에 넣는다.

```js
export const SUPABASE = {
  url: 'https://xxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```

- `anon public` 키는 **비밀이 아니다.** 클라이언트에 심으라고 만든 공개 키이고,
  실제 보호는 2번에서 켠 RLS 가 한다.
- ⚠️ **`service_role` 키는 절대 넣지 말 것.** 그건 모든 권한을 가진 진짜 비밀키다.

저장하고 브라우저에서 `Ctrl + Shift + R`.

---

## 관계자를 새로 붙일 때 (온보딩)

앱은 **승인된 계정만** 들어간다. 가입만으로는 못 쓴다. 순서는 이렇다.

### 1) 쓸 사람이 하는 것

1. 저장소를 받는다 (Private 이라 GitHub 로그인이 필요하다)

   ```bash
   gh repo clone yuki010726-eng/brand-sns-studio
   ```

2. `serve.cmd` 를 더블클릭하고 <http://localhost:5610> 로 들어간다
3. **회원가입** 탭에서 아이디·이름·비밀번호를 넣는다
   (아이디만 넣으면 된다. 뒤에 `@openxgroup.co.kr` 은 앱이 붙인다)
4. "관리자 확인 중" 화면이 뜬다. 여기서 멈춘다 — 4)까지 끝나야 들어갈 수 있다

### 2) 관리자가 승인하는 곳

**승인 화면은 앱 안에 없다.** Supabase 대시보드에서 직접 바꾼다.

**Table Editor → `users` 표 → 그 사람 줄 → `status` 를 `pending` → `approved`**

`rejected` 로 두면 "가입이 승인되지 않았습니다" 가 뜬다. 계정을 지우려면 그 줄이 아니라
**Authentication → Users** 에서 지운다 (`users` 표는 따라서 지워진다).

### 3) 쓸 사람이 다시

승인 후 "상태 다시 확인" 을 누르거나 새로고침하면 들어가진다.

### 4) API 키는 각자 발급

앱은 로그인만으로는 AI 글쓰기를 못 한다. **각자 자기 OpenAI 키를 넣어야 한다.**

2단계 「AI 켜기」 → 입력칸 아래 **「OpenAI API 키 발급」** 링크 → 키 발급 → 붙여넣고 저장.
글귀와 이미지가 **같은 키 하나**를 쓴다.

> ⚠️ **요금은 키 주인이 낸다.** 사람마다 자기 OpenAI 계정에 크레딧을 충전해야 하고,
> 사용료도 각자 나간다. 각자 OpenAI 대시보드의 **Usage limits** 로 월 상한을 걸어 두면 좋다.
> 게시물 1건에 약 $0.08(Terra 기준, 약 107원)이다.

---

## 어떻게 동작하나

- 아이디와 비밀번호로 로그인하며, 관리자가 `public.users.status`를 `approved`로 바꾼 계정만 접근한다
- 로그인하면 **서버에 저장된 작업을 한 번 불러온다** ("다른 기기에서 저장한 작업을 불러왔습니다")
- 이후 상태가 바뀔 때마다 **1.5초 모아서 자동 저장**한다 (타이핑 한 글자마다 올리지 않는다)
- 로그아웃해도 **이 기기에 저장된 내용은 그대로** 남는다

### 동기화되는 것 / 안 되는 것

| | |
|---|---|
| ✅ | 프로필, 상품·주제·톤, 카드 장수, 블로그·인스타·쓰레드 글귀, 카드 문구, 템플릿·색·심볼 설정, 보관함 |
| ❌ | **카드 배경 이미지** — 게시물 하나에 6장 × 약 1MB 라 무료 용량을 금방 쓴다. 기기에 남는다 |
| ❌ | **API 키** — 브라우저에만 둔다. 기기마다 따로 넣어야 한다 |

이미지까지 옮기려면 Supabase Storage 를 붙여야 한다. 별도 작업이다.

### 충돌은 어떻게 되나

**마지막 저장이 이긴다.** 두 기기에서 동시에 고치는 일은 드물고, 자동 병합은 글을 뒤섞어
더 나쁜 결과를 만든다. 기기를 옮길 때는 **이전 기기에서 편집을 끝내고 넘어가는 것**을 권한다.
