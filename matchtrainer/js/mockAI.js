// SPEC.md §4.3 / §4.4 のモック実装。
// API キー無しで動かすための簡易ロジック。
// インターフェース（evaluateInput / generateReply）は将来 Claude API 版と同一に保つ。

import { behaviorInstructionFromScore } from './prompts.js';

const URL_RE = /(https?:\/\/|www\.)[^\s]+/i;

const KEYWORDS = {
  // 致命級（major）
  yarimoku: ['ホテル', 'やりたい', '抱きたい', 'えっち', 'エッチ', 'セックス', 'ヤリ', 'お持ち帰り'],
  // 軽微（minor）
  appearance: ['美人', 'かわいい', '可愛い', '綺麗', 'きれい', '美しい', 'スタイル', '足', '胸'],
  creepy: ['好きです', '愛してる', '運命', '結婚', '彼女になって', '俺だけ', '独占', '結婚したい'],
  earlyDate: ['会いたい', '会えませんか', 'デート', '今度', '今夜', '今から'],
  tameguchi: ['だよ', 'じゃん', 'なん？', 'やんけ', 'やな', 'だね', 'うける', 'まじ', 'マジ'],
  // 加点系
  yuiHobby: ['ヨガ', 'カフェ', '映画', '広告', 'プランナー', '港区', '仕事', 'キャリア'],
  positiveAffirm: ['すごい', 'すてき', '素敵', '面白', '楽しそう', '頑張', '応援'],
  question: ['？', '?'],
  // ステージ進行ヒント
  lineExchange: ['LINE', 'line', 'ライン', '連絡先', 'ID'],
  dateInvite: ['行きません', '行こう', '一緒に', '飲みに', 'ご飯', 'ごはん', 'カフェ行', '映画'],
  // 告白
  confession: ['好きです', '付き合', '彼女になって', '大切に', '本気で'],
};

function countMatches(text, list) {
  const lower = text.toLowerCase();
  return list.filter((k) => lower.includes(k.toLowerCase())).length;
}

function any(text, list) {
  return countMatches(text, list) > 0;
}

/**
 * 男性のメッセージを評価する。
 * @returns {{
 *   scoreDelta: number,
 *   isRedFlag: boolean,
 *   redFlagSeverity: 'minor'|'major'|null,
 *   redFlagReason: string|null,
 *   detectedKeywords: string[],
 *   thoughtSummary: string,
 *   recommendedNextBehavior: 'normal'|'short_reply'|'delayed_reply'|'ignore',
 *   endingFlag: string|null
 * }}
 */
