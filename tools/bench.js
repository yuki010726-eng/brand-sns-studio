/**
 * 모델 비교 벤치마크 — 어느 모델이 최소 사양인지 숫자로 정한다
 *
 * 왜 필요한가
 * Terra 와 Sol 의 단가가 2.5배 차이라 감으로 고를 수 없다. 그런데 이 앱에는 이미
 * **객관적인 판정 장치**가 있다 — `validateDraft()` 가 금지 표현·근거 없는 단정·주제 이탈을
 * 잡아낸다. 같은 주제를 모델별로 여러 번 돌려 **반려율**을 재면 답이 나온다.
 *
 * ⚠️ 싼 모델이 정말 싼 게 아니다. 반려되면 최대 3회까지 다시 부르므로 비용도 같이 늘어난다.
 *    그래서 '1회 통과율'이 아니라 **세트당 실제 호출 수와 실제 지불액**을 함께 잰다.
 *
 * ⚠️ 생성 로직을 복제하지 않는다. `generateWithAI()` 를 그대로 부르고 `onAttempt` 로 관측만 한다.
 *    벤치마크가 실제 경로와 달라지는 순간 측정값이 의미를 잃는다.
 *
 * ⚠️ **이 도구는 실제 요금을 씁니다.** 돌리기 전에 예상 비용을 보여주고 확인을 받는다.
 */
import { PRODUCTS, CHANNELS } from '../data/products.js';
import { generateWithAI } from '../lib/copyai.js';
import { TEXT_MODELS, getTextModel, setTextModel, hasKey, maskedKey } from '../lib/openai.js';

/**
 * 1M 토큰당 단가 (2026-08 공식 가격표).
 * ⚠️ 고를 수 있는 모델은 `TEXT_MODELS` 가 정한다 — Luna 를 없앴으므로 여기에도 없다.
 */
const PRICES = {
  'gpt-5.6-terra': { in: 2, out: 12 },
  'gpt-5.6-sol': { in: 5, out: 30 },
};

/** 실제 사용량을 못 받았을 때만 쓰는 어림값. 한글 1자를 1토큰으로 넉넉히 본다. */
const CHARS_PER_TOKEN = 1;

const PROVIDER_STORE = 'bboggl.text-provider';
const KRW = 1400;

const DEFAULT_TOPICS = [
  '브랜드어워즈 수상이 실제로 도움이 되는지',
  '수상 이력을 광고에 활용하는 방법',
];

const $ = (sel) => document.querySelector(sel);
const esc = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let running = false;
let abort = null;
/** @type {Array<object>} 시도 한 건 = 한 행 */
let rows = [];

/* ---------------- 화면 ---------------- */

function init() {
  $('#models').innerHTML = TEXT_MODELS.map((m) => `
    <label class="opt">
      <input type="checkbox" name="model" value="${m.id}" checked autocomplete="off" />
      <span><strong>${esc(m.label)}</strong><br /><span class="dim">${esc(m.note)}</span></span>
    </label>`).join('');

  $('#channels').innerHTML = CHANNELS.map((c) => `
    <label class="opt opt--inline">
      <input type="checkbox" name="channel" value="${c.id}" checked autocomplete="off" />
      <span>${esc(c.name)}</span>
    </label>`).join('');

  $('#product').innerHTML = PRODUCTS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('#topics').value = DEFAULT_TOPICS.join('\n');

  $('#key-state').innerHTML = hasKey()
    ? `<span class="ok">OpenAI 키 연결됨 · ${esc(maskedKey())}</span>`
    : `<span class="bad">OpenAI 키가 없습니다. 앱의 3단계 「AI 설정」에서 먼저 키를 넣어 주세요.</span>
       <a href="../#/copy">앱으로 이동</a>`;
  $('#run').disabled = !hasKey();

  ['#runs', '#topics', '#product'].forEach((s) => $(s).addEventListener('input', estimate));
  document.addEventListener('change', (e) => { if (e.target.name === 'model' || e.target.name === 'channel') estimate(); });
  $('#run').addEventListener('click', start);
  $('#stop').addEventListener('click', () => abort?.abort());
  $('#copy').addEventListener('click', copyCsv);
  estimate();
}

