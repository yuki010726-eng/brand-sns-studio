import { BANNED_PHRASES } from '../data/banned-phrases.js';
import { findRisky } from './copyai.js';
import { findBanned } from './copywriter.js';

const NUMBER_CLAIM_RE = /(?:\d[\d,.]*\s*(?:%|퍼센트|원|만원|억원|개|건|명|회|년|개월|일)|(?:업계|국내|전국|세계)\s*\d+\s*위)/g;
const FINANCE_CONTEXT_RE = /(주식|증권|코인|가상자산|펀드|채권|선물|옵션|ETF|투자|종목|매수|매도|수익률|배당)/i;
const COMPLIANCE_SCOPES = ['표시광고법', '자본시장법', '불법 콘텐츠', '언론중재법·인격권'];

const LEGAL_RULES = [
  {
    id: 'ad-comparison',
    law: '표시광고법',
    level: 'review',
    re: /(타사|경쟁사|업계|시장)\s*(대비|보다).{0,30}(우수|저렴|높|낮|빠르|효과|절감|증가)/i,
    title: '비교광고의 기준 확인 필요',
    detail: '비교 대상, 측정 기준, 조사 시점과 객관적인 근거를 함께 확인해 주세요.',
  },
  {
    id: 'ad-free',
    law: '표시광고법',
    level: 'warning',
    re: /(완전\s*)?무료|공짜|0\s*원/i,
    title: '무료·가격 조건 확인',
    detail: '필수 결제, 적용 대상, 기간 또는 수량 제한이 있다면 가까운 위치에 명확히 밝혀 주세요.',
  },
  {
    id: 'capital-guarantee',
    law: '자본시장법',
    level: 'error',
    finance: true,
    re: /(원금|손실).{0,12}(보장|보전|없(?:습니다|다)?|제로)|확정\s*수익|수익.{0,8}(보장|확정)|무위험\s*투자/i,
    title: '손실 보전·이익 보장 표현',
    detail: '금융투자상품의 손실 보전이나 일정한 이익을 약속하는 표현은 게시하지 마세요.',
  },
  {
    id: 'capital-solicitation',
    law: '자본시장법',
    level: 'review',
    finance: true,
    re: /(지금|오늘|당장).{0,10}(매수|매도|투자)|매수\s*(추천|신호|타이밍)|목표가|급등\s*(예정|확실|종목)|수익률\s*\d/i,
    title: '투자 권유·자문 가능성',
    detail: '작성자 등록 지위, 독자 범위, 대가 수취 여부와 금융상품 광고·투자자문 규정 적용 여부를 법무 담당자가 확인해야 합니다.',
  },
  {
    id: 'capital-insider',
    law: '자본시장법',
    level: 'review',
    finance: true,
    re: /(미공개|내부자|내부\s*정보|극비|공시\s*전|아직\s*공개되지\s*않)/i,
    title: '미공개 중요정보 가능성',
    detail: '공시 전 중요정보 또는 내부자로부터 얻은 정보인지 확인하고, 확인 전에는 게시하지 마세요.',
  },
  {
    id: 'illegal-trade',
    law: '불법 콘텐츠',
    level: 'error',
    re: /(마약|대마|필로폰|대포통장|대포폰|개인정보|처방전\s*없이).{0,18}(판매|구매|삽니다|팝니다|거래|배송|구해|매입)|불법\s*(도박|토토|카지노).{0,12}(가입|추천|홍보|링크)/i,
    title: '불법 거래·유통 의심 내용',
    detail: '불법 물품·정보·서비스의 거래나 이용을 알선하는 내용은 게시할 수 없습니다.',
  },
  {
    id: 'illegal-personal-id',
    law: '불법 콘텐츠',
    level: 'error',
    re: /\b\d{6}\s*[- ]\s*[1-4]\d{6}\b|\b(?:\d[ -]?){15,16}\b/,
    title: '민감한 식별정보 노출 가능성',
    detail: '주민등록번호나 결제카드 번호로 보이는 값을 삭제하거나 안전하게 마스킹해 주세요.',
  },
  {
    id: 'illegal-threat',
    law: '불법 콘텐츠',
    level: 'review',
    re: /(죽여|살해|폭파|불을\s*지르|해치겠|가만두지\s*않).{0,20}/i,
    title: '협박·폭력 표현 확인',
    detail: '실제 위협이나 범죄 조장인지, 인용·비평 등 정당한 문맥인지 담당자가 확인해야 합니다.',
  },
  {
    id: 'media-allegation',
    law: '언론중재법·인격권',
    level: 'review',
    re: /(사기꾼|범죄자|횡령|배임|성범죄|갑질|조작|비리|불륜|학폭|표절).{0,24}(했다|이다|입니다|확실|드러났|밝혀졌|의혹)/i,
    title: '제3자에 대한 사실 주장·의혹 제기',
    detail: '대상이 식별된다면 사실 확인, 공익성, 출처, 반론 반영과 인격권 침해 가능성을 확인해 주세요.',
  },
  {
    id: 'media-private',
    law: '언론중재법·인격권',
    level: 'review',
    re: /(사생활|비공개\s*대화|통화\s*녹음|몰래\s*촬영|유출된\s*(문서|사진|영상)|신상\s*공개)/i,
    title: '사생활·초상·대화 공개 가능성',
    detail: '당사자 동의, 보도 목적과 공익성, 공개 범위를 확인하고 불필요한 식별정보는 제거해 주세요.',
  },
];

