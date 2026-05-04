// SPEC.md §4.1 / §4.2 チャットコアエンジン
// UI 非依存の純粋ロジック。将来 packages/core にコピペ移行する想定。
//
// 依存：mockAI（差し替え可能）、stages、endings、prompts

import { evaluateInput, generateReply } from './mockAI.js';
import { checkStageTransition, STAGES } from './stages.js';
import { judgeEnding, judgeConfessionEnding, judgeDateEnding, ENDINGS } from './endings.js';

/**
 * @typedef {Object} SessionState
 * @property {number} affectionScore
 * @property {string} currentStage
 * @property {number} skillUsesRemaining
 * @property {number} redFlagCount
 * @property {number} consecutiveRedFlags
 * @property {number} consecutiveLowAffectionTurns
 * @property {number} consecutiveStaleTurns
 * @property {number} turnCount
 * @property {number} questionsByUser
 * @property {number} creepyHits
 * @property {number} topicLoopCount
 * @property {string[]} topicHistory
 * @property {Object} lastEvaluation
 * @property {Object[]} messages
 * @property {Object} userProfile
 * @property {string|null} reachedLineExchange
 */

export function createSession(character, userProfile = {}) {
  return {
    characterId: character.id,
    affectionScore: 20,
    currentStage: 'greeting',
    skillUsesRemaining: 3,
    redFlagCount: 0,
    consecutiveRedFlags: 0,
    consecutiveLowAffectionTurns: 0,
    consecutiveStaleTurns: 0,
    turnCount: 0,
    questionsByUser: 0,
    creepyHits: 0,
    topicLoopCount: 0,
    topicHistory: [],
    lastEvaluation: null,
    messages: [],
    userProfile,
    reachedLineExchange: false,
    ending: null,
  };
}

/**
 * ユーザーのメッセージを処理し、状態を更新して返す。
 * 戻り値の {state, evalResult, reply, ending, stageChanged} で UI を駆動する。
 */
export function processUserMessage(state, character, userMessage) {
  // 1. 入力評価
  const evalResult = evaluateInput(state, character, userMessage);

  // 2. 状態更新
  const next = { ...state };
  next.messages = [
    ...state.messages,
    { role: 'user', content: userMessage, ts: Date.now() },
  ];
  next.turnCount = state.turnCount + 1;
  next.affectionScore = clamp(state.affectionScore + evalResult.scoreDelta, 0, 100);
  next.lastEvaluation = evalResult;

  if (evalResult.isRedFlag) {
    next.redFlagCount = state.redFlagCount + 1;
    next.consecutiveRedFlags = state.consecutiveRedFlags + 1;
  } else {
    next.consecutiveRedFlags = 0;
  }

  if (next.affectionScore <= 10) {
    next.consecutiveLowAffectionTurns = state.consecutiveLowAffectionTurns + 1;
  } else {
    next.consecutiveLowAffectionTurns = 0;
  }

  if (next.affectionScore >= 11 && next.affectionScore <= 30 && evalResult.scoreDelta <= 1) {
    next.consecutiveStaleTurns = state.consecutiveStaleTurns + 1;
  } else {
    next.consecutiveStaleTurns = 0;
  }

  if (evalResult.hasQuestion) {
    next.questionsByUser = state.questionsByUser + 1;
  }
  if (evalResult.creepy) {
    next.creepyHits = state.creepyHits + 1;
  }

  // トピック重複検出（極簡易）
  const topicKey = userMessage.slice(0, 8);
  if (topicKey && state.topicHistory.includes(topicKey)) {
    next.topicLoopCount = state.topicLoopCount + 1;
  }
  next.topicHistory = [...state.topicHistory, topicKey].slice(-12);

  // 3. バッドエンド判定（majorは即座に）
  let ending = judgeEnding(next, evalResult);
  if (ending) {
    next.ending = ending;
    next.messages = [...next.messages, systemMsg(`— ${ending.title} —`)];
    return { state: next, evalResult, reply: null, ending, stageChanged: false };
  }

  // 4. ステージ遷移判定
  let stageChanged = false;
  const nextStage = checkStageTransition(next, userMessage);
  if (nextStage) {
    next.currentStage = nextStage;
    stageChanged = true;
    if (nextStage === 'line_exchange') {
      next.reachedLineExchange = true;
    }
  }

  // 5. confession ステージは告白に対する応答で確定エンディング
  if (state.currentStage === 'confession' && evalResult.isConfessionAttempt) {
    ending = judgeConfessionEnding(next);
    next.ending = ending;
    const reply = generateReply(next, character, evalResult);
    if (reply) {
      next.messages = [...next.messages, { role: 'assistant', content: reply, ts: Date.now() }];
    }
    next.messages = [...next.messages, systemMsg(`— ${ending.title} —`)];
    return { state: next, evalResult, reply, ending, stageChanged };
  }

  // 6. キャラ返答
  const reply = generateReply(next, character, evalResult);
  if (reply) {
    next.messages = [...next.messages, { role: 'assistant', content: reply, ts: Date.now() }];
  } else {
    next.messages = [...next.messages, systemMsg('（既読）')];
  }

  return { state: next, evalResult, reply, ending: null, stageChanged };
}

/**
 * 「なに考えてるの？」スキル発動。残回数を 1 減らし、直近 thoughtSummary を返す。
 */
export function useSkill(state) {
  if (state.skillUsesRemaining <= 0) return { state, thought: null };
  const thought = state.lastEvaluation?.thoughtSummary ?? '（まだ会話が始まってない）';
  const next = { ...state, skillUsesRemaining: state.skillUsesRemaining - 1 };
  return { state: next, thought };
}

/**
 * date ステージで会話が滞ったまま終了させたいときに呼ぶ（明示終了用）。
 */
export function finalizeDate(state) {
  const ending = judgeDateEnding(state);
  if (!ending) return { state, ending: null };
  return { state: { ...state, ending }, ending };
}

export { ENDINGS, STAGES };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function systemMsg(content) {
  return { role: 'system', content, ts: Date.now() };
}
