/**
 * 글귀 생성 (텍스트) — OpenAI 전용
 *
 * 이 프로젝트는 AI 제공자를 OpenAI 하나로만 쓰기로 했다(요청자 결정, 2026-08-11).
 * 예전엔 Gemini 와 오가며 골라 쓰는 제공자 선택 레이어였는데, 이제 고를 게 없어서
 * openai.js 를 그대로 다시 내보내는 얇은 통로로 남긴다 — 호출부(pages/copy.js)는
 * 그대로 이 파일만 본다.
 */
import * as openai from './openai.js';

export const MODELS = () => openai.TEXT_MODELS;
export const hasKey = () => openai.hasKey();
export const maskedKey = () => openai.maskedKey();
export const setKey = (v) => openai.setKey(v);
export const getModel = () => openai.getTextModel();
export const setModel = (v) => openai.setTextModel(v);
export const generateText = (prompt, opts) => openai.generateText(prompt, opts);