const picked = (name) => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
const topicList = () => $('#topics').value.split('\n').map((t) => t.trim()).filter(Boolean);

/** 세트 = 주제 1건 × 선택한 채널 전부. 실제 게시물 1건과 같은 단위다. */
function plan() {
  const models = picked('model');
  const channels = picked('channel');
  const topics = topicList();
  const runs = Math.max(1, Number($('#runs').value) || 1);
  return { models, channels, topics, runs, sets: topics.length * runs, calls: models.length * topics.length * runs * channels.length };
}

/**
 * 예상 비용. **최소~최대**로 보여준다 —
 * 최소는 전부 1회 통과, 최대는 전부 3회까지 재시도한 경우다.
 */
function estimate() {
  const { models, channels, topics, runs, calls } = plan();
  if (!models.length || !channels.length || !topics.length) {
    $('#estimate').innerHTML = '<span class="bad">모델·채널·주제를 하나 이상 골라 주세요.</span>';
    $('#run').disabled = true;
    return;
  }

  // 실측 평균: 채널당 입력 약 4,300자(블로그) / 3,000자(그 외), 출력은 채널 상한 근처
  const inChars = { blog: 5000, instagram: 3900, threads: 3800 };
  const outChars = { blog: 2400, instagram: 1300, threads: 500 };
  let lo = 0;
  for (const id of models) {
    const p = PRICES[id];
    if (!p) continue;
    for (const ch of channels) {
      const cost = (inChars[ch] * p.in + outChars[ch] * p.out) / 1e6;
      lo += cost * topics.length * runs;
    }
  }
  const hi = lo * 3;
  $('#estimate').innerHTML = `
    호출 <strong>${calls}회</strong> (재시도 없을 때) ·
    예상 비용 <strong>$${lo.toFixed(3)} ~ $${hi.toFixed(3)}</strong>
    <span class="dim">(약 ${Math.round(lo * KRW).toLocaleString()}~${Math.round(hi * KRW).toLocaleString()}원)</span>
    <br /><span class="dim">최대값은 모든 글이 3회까지 재시도된 최악의 경우입니다.</span>`;
  $('#run').disabled = !hasKey() || running;
}

/* ---------------- 실행 ---------------- */

async function start() {
  const { models, channels, topics, runs, calls } = plan();
  const lo = $('#estimate').textContent.match(/\$[\d.]+/)?.[0] || '';

  if (!confirm(`실제 요금이 청구됩니다.\n\n모델 ${models.length}종 × 주제 ${topics.length}개 × ${runs}회 × 채널 ${channels.length}개\n= 최소 ${calls}회 호출 (최소 ${lo})\n\n진행할까요?`)) return;

  const product = PRODUCTS.find((p) => p.id === $('#product').value) || PRODUCTS[0];
  const tone = $('#tone').value;
  const cardCount = Number($('#cardCount').value) || 6;

  running = true;
  abort = new AbortController();
  rows = [];
  $('#run').disabled = true;
  $('#stop').disabled = false;
  $('#copy').disabled = true;

  // 제공자·모델을 잠시 바꾸므로 끝나면 반드시 되돌린다
  const prevProvider = localStorage.getItem(PROVIDER_STORE);
  const prevModel = getTextModel();
  localStorage.setItem(PROVIDER_STORE, 'openai');

  let done = 0;
  const total = models.length * topics.length * runs;

  try {
    for (const modelId of models) {
      setTextModel(modelId);
      for (const topic of topics) {
        for (let run = 0; run < runs; run++) {
          if (abort.signal.aborted) throw new DOMException('중단', 'AbortError');
          progress(`${modelId} · 「${topic}」 ${run + 1}/${runs} 실행 중… (${done}/${total} 세트 완료)`);
          await runSet({ modelId, product, topic, tone, cardCount, channels, run });
          done++;
          render();
        }
      }
    }
    progress(`완료 — ${done}/${total} 세트`);
  } catch (e) {
    progress(e.name === 'AbortError' ? `중단했습니다 — ${done}/${total} 세트까지 측정` : `오류 — ${e.message}`);
  } finally {
    // 벤치마크가 앱 설정을 바꿔 놓고 끝나면 안 된다
    setTextModel(prevModel);
    if (prevProvider) localStorage.setItem(PROVIDER_STORE, prevProvider);
    else localStorage.removeItem(PROVIDER_STORE);

    running = false;
    abort = null;
    $('#run').disabled = false;
    $('#stop').disabled = true;
    $('#copy').disabled = !rows.length;
    render();
  }
}