function approvedText(product) {
  if (!product) return '';
  return [
    product.name,
    product.short,
    product.tagline,
    product.summary,
    product.intake,
    ...(product.facts || []),
    ...(product.benefits || []),
    ...(product.voice?.proof || []),
    ...(product.sources || []).flatMap((source) => source.content || []),
  ].filter(Boolean).join('\n');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * 편집 중 즉시 실행하는 게시글 사전 검토다. 법률 판단이 아니라, 승인된 상품 자료와
 * 공통 카피 규칙을 기준으로 사람이 다시 확인할 문구를 빠르게 찾는다.
 */
export function reviewCompliance(text, channel, product) {
  const value = String(text || '').trim();
  const issues = [];

  if (!value) {
    issues.push({
      id: 'empty',
      level: 'error',
      law: '게시 요건',
      title: '검토할 게시글이 없습니다.',
      detail: '게시글을 생성하거나 내용을 입력한 뒤 다시 확인해 주세요.',
    });
  }

  const banned = findBanned(value, BANNED_PHRASES);
  for (const phrase of banned) {
    issues.push({
      id: `banned-${phrase}`,
      level: 'error',
      law: '표시광고법',
      title: `금지 표현: “${phrase}”`,
      detail: '해당 표현을 삭제하고 객관적인 사실이나 조건으로 바꿔 주세요.',
    });
  }

  const bannedText = banned.join(' ');
  const riskyReasons = findRisky(value, product).filter((reason) => {
    if (reason.includes('100%') && bannedText.includes('100%')) return false;
    if (reason.includes('보장') && bannedText.includes('보장')) return false;
    if (reason.includes('무조건') && bannedText.includes('무조건')) return false;
    return true;
  });
  for (const reason of riskyReasons) {
    issues.push({
      id: `risky-${reason}`,
      level: 'error',
      law: '표시광고법',
      title: `근거 없는 단정 가능성: ${reason}`,
      detail: '성과를 보장하지 말고, 확인 가능한 사실이나 선택 기준으로 표현해 주세요.',
    });
  }

  const approved = approvedText(product).replace(/\s/g, '');
  const numericClaims = unique(value.match(NUMBER_CLAIM_RE) || [])
    .filter((claim) => !approved.includes(claim.replace(/\s/g, '')))
    .filter((claim) => !banned.some((phrase) => phrase.includes(claim)));
  for (const claim of numericClaims) {
    issues.push({
      id: `number-${claim}`,
      level: 'warning',
      law: '표시광고법',
      title: `수치 근거 확인: “${claim}”`,
      detail: '승인된 상품 자료에서 확인되지 않은 수치일 수 있습니다. 출처와 최신성을 확인해 주세요.',
    });
  }

  for (const rule of LEGAL_RULES) {
    if (rule.finance && !FINANCE_CONTEXT_RE.test(value)) continue;
    if (!rule.re.test(value)) continue;
    issues.push({
      id: rule.id,
      law: rule.law,
      level: rule.level,
      title: rule.title,
      detail: rule.detail,
    });
  }

  if (channel?.limit && value.length > channel.limit) {
    issues.push({
      id: 'channel-limit',
      level: 'warning',
      law: '채널 정책',
      title: `${channel.name} 글자 수 초과`,
      detail: `현재 ${value.length.toLocaleString()}자로, 채널 기준 ${channel.limit.toLocaleString()}자를 넘었습니다.`,
    });
  }

  const errors = issues.filter((issue) => issue.level === 'error');
  const reviews = issues.filter((issue) => issue.level === 'review');
  const warnings = issues.filter((issue) => issue.level === 'warning');
  const scopes = COMPLIANCE_SCOPES.map((law) => {
    const scopedIssues = issues.filter((issue) => issue.law === law);
    const status = scopedIssues.some((issue) => issue.level === 'error')
      ? 'error'
      : scopedIssues.some((issue) => issue.level === 'review')
        ? 'review'
        : scopedIssues.some((issue) => issue.level === 'warning')
          ? 'warning'
          : 'pass';
    return { law, status, count: scopedIssues.length };
  });
  return {
    status: errors.length ? 'error' : reviews.length ? 'review' : warnings.length ? 'warning' : 'pass',
    issues,
    errors,
    reviews,
    warnings,
    scopes,
  };
}
