/**
 * "이 내용은 확인된 상품 사실에 없습니다" — AI가 정직하게 쓴 이 문장을 게시글에서 걸러낸다.
 *
 * `lib/copyai.js`의 CHANNEL_SYSTEM_V1은 "없는 숫자·날짜·조건·혜택·기관명은 만들지 않습니다"라고만
 * 시킨다. 주제가 자료에 없는 세부 내용을 요구하면 모델은 그 말을 지키려고 정직하게
 * "~은 확인된 상품 사실에 포함되어 있지 않습니다" 같은 문장을 쓰는데, `validateDraft()`는 이런
 * 문장을 금지 표현·근거 없는 단정으로 보지 않아 그대로 통과시킨다. 그 결과 게시글 한복판에
 * 안내문 같은 문장이 박힌 채 "생성 완료"로 보인다(요청자 제보, 2026-09-02).
 *
 * 이 문장을 재시도로 없앨 수는 없다 — 정말 자료에 없는 것이라 모델을 다시 돌려도 같은
 * 결론을 낸다. 그래서 여기서는 재시도 대신 즉시 멈추고(`MissingDataError`), 호출한 화면이
 * 사용자에게 데이터를 보완하거나 생성을 취소할지 묻는다(app/text/page.jsx의 모달).
 *
 * 사용자가 입력한 보완 데이터는 **이번 생성 1회에만** 쓴다(요청자 결정 2026-09-02) — 상품
 * 자료(products/product_proofs)에 자동으로 반영하지 않는다. 콘텐츠 사실성 원칙(CLAUDE.md 4절)이
 * 요구하는 "출처는 공식 제안서·브로셔"를 건너뛰지 않기 위해서다. 대신 Supabase
 * `missing_data_reports`에 기록해 담당자가 나중에 검토·반영할 수 있게 한다.
 */
import { getClient } from "./supabase.js";
import { getUser } from "./auth.js";

/** 문장 끝맺음 — 정직한 "없습니다" 단정은 항상 이런 어미로 문장을 맺는다. */
const ENDING = "(?:습니다|어요|아요|네요|에요)";

/**
 * 문장 **끝**에서만 매칭한다. 문장 중간에 "자료에 없는 개인정보는 요구하지 않습니다" 같은
 * 무관한 문장이 걸리지 않도록, 항상 "…없습니다/…확인되지 않습니다"로 문장이 끝나야 잡는다.
 */
const TRIGGERS = [
  new RegExp(
    `(?:확인된\\s*상품\\s*사실|제공된\\s*(?:확인된\\s*)?상품\\s*(?:사실|자료)|상품\\s*자료)(?:에는?)?\\s*` +
      `(?:포함되어\\s*있지\\s*않${ENDING}|포함돼\\s*있지\\s*않${ENDING}|없${ENDING})$`,
  ),
  new RegExp(
    `(?:해당\\s*)?(?:정보|내용|데이터|자료)(?:가|는|이)?\\s*` +
      `(?:확인되지\\s*않${ENDING}|명시되어\\s*있지\\s*않${ENDING}|없${ENDING})$`,
  ),
  new RegExp(`확인할\\s*수\\s*없${ENDING}$`),
];

/** 8-3(CLAUDE.md)의 "한 문장 = 한 줄" 규칙 덕에 줄바꿈만으로도 대개 문장이 갈린다. 혹시 한
 *  줄에 여러 문장이 붙어 있으면 종결 어미 뒤 공백에서 한 번 더 쪼갠다. */
function splitSentences(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const part of trimmed.split(/(?<=[다요죠]\.|[다요죠][?!])\s+(?=\S)/)) {
      const p = part.trim();
      if (p) out.push(p);
    }
  }
  return out;
}

/**
 * @param {string} text
 * @returns {{sentence:string, subject:string}|null} 발견되면 원문 문장과, 그 앞부분에서
 *   뽑아낸 "무엇이 없다는 것인지"(subject). 없으면 null.
 */
export function findMissingDataNotice(text) {
  for (const raw of splitSentences(text)) {
    const sentence = raw.replace(/[.]+$/, "").trim();
    if (!sentence) continue;
    for (const trigger of TRIGGERS) {
      const match = trigger.exec(sentence);
      if (!match) continue;
      let subject = sentence.slice(0, match.index).trim();
      subject = subject
        .replace(/^[-*・◦]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .trim();
      subject = subject.replace(/(?:은|는|이|가|을|를|에는|에서|에|도)$/, "").trim();
      return { sentence: raw.trim(), subject: subject || "요청하신 내용" };
    }
  }
  return null;
}

/** 생성 단계 중 어디서 걸렸는지 + 어느 채널인지를 함께 들고 다니는 에러. */
export class MissingDataError extends Error {
  constructor(notice, meta = {}) {
    super(`데이터 없음: ${notice.subject}`);
    this.name = "MissingDataError";
    this.subject = notice.subject;
    this.sentence = notice.sentence;
    this.stage = meta.stage || "";
    this.channelId = meta.channelId || "";
  }
}

/** 발견되면 즉시 던진다. 재시도 루프 안에서 불러 재시도를 건너뛰게 한다. */
export function assertNoMissingData(text, meta) {
  const notice = findMissingDataNotice(text);
  if (notice) throw new MissingDataError(notice, meta);
}

/**
 * 담당자가 모달에 입력한 보완 정보를 프롬프트에 끼워 넣는다.
 *
 * ⚠️ **이번 생성 1회에만 쓴다.** 상품 자료(factSheet)를 고치지 않고 별도 블록으로만
 *    덧붙인다 — 다음에 같은 상품으로 다시 생성할 때는 이 블록이 비어 있어야 한다.
 *
 * @param {string} extraNote
 * @returns {string} 없으면 빈 문자열
 */
export function missingDataBlock(extraNote) {
  const body = String(extraNote || "").trim();
  if (!body) return "";
  return [
    "■ 담당자가 방금 보완한 정보 — 이번 생성에서만 사실로 사용합니다",
    "아래는 위 상품 자료에 없어 담당자가 방금 직접 입력한 내용입니다. 숫자·조건을 바꾸지 말고",
    "그대로 사실로 반영하세요.",
    body,
    "── 보완 정보 끝 ──",
  ].join("\n");
}

/**
 * 이 알림을 Supabase `missing_data_reports`에 기록한다 — 담당자가 나중에 검토하기 위해서다.
 * 실패해도 화면 흐름은 막지 않는다(부가 기능). 로그인 전이면 저장하지 않는다.
 */
export async function reportMissingData({
  productId,
  topic,
  channelId,
  stage,
  subject,
  sentence,
  userInput,
} = {}) {
  const user = getUser();
  if (!user) return { ok: false, skipped: true };
  const sb = await getClient();
  if (!sb) return { ok: false, skipped: true };
  const { error } = await sb.from("missing_data_reports").insert({
    user_id: user.id,
    product_id: productId || null,
    topic: String(topic || "").slice(0, 500),
    channel_id: channelId || null,
    stage: stage || null,
    subject: String(subject || "").slice(0, 300),
    sentence: String(sentence || "").slice(0, 1000),
    user_input: userInput ? String(userInput).slice(0, 2000) : null,
  });
  if (error) {
    console.warn("[missing-data] 보고 저장 실패", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
