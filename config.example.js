/**
 * 로컬 설정 템플릿 — 이 파일을 복사해 `config.local.js` 로 만들어 쓴다.
 *
 *   copy config.example.js config.local.js      (Windows)
 *   cp   config.example.js config.local.js      (Mac / Linux)
 *
 * `config.local.js` 는 `.gitignore` 에 들어 있어 **커밋되지 않는다.**
 * 이 파일(config.example.js)에는 절대 실제 키를 적지 말 것 — 이쪽은 커밋된다.
 *
 * ⚠️ 이 저장소는 Public 이다. 키가 한 번이라도 올라가면 봇이 수 분 안에 긁어가고
 *    요금은 키 주인이 문다. 올렸다면 즉시 OpenAI 대시보드에서 그 키를 폐기(revoke)할 것.
 *    — 지우고 다시 커밋해도 소용없다. 히스토리에 남는다.
 *
 * 값을 비워 두면 앱은 예전처럼 화면에서 키를 입력받는다. 둘 다 정상 동작이다.
 */
export default {
  /** OpenAI 키. 글귀(2단계)와 이미지(3단계)가 같은 키 하나를 쓴다. */
  openaiKey: '',

  /** Gemini 키. 안 쓰면 비워 둔다. */
  geminiKey: '',

  /**
   * 제공자·모델 고정 (선택).
   * 비워 두면 화면에서 고른 값을 쓴다. 적어 두면 그 값으로 시작한다.
   *
   * 글귀는 Terra 이상만 쓴다 — 블로그 형식 지시가 촘촘해서 저가 모델은 검수에 걸려
   * 재시도가 늘고, 그러면 가격 이점도 함께 사라진다 (CLAUDE.md 8-7).
   */
  textProvider: 'openai',
  textModel: 'gpt-5.6-terra',
};
