// SPEC.md §2 / §5 UI コントローラー。
// 画面切替、入力ハンドリング、エンジンとの繋ぎ込みのみ担当。
// 純粋ロジックは engine.js / mockAI.js / stages.js / endings.js に閉じ込める。

import { getCharacter } from './characters.js';
import {
  createSession,
  processUserMessage,
  useSkill,
} from './engine.js';
import { STAGES, STAGE_LABELS } from './stages.js';
import { ENDING_LIST, ENDINGS } from './endings.js';

const STORAGE_KEY = 'matchtrainer:unlocks:v1';

const character = getCharacter('yui');
let state = null;

const screens = {
  match: document.getElementById('screen-match'),
  matchAnim: document.getElementById('screen-match-anim'),
  chat: document.getElementById('screen-chat'),
  ending: document.getElementById('screen-ending'),
};

function showScreen(name) {
  for (const [k, el] of Object.entries(screens)) {
    el.classList.toggle('active', k === name);
  }
  window.scrollTo(0, 0);
}

// --- マッチ画面 ---
function renderMatchScreen() {
  document.getElementById('card-name').textContent = `${character.name}, ${character.age}`;
  document.getElementById('card-meta').textContent = `${character.job} ・ ${character.location}`;
  document.getElementById('card-bio').textContent = character.bio;
  document.getElementById('card-avatar').textContent = character.avatarEmoji;
  document.getElementById('card-avatar').style.background = character.avatarColor;

  const tags = document.getElementById('card-tags');
  tags.innerHTML = '';
  character.hobbies.forEach((h) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = `#${h}`;
    tags.appendChild(span);
  });

  document.getElementById('btn-like').onclick = () => triggerMatch();
  document.getElementById('btn-skip').onclick = () => {
    alert('MVP では結衣 1 名のみです。やってみましょう！');
  };
}

function triggerMatch() {
  showScreen('matchAnim');
  document.getElementById('match-name').textContent = character.name;
  document.getElementById('match-avatar').textContent = character.avatarEmoji;
  document.getElementById('match-avatar').style.background = character.avatarColor;

  document.getElementById('btn-start-chat').onclick = () => {
    startChatSession();
  };
}

// --- チャット画面 ---
function startChatSession() {
  state = createSession(character, {});
  // 最初に相手から短い挨拶を 1 通送る演出
  state.messages.push({
    role: 'assistant',
    content: `はじめまして！マッチありがとうございます😊\nプロフ拝見しました、よろしくお願いします。`,
    ts: Date.now(),
  });

  document.getElementById('chat-name').textContent = character.name;
  document.getElementById('chat-avatar').textContent = character.avatarEmoji;
  document.getElementById('chat-avatar').style.background = character.avatarColor;

  renderStageBar();
  renderMessages();
  updateSkillBadge();
  updateAffectionBar();

  showScreen('chat');
  document.getElementById('chat-input').value = '';
  document.getElementById('chat-input').focus();
}

function renderStageBar() {
  const bar = document.getElementById('stage-bar');
  bar.innerHTML = '';
  const currentIdx = STAGES.indexOf(state.currentStage);
  STAGES.forEach((s, i) => {
    const span = document.createElement('span');
    span.className = 'stage-pill';
    if (i < currentIdx) span.classList.add('done');
    if (i === currentIdx) span.classList.add('current');
    span.textContent = STAGE_LABELS[s];
    bar.appendChild(span);
  });
}

function updateAffectionBar() {
  const fill = document.getElementById('affection-fill');
  fill.style.width = `${state.affectionScore}%`;
  document.getElementById('affection-num').textContent = `${state.affectionScore}`;
}

function updateSkillBadge() {
  document.getElementById('skill-badge').textContent = state.skillUsesRemaining;
  document.getElementById('btn-skill').disabled = state.skillUsesRemaining <= 0;
}

function renderMessages() {
  const list = document.getElementById('messages');
  list.innerHTML = '';
  for (const m of state.messages) {
    const row = document.createElement('div');
    row.className = `msg-row role-${m.role}`;
    if (m.role === 'system') {
      row.textContent = m.content;
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = m.content;
      row.appendChild(bubble);
    }
    list.appendChild(row);
  }
  list.scrollTop = list.scrollHeight;
}

