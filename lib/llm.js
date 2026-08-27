/**
 * App Router용 텍스트 생성 클라이언트.
 * OpenAI 키는 브라우저에서 다루지 않고 `/api/text`의 서버 환경 변수만 사용한다.
 */
import { generateText as generateTextOnServer } from './serverapi.js';

export const generateText = (prompt, opts = {}) =>
  generateTextOnServer(prompt, opts);