/** 세트 하나 = 게시물 1건. 실제 앱과 같이 채널을 동시에 부른다. */
async function runSet({ modelId, product, topic, tone, cardCount, channels, run }) {
  const ctx = { product, topic, tone, variant: 0, cardCount };

  const jobs = channels.map((channelId) => {
    const attempts = [];
    return generateWithAI(channelId, ctx, {
      signal: abort.signal,
      onAttempt: (info) => attempts.push(info),
    })
      .then(() => ({ channelId, attempts, failed: false }))
      .catch((e) => {
        if (e.name === 'AbortError') throw e;
        return { channelId, attempts, failed: true, error: e.message };
      });
  });

  const results = await Promise.all(jobs);
  for (const r of results) {
    for (const a of r.attempts) {
      rows.push({
        model: modelId, topic, run: run + 1, channel: r.channelId,
        attempt: a.attempt + 1,
        passed: !a.problem,
        problem: a.problem || '',
        ms: a.ms,
        ...tokensOf(a),
      });
    }
    // 3회를 다 쓰고도 실패하면 그 세트는 규칙 기반으로 폴백된다 — 표시해 둔다
    if (r.failed) rows.push({ model: modelId, topic, run: run + 1, channel: r.channelId, attempt: 0, passed: false, problem: `[폴백] ${r.error}`, ms: 0, inTok: 0, outTok: 0, reasonTok: 0, exact: false });
  }
}

/** 실제 사용량이 있으면 그것을 쓰고, 없으면 글자 수로 어림한다 */
function tokensOf(a) {
  const u = a.usage || {};
  const inTok = u.input_tokens ?? u.prompt_tokens ?? u.promptTokenCount;
  const outTok = u.output_tokens ?? u.completion_tokens ?? u.candidatesTokenCount;
  const reasonTok = u.output_tokens_details?.reasoning_tokens ?? u.reasoning_tokens ?? 0;
  if (inTok != null && outTok != null) return { inTok, outTok, reasonTok, exact: true };
  return {
    inTok: Math.round(a.promptChars / CHARS_PER_TOKEN),
    outTok: Math.round(a.outputChars / CHARS_PER_TOKEN),
    reasonTok: 0,
    exact: false,
  };
}

const progress = (msg) => { $('#progress').textContent = msg; };

/* ---------------- 결과 ---------------- */