async function handleSend() {
  if (!state || state.ending) return;
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.disabled = true;
  document.getElementById('btn-send').disabled = true;

  // ユーザー側のメッセージを即時描画（応答を待つ前に）
  const optimistic = { ...state, messages: [...state.messages, { role: 'user', content: text, ts: Date.now() }] };
  state = optimistic;
  renderMessages();

  // タイピング演出
  showTyping(true);
  await delay(600 + Math.random() * 700);

  // 楽観反映を巻き戻して、エンジンに正規処理させる
  state = { ...state, messages: state.messages.slice(0, -1) };
  const result = processUserMessage(state, character, text);
  state = result.state;

  showTyping(false);
  renderMessages();
  renderStageBar();
  updateAffectionBar();
  updateSkillBadge();

  if (result.stageChanged) {
    flashStageChange(state.currentStage);
  }

  if (result.ending) {
    saveUnlock(result.ending.id);
    setTimeout(() => goToEnding(result.ending), 800);
    return;
  }

  // バッドエンドに到達していなくても、入力欄を再有効化
  input.disabled = false;
  document.getElementById('btn-send').disabled = false;
  input.focus();
}

function showTyping(on) {
  document.getElementById('typing').classList.toggle('visible', on);
}

function flashStageChange(stage) {
  const el = document.getElementById('stage-flash');
  el.textContent = `▶ ${STAGE_LABELS[stage]} に進みました`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

// --- スキル ---
function handleSkill() {
  if (!state) return;
  const r = useSkill(state);
  if (!r.thought) return;
  state = r.state;
  showThought(r.thought);
  updateSkillBadge();
}

function showThought(text) {
  const el = document.getElementById('thought-bubble');
  el.textContent = `💭 ${text}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// --- エンディング画面 ---
function goToEnding(ending) {
  document.getElementById('ending-emoji').textContent = ending.emoji;
  document.getElementById('ending-title').textContent = ending.title;
  document.getElementById('ending-desc').textContent = ending.description;
  document.getElementById('ending-stat-score').textContent = `${state.affectionScore}/100`;
  document.getElementById('ending-stat-stage').textContent = STAGE_LABELS[state.currentStage];
  document.getElementById('ending-stat-turns').textContent = `${state.turnCount}`;

  renderEndingTree(ending);
  showScreen('ending');

  document.getElementById('btn-retry').onclick = () => startChatSession();
  document.getElementById('btn-home').onclick = () => {
    showScreen('match');
  };
}

function renderEndingTree(currentEnding) {
  const unlocks = loadUnlocks();
  const tree = document.getElementById('ending-tree');
  tree.innerHTML = '';
  ENDING_LIST.forEach((e) => {
    const node = document.createElement('div');
    node.className = `ending-node type-${e.type}`;
    if (unlocks.includes(e.id)) node.classList.add('unlocked');
    if (e.id === currentEnding.id) node.classList.add('current');
    const isLocked = !unlocks.includes(e.id) && e.id !== currentEnding.id;
    node.innerHTML = isLocked
      ? `<span class="lock">🔒</span><span class="title">？？？</span>`
      : `<span class="emoji">${e.emoji}</span><span class="title">${e.title}</span>`;
    tree.appendChild(node);
  });

  const total = ENDING_LIST.length;
  const unlockedCount = ENDING_LIST.filter((e) => unlocks.includes(e.id)).length;
  document.getElementById('ending-progress').textContent = `達成率 ${unlockedCount}/${total}`;
}

// --- 永続化 ---
function loadUnlocks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveUnlock(endingId) {
  const list = loadUnlocks();
  if (!list.includes(endingId)) {
    list.push(endingId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }
}

// --- ユーティリティ ---
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- 初期化 ---
function init() {
  renderMatchScreen();
  showScreen('match');

  document.getElementById('btn-send').addEventListener('click', handleSend);
  document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
  document.getElementById('btn-skill').addEventListener('click', handleSkill);
}

document.addEventListener('DOMContentLoaded', init);