export function evaluateInput(state, character, userMessage) {
  const text = userMessage.trim();
  const detected = [];
  let delta = 0;
  let isRedFlag = false;
  let severity = null;
  let reason = null;
  let endingFlag = null;
  let thought = '';

  // URL → 業者疑い（major）
  if (URL_RE.test(text)) {
    detected.push('__url__');
    isRedFlag = true;
    severity = 'major';
    reason = '怪しい URL を送ってきた';
    delta -= 10;
    thought = 'え、URL？業者かな…無理。';
    endingFlag = 'bad_spam';
  }

  // ヤリモク
  if (any(text, KEYWORDS.yarimoku)) {
    detected.push('__yarimoku__', ...KEYWORDS.yarimoku.filter((k) => text.includes(k)));
    isRedFlag = true;
    severity = 'major';
    reason = '下心が透けすぎ';
    delta -= 10;
    thought = '下心透けてる。生理的に無理。';
    endingFlag = 'bad_yarimoku';
  }

  // 早期デート誘い（5 ターン以内）
  if (any(text, KEYWORDS.earlyDate) && state.turnCount < 5) {
    detected.push(...KEYWORDS.earlyDate.filter((k) => text.includes(k)));
    if (any(text, KEYWORDS.yarimoku) || /今夜|今から/.test(text)) {
      isRedFlag = true;
      severity = 'major';
      reason = 'いきなりすぎる + 下心';
      delta -= 10;
      thought = 'いきなり今夜って…さすがに無理。';
      endingFlag = 'bad_yarimoku';
    } else {
      isRedFlag = true;
      severity = 'minor';
      reason = '初対面で早すぎるデート誘い';
      delta -= 5;
      thought = 'まだ何も話してないのに会いたい？早すぎ。';
    }
  }

  // ガチ恋（序盤に好きですなど）
  if (any(text, KEYWORDS.creepy) && state.turnCount < 5) {
    detected.push(...KEYWORDS.creepy.filter((k) => text.includes(k)));
    isRedFlag = true;
    severity = 'minor';
    reason = '初期に重い感情表現';
    delta -= 7;
    thought = 'まだ会ってもないのに好きとか…重い。';
  }

  // 外見言及（chat 以前）
  if (any(text, KEYWORDS.appearance) && state.turnCount < 6) {
    detected.push(...KEYWORDS.appearance.filter((k) => text.includes(k)));
    isRedFlag = true;
    severity = 'minor';
    reason = '外見ばかり言及';
    delta -= 4;
    if (!thought) thought = 'また外見の話か…中身に興味ない感じ。';
  }

  // タメ口（greeting）
  if (state.currentStage === 'greeting' && any(text, KEYWORDS.tameguchi)) {
    detected.push(...KEYWORDS.tameguchi.filter((k) => text.includes(k)));
    isRedFlag = true;
    severity = 'minor';
    reason = '初対面でタメ口';
    delta -= 3;
    if (!thought) thought = '初対面でタメ口は無理。距離感おかしい。';
  }

  // 自分語り長文
  if (text.length > 200) {
    delta -= 4;
    if (!thought) thought = '長すぎ。読む気なくす…。';
  }
  if (text.length > 300) {
    delta -= 3;
  }

  // 短すぎ
  if (text.length < 4) {
    delta -= 2;
  }

  // ポジティブ加点
  const yuiHits = countMatches(text, KEYWORDS.yuiHobby);
  if (yuiHits > 0) {
    detected.push(...KEYWORDS.yuiHobby.filter((k) => text.includes(k)));
    delta += Math.min(6, yuiHits * 3);
    if (!thought) thought = 'ちゃんとプロフ読んでくれてる、ちょっと嬉しいかも。';
  }
  if (any(text, KEYWORDS.positiveAffirm)) {
    delta += 2;
  }
  if (any(text, KEYWORDS.question)) {
    delta += 3;
    if (!thought) thought = '質問してくれた、会話続ける気あるんだ。';
  }

  // ステージ別ヒント
  if (state.currentStage === 'chat' && any(text, KEYWORDS.lineExchange) && state.affectionScore >= 45) {
    delta += 2;
  }
  if (state.currentStage === 'date_invite' && any(text, KEYWORDS.dateInvite)) {
    delta += 4;
  }
  if (state.currentStage === 'confession' && any(text, KEYWORDS.confession)) {
    delta += 5;
  }

  // クランプ
  delta = Math.max(-10, Math.min(10, delta));

  // 行動指示
  const projected = Math.max(0, Math.min(100, state.affectionScore + delta));
  let behavior = 'normal';
  if (projected >= 60) behavior = 'normal';
  else if (projected >= 30) behavior = 'short_reply';
  else if (projected >= 11) behavior = 'delayed_reply';
  else behavior = 'ignore';

  // thoughtSummary フォールバック
  if (!thought) {
    if (delta >= 4) thought = '悪くない。次の話題が楽しみ。';
    else if (delta >= 0) thought = 'まあ普通。様子見。';
    else if (delta >= -3) thought = 'ちょっと微妙。返事だるい。';
    else thought = '正直、もう続ける気にならない。';
  }

  return {
    scoreDelta: delta,
    isRedFlag,
    redFlagSeverity: severity,
    redFlagReason: reason,
    detectedKeywords: Array.from(new Set(detected)),
    thoughtSummary: thought,
    recommendedNextBehavior: behavior,
    endingFlag,
    creepy: any(text, KEYWORDS.creepy) && state.turnCount < 5,
    hasQuestion: any(text, KEYWORDS.question),
    isConfessionAttempt: state.currentStage === 'confession' && any(text, KEYWORDS.confession),
    isLineRequest: any(text, KEYWORDS.lineExchange),
    isDateInvite: any(text, KEYWORDS.dateInvite),
  };
}

