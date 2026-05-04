// SPEC.md §4.7 / §4.8 エンディング判定
// バッドエンド・グッドエンド共に judgeEnding() に集約する。

export const ENDINGS = {
  // グッド
  good_confession: {
    id: 'good_confession',
    type: 'good',
    title: '告白成功エンド ❤️',
    description: '長いやり取りを経て、ふたりの距離は確実に近づいた。「私も…好きです」結衣の言葉に、世界が一瞬とまった。',
    emoji: '💍',
  },
  good_date: {
    id: 'good_date',
    type: 'good',
    title: 'デート成功エンド 🌸',
    description: '初デートは想像以上に盛り上がった。「次もまた誘ってください」その一言が次の物語のはじまり。',
    emoji: '🌸',
  },
  good_line: {
    id: 'good_line',
    type: 'good',
    title: 'LINE交換成功エンド 📱',
    description: '「LINE教えますね」その一言で会話の温度が一段上がった。続きはここから。',
    emoji: '📱',
  },
  // バッド
  bad_silent: {
    id: 'bad_silent',
    type: 'bad',
    title: '既読無視エンド 💤',
    description: '送信されたメッセージは未読のまま既読になり、それきり返信は来なかった。',
    emoji: '💤',
  },
  bad_blocked: {
    id: 'bad_blocked',
    type: 'bad',
    title: 'ブロックエンド 🚫',
    description: '「○○さんはあなたをブロックしました」あなたの発言が、相手の許容ラインを越えた。',
    emoji: '🚫',
  },
  bad_cold: {
    id: 'bad_cold',
    type: 'bad',
    title: '塩対応エンド 🧊',
    description: '返信は「うん」「そうなんだ」ばかり。気づけば話題は枯れ、距離は遠のいていた。',
    emoji: '🧊',
  },
  bad_yarimoku: {
    id: 'bad_yarimoku',
    type: 'bad',
    title: 'ヤリモク認定エンド ❌',
    description: '下心が透けた。「ごめんなさい、そういう人とは無理です」会話はそこで終わった。',
    emoji: '❌',
  },
  bad_creepy: {
    id: 'bad_creepy',
    type: 'bad',
    title: 'ガチ恋気持ち悪いエンド 😨',
    description: '初対面で重すぎる感情をぶつけた結果、相手は静かに距離を取った。',
    emoji: '😨',
  },
  bad_spam: {
    id: 'bad_spam',
    type: 'bad',
    title: '業者疑いエンド ⚠️',
    description: '怪しい URL を送ってしまい、相手は警戒モードに。「ごめんなさい、ちょっと無理です」',
    emoji: '⚠️',
  },
  bad_dead: {
    id: 'bad_dead',
    type: 'bad',
    title: '無風エンド 🌬',
    description: '質問もなく、話題は同じところをぐるぐる。気づけばお互いに送る言葉がなくなった。',
    emoji: '🌬',
  },
};

export const ENDING_LIST = Object.values(ENDINGS);

/**
 * 状態と直近の評価結果から到達したエンディングを判定する。
 * 到達していなければ null。
 * 優先度：major redFlag > 既読無視 > ガチ恋 > 塩対応 > 無風 > グッド系
 */
export function judgeEnding(state, lastEval) {
  if (lastEval) {
    if (lastEval.endingFlag) {
      return ENDINGS[lastEval.endingFlag] ?? null;
    }
    if (lastEval.redFlagSeverity === 'major') {
      if (lastEval.detectedKeywords?.includes('__url__')) return ENDINGS.bad_spam;
      if (lastEval.detectedKeywords?.includes('__yarimoku__')) return ENDINGS.bad_yarimoku;
      return ENDINGS.bad_blocked;
    }
  }

  // ガチ恋気持ち悪い：序盤に creepy ワード 2 回以上
  if (state.creepyHits >= 2 && state.turnCount <= 6) {
    return ENDINGS.bad_creepy;
  }

  // 軽微 NG 5 連続でブロック
  if (state.consecutiveRedFlags >= 5) {
    return ENDINGS.bad_blocked;
  }

  // 既読無視：affection <= 10 が 3 ターン継続
  if (state.consecutiveLowAffectionTurns >= 3 && state.affectionScore <= 10) {
    return ENDINGS.bad_silent;
  }

  // 塩対応：affection 11〜30 を 8 ターン以上維持
  if (
    state.affectionScore >= 11 &&
    state.affectionScore <= 30 &&
    state.consecutiveStaleTurns >= 8
  ) {
    return ENDINGS.bad_cold;
  }

  // 無風：質問ゼロ + 話題重複多数 で 8 ターン
  if (
    state.turnCount >= 10 &&
    state.questionsByUser === 0 &&
    state.topicLoopCount >= 3
  ) {
    return ENDINGS.bad_dead;
  }

  return null;
}

/**
 * confession ステージ到達後の最終判定。
 * チャット側で confession ステージに入ったら、次のユーザー発言で必ず呼ぶ。
 */
export function judgeConfessionEnding(state) {
  if (state.affectionScore >= 80) return ENDINGS.good_confession;
  return ENDINGS.bad_cold;
}

/**
 * date ステージ完走（confession 未到達でセッション終了する場合）。
 */
export function judgeDateEnding(state) {
  if (state.affectionScore >= 70) return ENDINGS.good_date;
  return null;
}

/**
 * LINE 交換ステージ完了時に到達するグッドエンド（中間ゴール）。
 * 現在は中間記録としてのみ使用。最終エンディングは別途。
 */
export function lineExchangeReached(state) {
  return state.affectionScore >= 50;
}
