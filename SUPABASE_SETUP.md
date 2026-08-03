# 구글 로그인 · 기기 간 이어서 작업 — 설치 안내

작업 내용을 계정에 붙여 두고 **집 PC 에서 쓴 걸 회사 PC 에서 이어서** 보기 위한 설정이다.
전부 무료이고, 한 번만 하면 된다. **10분** 정도 걸린다.

> ⚠️ 설정하기 전에도 앱은 지금처럼 완전히 동작한다.
> 설정을 안 하면 로그인 버튼이 아예 나오지 않고, 데이터는 예전처럼 브라우저에만 남는다.

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

## 3. 구글 로그인 켜기

**Authentication → Sign In / Providers → Google** 을 켠다.

거기 적힌 **Callback URL** 을 복사해서 구글 쪽에 등록해야 한다.

1. <https://console.cloud.google.com> → 프로젝트 만들기
2. **API 및 서비스 → OAuth 동의 화면** — 외부, 앱 이름만 넣고 저장
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 웹 애플리케이션**
4. **승인된 리디렉션 URI** 에 2번에서 복사한 Supabase Callback URL 을 붙여넣는다
5. 발급된 **클라이언트 ID / 보안 비밀** 을 Supabase 의 Google 설정에 넣고 저장

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

## 어떻게 동작하나

- 오른쪽 위 **「구글 로그인」** 을 누르면 구글 화면으로 갔다가 돌아온다
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
