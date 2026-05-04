// SPEC.md §4.3 / §4.4 プロンプトテンプレ
// 現在 mockAI.js が使用するのではなく、将来 Claude API に差し替えるときに利用する。
// インターフェースを mockAI と同じ形（evaluateInput / generateReply）に保つこと。

export function buildEvalPrompt({ character, state, userProfile, recentMessages, userMessage }) {
  return `あなたは恋愛コーチです。以下のチャットで男性が送ったメッセージを、女性キャラの視点から評価してください。

【女性キャラ情報】
${character.persona_prompt}
${character.values_prompt}

【現在の関係性】
- ステージ: ${state.currentStage}
- 好感度: ${state.affectionScore}/100
- 累計NG回数: ${state.redFlagCount}

【男性のプロフィール】
${formatUserProfile(userProfile)}

【過去の会話】
${formatRecentMessages(recentMessages)}

【今回の発言】
${userMessage}

以下の JSON で出力してください。マークダウンや余計な文章は不要です：
{
  "scoreDelta": -10〜+10 の整数,
  "isRedFlag": boolean,
  "redFlagReason": string | null,
  "redFlagSeverity": "minor" | "major" | null,
  "detectedKeywords": string[],
  "thoughtSummary": "「なに考えてるの？」表示用、女性目線の本音 1〜2 文",
  "recommendedNextBehavior": "normal" | "short_reply" | "delayed_reply" | "ignore"
}`;
}

export function buildReplyPrompt({ character, state, recentMessages, behaviorInstruction }) {
  return `あなたは${character.name}（${character.age}歳・${character.job}）。
マッチングアプリで初マッチした男性とチャット中。

【あなたの人格】
${character.persona_prompt}

【あなたの価値観・許容ライン】
${character.values_prompt}

【現在の状態】
- 相手への好感度: ${state.affectionScore}/100
- 関係ステージ: ${state.currentStage}
- 直近の印象: ${state.lastEvaluation?.recommendedNextBehavior ?? 'normal'}

【絶対遵守ルール】
1. 忖度禁止：相手に気を使って楽しいフリをしない
2. 興味なくなったら自然に返信を短くする
3. 拒絶を直接伝えず、態度で示す（短文化・遅延・話題切り替え）
4. 自分の価値観に反する発言には冷たく反応
5. 相手のプロフを踏まえた質問・反応をする

【今回の状態指示】
${behaviorInstruction}

【直近の会話】
${formatRecentMessages(recentMessages)}

返信を 1〜3 文で生成してください。LINE 風の自然な口調で。返信本文のみを出力し、説明文や前置きは不要です。`;
}

function formatUserProfile(p) {
  if (!p) return '（未入力）';
  const parts = [];
  if (p.age) parts.push(`年齢: ${p.age}`);
  if (p.gender) parts.push(`性別: ${p.gender}`);
  if (p.job) parts.push(`職業: ${p.job}`);
  if (p.hobbies?.length) parts.push(`趣味: ${p.hobbies.join(', ')}`);
  if (p.bio) parts.push(`自己PR: ${p.bio}`);
  return parts.length ? parts.join('\n') : '（未入力）';
}

function formatRecentMessages(messages = []) {
  return messages
    .map((m) => `${m.role === 'user' ? '男性' : 'キャラ'}: ${m.content}`)
    .join('\n');
}

export function behaviorInstructionFromScore(affection) {
  if (affection >= 70) return '相手にかなり好感を持っている。質問返ししつつ自分の話も少し混ぜて、会話を弾ませる。';
  if (affection >= 50) return '悪くないと思っている。短すぎず長すぎず、自然な相槌＋軽い質問で返す。';
  if (affection >= 30) return '微妙。短文の相槌中心。質問はしない。';
  if (affection >= 11) return '興味が薄い。1〜2 文の最小限の返信、絵文字なし、話題を広げない。';
  return '不快。返信したくない気分。極端に短いか、既読のみ。';
}