function render() {
  if (!rows.length) { $('#results').innerHTML = ''; return; }

  const models = [...new Set(rows.map((r) => r.model))];
  const setsOf = (m) => new Set(rows.filter((r) => r.model === m).map((r) => `${r.topic}|${r.run}`)).size;

  const summary = models.map((m) => {
    const mine = rows.filter((r) => r.model === m && r.attempt > 0);
    const first = mine.filter((r) => r.attempt === 1);
    const firstPass = first.filter((r) => r.passed).length;
    const fallback = rows.filter((r) => r.model === m && r.attempt === 0).length;
    const sets = setsOf(m) || 1;

    const cost = mine.reduce((sum, r) => {
      const p = PRICES[m];
      return p ? sum + (r.inTok * p.in + r.outTok * p.out) / 1e6 : sum;
    }, 0);
    const exact = mine.length > 0 && mine.every((r) => r.exact);

    return {
      model: m,
      sets,
      calls: mine.length,
      callsPerSet: mine.length / sets,
      firstPass: first.length ? (firstPass / first.length) * 100 : 0,
      fallback,
      avgMs: mine.length ? mine.reduce((s, r) => s + r.ms, 0) / mine.length : 0,
      reasonTok: mine.reduce((s, r) => s + (r.reasonTok || 0), 0) / (mine.length || 1),
      cost, costPerSet: cost / sets, exact,
    };
  });

  /**
   * 추천은 **가격만 보고 정하지 않는다.**
   *
   * 통과율이 낮으면 재시도로 호출이 늘어 비용·시간이 같이 늘고, 3회를 다 쓰고도 실패하면
   * 규칙 기반 글로 떨어져 품질이 무너진다. 싼 모델이 정말 싼 게 아니라는 게 이 도구의 요점이다.
   * 그래서 **품질 기준을 통과한 것 중에서** 가장 싼 것을 고른다.
   */
  const PASS_BAR = 70;   // 1회 통과율(%). 이 아래면 세트당 호출이 눈에 띄게 늘어난다.
  const qualified = summary.filter((s) => s.fallback === 0 && s.firstPass >= PASS_BAR);
  const pick = qualified.length
    ? qualified.reduce((a, b) => (b.costPerSet < a.costPerSet ? b : a))
    : null;
  const cheapest = pick?.costPerSet ?? null;

  const why = {};
  rows.filter((r) => r.problem && r.attempt > 0).forEach((r) => {
    const kind = kindOf(r.problem);
    why[r.model] = why[r.model] || {};
    why[r.model][kind] = (why[r.model][kind] || 0) + 1;
  });

  const name = (id) => id.replace('gpt-5.6-', '');
  const verdict = pick
    ? `<div class="verdict verdict--ok">
         <strong>${esc(name(pick.model))}</strong> 가 최소 사양입니다 —
         1회 통과율 ${pick.firstPass.toFixed(0)}% · 세트당 ${pick.callsPerSet.toFixed(2)}회 호출 ·
         <strong>$${pick.costPerSet.toFixed(4)}</strong>(약 ${Math.round(pick.costPerSet * KRW).toLocaleString()}원).
         <span class="dim">기준: 1회 통과율 ${PASS_BAR}% 이상 · 폴백 0건. 이 조건을 넘긴 것 중 가장 쌉니다.</span>
       </div>`
    : `<div class="verdict verdict--bad">
         <strong>기준(1회 통과율 ${PASS_BAR}% 이상 · 폴백 0건)을 넘긴 모델이 없습니다.</strong>
         <span class="dim">회차를 늘려 표본을 키우거나, 반려 사유를 보고 프롬프트를 손봐야 합니다.
         사유가 「주제 이탈」에 몰려 있으면 모델이 아니라 프롬프트 문제일 수 있습니다.</span>
       </div>`;

  $('#results').innerHTML = `
    <h2>모델별 요약</h2>
    ${verdict}
    ${summary.some((s) => !s.exact) ? '<p class="warn">일부 응답에 사용량이 없어 글자 수로 어림한 값이 섞였습니다. 정확한 값만 볼 때는 「정확」 열이 ✓ 인 행을 보세요.</p>' : ''}
    <div class="scroll"><table>
      <thead><tr>
        <th>모델</th><th>세트</th><th>1회 통과율</th><th>세트당 호출</th>
        <th>폴백</th><th>추론 토큰(평균)</th><th>세트당 비용</th><th>총액</th><th>평균 응답</th><th>정확</th>
      </tr></thead>
      <tbody>${summary.map((s) => `
        <tr class="${s.costPerSet === cheapest ? 'best' : ''}">
          <td><strong>${esc(name(s.model))}</strong>${pick?.model === s.model ? ' <span class="tag">추천</span>' : ''}</td>
          <td>${s.sets}</td>
          <td class="${s.firstPass >= 80 ? 'ok' : s.firstPass >= 50 ? '' : 'bad'}">${s.firstPass.toFixed(0)}%</td>
          <td>${s.callsPerSet.toFixed(2)}회</td>
          <td class="${s.fallback ? 'bad' : ''}">${s.fallback}건</td>
          <td>${Math.round(s.reasonTok)}</td>
          <td><strong>$${s.costPerSet.toFixed(4)}</strong><br /><span class="dim">약 ${Math.round(s.costPerSet * KRW).toLocaleString()}원</span></td>
          <td>$${s.cost.toFixed(3)}</td>
          <td>${(s.avgMs / 1000).toFixed(1)}초</td>
          <td>${s.exact ? '✓' : '—'}</td>
        </tr>`).join('')}</tbody>
    </table></div>

    <h2>반려 사유</h2>
    ${Object.keys(why).length ? `<div class="scroll"><table>
      <thead><tr><th>모델</th><th>주제 이탈</th><th>금지 표현</th><th>근거 없는 단정</th><th>너무 짧음</th></tr></thead>
      <tbody>${models.map((m) => `<tr>
        <td><strong>${esc(m.replace('gpt-5.6-', ''))}</strong></td>
        <td>${why[m]?.['주제 이탈'] || 0}</td><td>${why[m]?.['금지 표현'] || 0}</td>
        <td>${why[m]?.['근거 없는 단정'] || 0}</td><td>${why[m]?.['너무 짧음'] || 0}</td>
      </tr>`).join('')}</tbody></table></div>` : '<p class="dim">반려된 글이 없습니다.</p>'}

    <h2>채널별 1회 통과율</h2>
    <div class="scroll"><table>
      <thead><tr><th>모델</th>${CHANNELS.map((c) => `<th>${esc(c.name)}</th>`).join('')}</tr></thead>
      <tbody>${models.map((m) => `<tr><td><strong>${esc(m.replace('gpt-5.6-', ''))}</strong></td>${CHANNELS.map((c) => {
        const f = rows.filter((r) => r.model === m && r.channel === c.id && r.attempt === 1);
        if (!f.length) return '<td class="dim">—</td>';
        const rate = (f.filter((r) => r.passed).length / f.length) * 100;
        return `<td class="${rate >= 80 ? 'ok' : rate >= 50 ? '' : 'bad'}">${rate.toFixed(0)}%</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table></div>

    <h2>전체 기록 <span class="dim">(${rows.length}행)</span></h2>
    <div class="scroll scroll--tall"><table class="small">
      <thead><tr><th>모델</th><th>주제</th><th>회차</th><th>채널</th><th>시도</th><th>결과</th><th>입력</th><th>출력</th><th>추론</th><th>ms</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${esc(r.model.replace('gpt-5.6-', ''))}</td><td>${esc(r.topic.slice(0, 14))}</td>
        <td>${r.run}</td><td>${esc(r.channel)}</td><td>${r.attempt || '—'}</td>
        <td class="${r.passed ? 'ok' : 'bad'}">${r.passed ? '통과' : esc(r.problem.slice(0, 40))}</td>
        <td>${r.inTok}</td><td>${r.outTok}</td><td>${r.reasonTok || 0}</td><td>${r.ms}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

/** 반려 사유 문장을 종류로 묶는다 (`validateDraft` 가 돌려주는 문구 기준) */
function kindOf(problem) {
  if (problem.includes('주제')) return '주제 이탈';
  if (problem.includes('금지 표현')) return '금지 표현';
  if (problem.includes('단정')) return '근거 없는 단정';
  if (problem.includes('짧')) return '너무 짧음';
  return '기타';
}

async function copyCsv() {
  const head = ['model', 'topic', 'run', 'channel', 'attempt', 'passed', 'problem', 'inTok', 'outTok', 'reasonTok', 'ms', 'exact'];
  const csv = [head.join(',')]
    .concat(rows.map((r) => head.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(',')))
    .join('\n');
  try {
    await navigator.clipboard.writeText(csv);
    progress('CSV 를 복사했습니다.');
  } catch {
    progress('복사에 실패했습니다. 표를 직접 선택해 복사해 주세요.');
  }
}

init();
