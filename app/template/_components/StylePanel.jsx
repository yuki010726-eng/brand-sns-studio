import {
  ACCENTS, MARKS, CARD_THEMES, NOTE_SYMBOLS, NOTE_PAPERS, NOTE_INKS, DEFAULT_NOTE_GRAIN,
  getCardTheme, getNoteInk, getNotePaper, isHex, contrastWithWhite, contrastOn,
} from "../../../lib/concepts.js";
import { SwatchPicker } from "./SwatchPicker.jsx";
import { SectionDivider } from "./SectionDivider.jsx";

function themeHint(theme) {
  const base = "모든 장에 함께 적용됩니다.";
  if (!isHex(theme.id)) return `${base} 흰 글씨 대비를 지키는 색만 넣어 뒀습니다.`;
  const ratio = contrastWithWhite(theme.hex);
  return ratio >= 4.5
    ? `${base} 흰 글씨 대비 ${ratio.toFixed(2)}:1 — 기준(4.5:1)을 넘깁니다.`
    : `⚠️ ${base} 흰 글씨 대비가 ${ratio.toFixed(2)}:1 로 기준(4.5:1)에 못 미칩니다. 글이 잘 안 보일 수 있어요.`;
}

function inkHint(ink, paperHex) {
  const base = "제목·본문·강조 박스에 함께 적용됩니다.";
  if (!isHex(ink.id)) return `${base} 종이 색 대비를 지키는 색만 넣어 뒀습니다.`;
  const ratio = contrastOn(ink.hex, paperHex);
  return ratio >= 4.5
    ? `${base} 종이 대비 ${ratio.toFixed(2)}:1 — 기준(4.5:1)을 넘깁니다.`
    : `⚠️ ${base} 종이 대비가 ${ratio.toFixed(2)}:1 로 기준(4.5:1)에 못 미칩니다. 글이 잘 안 보일 수 있어요.`;
}

/**
 * 템플릿별 색상·마크·종이 선택 묶음.
 * 옛 accentHTML/cardThemeHTML/markHTML/notePaperHTML/noteInkHTML/noteSymbolHTML 을 한데 모았다.
 * 피그마: https://www.figma.com/design/jRjBo4LUHkohSoPRqSaEAv/sns?node-id=72-1399
 *
 * @param {object} values { accent, mark, cardTheme, noteSymbol, notePaper, noteInk, noteGrain }
 * @param {(patch:object)=>void} onChange 바뀐 값만 담아 부른다 — page.jsx 가 setState 로 병합한다
 */
export function StylePanel({ concept, values, onChange }) {
  const { accent, mark, cardTheme, noteSymbol, notePaper, noteInk, noteGrain } = values;

  return (
    <div className="space-y-5">
      {concept.accentPicker && (
        <SwatchPicker
          legend="강조 색상"
          name="accent"
          options={ACCENTS.map((a) => ({ id: a.hex, name: a.name, hex: a.hex }))}
          value={accent}
          onChange={(v) => onChange({ accent: v })}
          custom={{ value: isHex(accent) ? accent : "#B9F73E" }}
          onCustomChange={(v) => onChange({ accent: v })}
          hint="모든 장의 강조 문구에 함께 적용됩니다."
          hintPlacement="inline"
        />
      )}

      {concept.id === "card" && (
        <>
          <SwatchPicker
            legend="테마 색상"
            name="cardtheme"
            options={CARD_THEMES.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
            value={getCardTheme(cardTheme).id}
            onChange={(v) => onChange({ cardTheme: v })}
            custom={{ value: isHex(cardTheme) ? cardTheme : getCardTheme(cardTheme).hex }}
            onCustomChange={(v) => onChange({ cardTheme: v })}
            hint={themeHint(getCardTheme(cardTheme))}
          />
          <SwatchPicker
            legend="우상단 마크"
            name="mark"
            options={MARKS.map((m) => ({ id: m.id, name: m.name, icon: m.id === "none" ? undefined : m.id }))}
            value={mark || "newspaper"}
            onChange={(v) => onChange({ mark: v })}
            hint="모든 장의 오른쪽 위에 함께 적용됩니다."
          />
        </>
      )}

      {concept.id === "note" && (
        <>
          <SwatchPicker
            legend="종이 색"
            name="paper"
            options={NOTE_PAPERS.map((p) => ({ id: p.id, name: p.name, hex: p.hex }))}
            value={notePaper || "white"}
            onChange={(v) => onChange({ notePaper: v })}
          />
          <SwatchPicker
            legend="글씨 색"
            name="noteink"
            options={NOTE_INKS.map((c) => ({ id: c.id, name: c.name, hex: c.hex }))}
            value={getNoteInk(noteInk).id}
            onChange={(v) => onChange({ noteInk: v })}
            custom={{ value: isHex(noteInk) ? noteInk : getNoteInk(noteInk).hex }}
            onCustomChange={(v) => onChange({ noteInk: v })}
            hint={inkHint(getNoteInk(noteInk), getNotePaper(notePaper).hex)}
          />
          <div>
            <SectionDivider title="종이 결" />
            <div className="mt-4 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Number.isFinite(Number(noteGrain)) ? Number(noteGrain) : DEFAULT_NOTE_GRAIN}
                onChange={(e) => onChange({ noteGrain: Number(e.target.value) })}
                autoComplete="off"
                aria-label="종이 결 강도"
                className="w-full"
              />
              <output className="w-8 shrink-0 text-right text-[13px] text-[#5f6b7a]">
                {Number.isFinite(Number(noteGrain)) ? Number(noteGrain) : DEFAULT_NOTE_GRAIN}
              </output>
            </div>
            <p className="mt-2 text-[13px] leading-[1.5] text-[#5f6b7a]">
              0이면 매끈한 단색, 올릴수록 섬유가 살아나 바스락거리는 종이가 됩니다. 모든 장에 함께 적용됩니다.
            </p>
          </div>
          <SwatchPicker
            legend="상단 심볼 (본문·팔로우)"
            name="notesymbol"
            options={NOTE_SYMBOLS.map((s) => ({ id: s.id, name: s.name }))}
            value={noteSymbol || "flask"}
            onChange={(v) => onChange({ noteSymbol: v })}
            hint="모든 본문·팔로우 장 위쪽 가운데에 함께 들어갑니다. 카드 이미지와는 별개입니다."
          />
        </>
      )}
    </div>
  );
}
