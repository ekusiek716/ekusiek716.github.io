// SPEC.md §4.5 ステージ遷移ルール（ハイブリッド方式）
// 会話自体は AI 任せ、ステージ進行はルール判定で安定化する。

export const STAGES = [
  'greeting',
  'chat',
  'line_exchange',
  'date_invite',
  'date',
  'confession',
];

export const STAGE_LABELS = {
  greeting: '挨拶',
  chat: '雑談',
  line_exchange: 'LINE交換',
  date_invite: 'デート誘い',
  date: 'デート当日',
  confession: '告白',
};

const RULES = [
  {
    from: 'greeting',
    to: 'chat',
    minTurns: 2,
    minAffection: 22,
  },
  {
    from: 'chat',
    to: 'line_exchange',
    minTurns: 8,
    minAffection: 50,
    requiredKeywordsAny: ['LINE', 'line', 'ライン', '連絡先', 'ID'],
  },
  {
    from: 'line_exchange',
    to: 'date_invite',
    minTurns: 1,
    minAffection: 60,
  },
  {
    from: 'date_invite',
    to: 'date',
    minTurns: 1,
    minAffection: 65,
    requiredKeywordsAny: [
      '会え', '会いま', 'デート', '行こ', '行きま', '飲み',
      'ご飯', 'ごはん', 'カフェ', '映画', 'ヨガ', '時間',
    ],
  },
  {
    from: 'date',
    to: 'confession',
    minTurns: 3,
    minAffection: 75,
  },
];

function matchKeywordsAny(text, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

/**
 * 直近のユーザー発言とセッション状態から、次ステージへ遷移すべきか判定する。
 * @returns {string|null} 遷移先ステージ。遷移なしなら null。
 */
export function checkStageTransition(state, lastUserMessage) {
  const rule = RULES.find((r) => r.from === state.currentStage);
  if (!rule) return null;
  if (state.turnCount < (rule.minTurns ?? 0)) return null;
  if (state.affectionScore < (rule.minAffection ?? 0)) return null;
  if (!matchKeywordsAny(lastUserMessage, rule.requiredKeywordsAny)) return null;
  return rule.to;
}

export function stageIndex(stage) {
  return STAGES.indexOf(stage);
}
