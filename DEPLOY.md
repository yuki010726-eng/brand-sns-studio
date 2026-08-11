# 배포 (Vercel) — PART 2

> ⚠️ **지금은 개인 키 방식을 쓴다 (2026-08-10 결정).** 아래의 서버 프록시(`api/`)는
> 코드만 남아 있고 앱이 부르지 않는다. 되돌릴 때를 위한 문서다.
>
> **지금 배포할 때는 `OPENAI_API_KEY` · `GEMINI_API_KEY` 를 넣지 않는다.** 넣지 않으면
> `/api/text` 는 503 만 돌려주므로 열려 있어도 요금이 나가지 않는다.
> 필요한 것은 앱을 인터넷에 올리는 것과 Supabase 주소 등록(3단계)뿐이다.
>
> 사용자는 각자 앱 화면에서 자기 키를 넣는다.

아래는 **공용 키를 서버에 두는 방식**으로 되돌릴 때의 절차다.

여기까지 오면 달라지는 것:

| | 지금까지 (로컬) | 배포 후 |
|---|---|---|
| API 키 | 각자 브라우저 localStorage | **Vercel 환경 변수(서버)만** |
| 키 입력칸 | 화면에 있음 | 자동으로 사라짐 |
| 누가 쓰나 | 키를 넣은 사람 | **승인된 계정으로 로그인한 사람** |
| 요금 | 각자 부담 | 서버 키 소유자가 부담 |

앱은 **두 모드를 모두 지원한다.** 시작할 때 `/api/health` 를 한 번 찔러 보고 정한다.
그래서 배포 후에도 로컬에서 `python -m http.server` 로 예전처럼 쓸 수 있다.

---

## 1. Vercel 계정 만들고 저장소 연결

> ⚠️ 이 단계는 **직접 하셔야 한다.** 계정 생성과 비밀값 입력은 대신 해 줄 수 없다.

1. https://vercel.com 에서 **GitHub 계정으로 가입**한다.
2. **Add New… → Project** → `yuki010726-eng/brand-sns-studio` 를 **Import**.
3. 설정 화면에서 아무것도 바꾸지 않는다. `vercel.json` 이 이미 다음을 정해 두었다.
   - Framework: 없음 · Build Command: 없음 · Output Directory: `.`
   - 이 저장소에는 **빌드 도구가 없다.** 정적 파일을 그대로 올리고 `api/` 만 함수로 돌린다.
4. **Deploy** 를 누른다. 1분 안에 `브랜드-sns-studio-xxxx.vercel.app` 같은 주소가 나온다.

이 시점에는 로그인이 안 된다. 2·3단계를 마쳐야 한다.

---

## 2. 환경 변수 넣기

Vercel 프로젝트 → **Settings → Environment Variables** 에서 넣는다.
넣은 뒤에는 **Deployments → 맨 위 항목 → Redeploy** 를 해야 반영된다.

| 이름 | 값 | 필수 |
|---|---|---|
| `OPENAI_API_KEY` | platform.openai.com 에서 발급한 키 (`sk-…`) | 글귀·이미지에 필요 |
| `SUPABASE_URL` | `https://zinwsmsrngiapthrbkme.supabase.co` | **필수** |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon public` | **필수** |
| `GEMINI_API_KEY` | Gemini 를 쓸 때만 (`AIza…`) | 선택 |
| `TEXT_MODEL` | 비워 두면 `gpt-5.6-terra` | 선택 |

환경은 **Production·Preview·Development 를 모두 체크**한다.

> ⚠️ **`service_role` 키는 넣지 않는다.** 서버는 호출자의 토큰으로 Supabase 에 되물어
> 승인 여부를 확인한다. 만능 키가 서버에 없으므로 사고가 나도 피해가 훨씬 작다.

> ⚠️ 키를 Vercel 화면에 붙여넣는 것 외에 **어디에도 적지 않는다.** 저장소·메모·채팅에 남기지 않는다.
> `.gitignore` 가 `.env` 를 막고 있지만, 애초에 파일로 만들 일이 없다.

---

## 3. Supabase 에 새 주소 등록

이걸 빼먹으면 **로그인이 조용히 실패한다.** 눌러도 아무 일이 안 일어난 것처럼 보인다.

Supabase → **Authentication → URL Configuration**

- **Site URL**: `https://<배포주소>`
- **Redirect URLs**: `https://<배포주소>/**` 를 추가
  (기존 `http://localhost:5610/**` 도 그대로 둔다 — 로컬에서도 계속 쓴다)

---

## 4. 확인

배포 주소로 들어가 순서대로 본다.

1. `https://<배포주소>/api/health` 를 주소창에 직접 연다.
   `{"ok":true,"providers":{"openai":true,…},"auth":true}` 가 나와야 한다.
   - `providers.openai` 가 `false` → `OPENAI_API_KEY` 가 안 들어갔거나 Redeploy 를 안 했다.
   - `auth` 가 `false` → Supabase 두 값이 안 들어갔다.
2. 앱에 로그인한다. 승인된 계정이어야 한다.
3. 3단계로 간다. **「API 키」 입력칸이 사라지고 "서버에서 처리합니다" 라고 떠야 한다.**
4. 글이 실제로 생성되는지 본다.

### 관문이 실제로 잠겼는지

로그인하지 않은 상태에서 이게 **401** 을 돌려줘야 한다. 200 이 나오면 안 된다.

```bash
curl -X POST https://<배포주소>/api/text -H "Content-Type: application/json" -d "{\"prompt\":\"test\"}"
```

기대 응답: `{"error":"로그인이 필요합니다."}`

---

## 남은 것 — 사용량 상한

지금 막아 둔 것은 **누가 쓰는가**(승인된 계정)와 **한 번에 얼마나 쓰는가**
(프롬프트 24,000자 · 출력 6,000토큰 · 모델 허용 목록)다.

아직 없는 것은 **하루에 몇 번까지**다. 승인된 사람이 실수로든 고의로든 반복해서 부르면
그만큼 요금이 나간다. 쓰는 사람이 소수이고 서로 아는 사이라면 당장은 괜찮지만,
인원이 늘면 Supabase 에 사용량 테이블을 두고 **계정별 하루 상한**을 거는 편이 안전하다.

그 전까지는 OpenAI 대시보드에서 **월 사용 한도(Usage limits)** 를 걸어 두면
최악의 경우에도 손실이 그 금액에서 멈춘다.
