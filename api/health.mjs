/**
 * 서버가 살아 있고 키가 꽂혀 있는지 알려준다.
 *
 * 클라이언트(`lib/serverapi.js`)가 시작할 때 한 번 불러 **서버 모드 / 로컬 모드**를 정한다.
 * 배포본에서는 200 이 오고, 로컬(`python -m http.server`)에서는 404 가 온다 —
 * 그 차이로 판단한다. 그래서 이 응답에는 **로그인이 필요 없다.** 로그인 화면을 그리기 전에 부른다.
 *
 * 노출되는 건 '키가 설정돼 있는지'(true/false)뿐이다. 키 자체는 절대 내보내지 않는다.
 */
import { DEFAULT_TEXT_MODEL } from './_shared.mjs';

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    providers: {
      openai: Boolean(process.env.OPENAI_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
    },
    textModel: DEFAULT_TEXT_MODEL,
    auth: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
  });
}