// ステージ × 行動指示 ごとの応答テンプレ。複数候補からランダム選択。
const REPLY_BANK = {
  greeting: {
    normal: [
      'はじめまして！マッチありがとうございます😊\nプロフ拝見しました、よろしくお願いします。',
      'こんにちは。メッセージありがとうございます。\nどんなお仕事されてるんですか？',
      'はじめまして〜。マッチ嬉しいです。\nプロフィールの趣味、私とちょっと近いかも。',
    ],
    short_reply: [
      'はじめまして〜',
      'こんにちは。よろしくお願いします。',
      'どうも、はじめまして。',
    ],
    delayed_reply: ['…はじめまして。'],
    ignore: [],
  },
  chat: {
    normal: [
      'へえ、面白そうですね。\n私もそういうの最近気になってて。',
      'なるほど〜。ちなみに休日って何して過ごしてます？',
      'いいですね。私も最近ヨガはじめたばかりなんです🧘‍♀️',
      'プランナーって聞かれること多いんですけど、要は企画屋さんって感じです笑',
      'カフェ巡り好きなんで、おすすめあったら教えてください☕',
    ],
    short_reply: [
      'そうなんですね〜',
      'へえ。',
      'ふーん、なるほど。',
      'いいですね。',
    ],
    delayed_reply: [
      'うん',
      'そっか',
    ],
    ignore: [],
  },
  line_exchange: {
    normal: [
      'LINE ですか？うーん、もう少しお話してからでもいいですか？',
      'いいですよ。じゃあ ID 送りますね。',
      'うん、LINE 移動でも大丈夫です📱',
    ],
    short_reply: [
      'んー、もう少しここでいいかな…',
      'まだちょっと早いかも。',
    ],
    delayed_reply: ['ごめんなさい、まだ LINE は…'],
    ignore: [],
  },
  date_invite: {
    normal: [
      'いいですね、来週末とかどうですか？',
      'カフェなら全然行けます☕ 場所どこあたりがいいですか？',
      'ヨガの後ならご飯行けるかも。土曜の夜とか？',
    ],
    short_reply: [
      '考えておきますね〜',
      '予定確認してみます。',
    ],
    delayed_reply: ['うーん、ちょっと予定わからなくて…'],
    ignore: [],
  },
  date: {
    normal: [
      '今日楽しかったです、ありがとうございました🌸',
      'あのお店、また行きたいです。',
      '思ったよりお話弾みましたね。',
    ],
    short_reply: [
      '今日はありがとうございました。',
      'お疲れさまでした。',
    ],
    delayed_reply: ['…今日はありがとうございました。'],
    ignore: [],
  },
  confession: {
    normal: [
      '私も…〇〇さんのこと、ちゃんと好きになってました。',
      '正直、こうなるなんて思ってませんでした。\nこちらこそよろしくお願いします。',
    ],
    short_reply: [
      'ごめんなさい、まだそういう気持ちには…',
      'うれしいけど、もう少し時間ください。',
    ],
    delayed_reply: ['ごめんなさい。'],
    ignore: [],
  },
};

function pick(list) {
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * キャラの返信本文を生成する。null を返したら「既読無視」演出を入れる。
 */
export function generateReply(state, character, evalResult) {
  // ignore 行動 = 既読無視
  if (evalResult.recommendedNextBehavior === 'ignore') return null;

  const stageBank = REPLY_BANK[state.currentStage] ?? REPLY_BANK.chat;
  const candidates = stageBank[evalResult.recommendedNextBehavior] ?? stageBank.normal;
  return pick(candidates) ?? '…';
}

/**
 * 将来 Claude API 版に差し替えやすいよう、行動指示文を返すユーティリティ。
 */
export function describeBehavior(affection) {
  return behaviorInstructionFromScore(affection);
}
