# マッチングアプリ練習AI アプリ - 全体仕様書

> Claude Code 向け実装指示書 / Source of Truth

---

## 0. プロジェクト概要

### プロダクト名（仮）
`MatchTrainer`（仮称・変更可）

### 一行説明
マッチングアプリでの会話を、忖度ないAI相手に**マッチ→チャット→デート→告白**まで練習できるシミュレーターアプリ。リアルな失敗体験を通じて学び、実際のマッチングアプリへ送客する。

### コアバリュー
1. **リアルな失敗体験** — 既読無視・ブロック・塩対応など、現実のバッドエンドを忠実に再現
2. **マリオストーリー式スキル** — 「なに考えてるの？」で相手の思考を可視化し、学習効果を最大化
3. **Detroit式分岐ツリー** — クリア後に未踏ルートが見え、リプレイ欲を喚起

### マネタイズ
- マッチングアプリ アフィリエイト（Pairs / with / Tinder 等、A8.net・afb 経由）
- アプリ内課金：キャラ追加・スキル回数増・難易度モード解放
- サブスクリプション（月額・全キャラ解放）

### プラットフォーム
- **本体：iOS / Android アプリ**（React Native + Expo を推奨）
- **お試し版：Web**（Next.js）— バズ拡散・本体DL誘導用
- 共通コアロジック（チャットエンジン・分岐判定）はパッケージ分離

---

## 1. 技術スタック

### フロントエンド
- **アプリ**：React Native + Expo（SDK最新）
- **Web**：Next.js 15（App Router）+ React 19
- **共通**：TypeScript / Tailwind CSS（NativeWind for RN）/ shadcn/ui（Web）
- **状態管理**：Zustand（軽量・両環境で動く）
- **アイコン**：Lucide React / Lucide React Native

### バックエンド
- **API**：Hono on Cloudflare Workers（軽量・速い・安い）
  - 代替：Next.js Route Handlers（モノリポ簡略化したいなら）
- **DB**：Supabase（PostgreSQL + Auth + Realtime）
- **LLM**：Anthropic Claude API（`claude-sonnet-4-6` または最新）
- **画像生成**：キャラ画像は事前生成（NanoBanana / Seedream）→ Supabase Storage
- **認証**：Supabase Auth（Apple / Google / Email）

### インフラ
- Web デプロイ：Vercel
- アプリ配信：EAS Build → App Store / Google Play
- 環境変数管理：Doppler または .env + Vercel/EAS Secrets

### モノリポ構成
```
matchtrainer/
├── apps/
│   ├── mobile/        # Expo (React Native)
│   └── web/           # Next.js (お試し版)
├── packages/
│   ├── ui/            # 共通UIコンポーネント
│   ├── core/          # チャットエンジン・分岐判定ロジック
│   ├── api-client/    # Supabase / Claude API クライアント
│   └── types/         # 共通型定義
└── supabase/          # マイグレーション・Edge Functions
```
ツール：pnpm workspaces + Turborepo

---

## 2. 画面遷移・全体フロー

### Phase 1: オンボーディング（初回のみ）
```
Splash
  → 年齢確認（17+）
  → 利用規約 / プライバシーポリシー
  → アカウント作成（Apple / Google / Email）
  → プロフィール入力（スキップ可）
      ├ 年齢
      ├ 性別（自分）
      ├ 職業
      ├ 趣味タグ（複数選択）
      └ 自己PR文（任意）
  → チュートリアル（30秒・1ターンのデモ）
  → ホームへ
```

### Phase 2: ホーム（マッチングアプリ風）
- 下タブ4つ：`さがす` / `いいね` / `メッセージ` / `マイページ`
- メイン画面：**カードスワイプUI**
  - キャラカード：写真・名前・年齢・職業・地域・趣味タグ
  - 右スワイプ＝いいね、左スワイプ＝スキップ
- いいね → 自動マッチ演出（全キャラと必ずマッチする設計）

### Phase 3: マッチング演出
- 「○○さんとマッチしました！」フルスクリーンアニメーション
- 「メッセージを送る」CTA → チャット画面へ

### Phase 4: チャット（コア体験）
詳細は §4 参照

### Phase 5: エンディング
- グッドエンド：告白成功・LINE交換・デート成功 など
- バッドエンド：既読無視 / ブロック / 塩対応 / 業者疑い / ドタキャン etc

### Phase 6: 結果画面（Detroit式フローチャート）
- 通過したノードはハイライト
- 未踏ノードはシルエット + 🔒
- 累計クリア回数・全エンディング達成率
- CTA：
  - 「もう一度挑戦」（同キャラ・状態リセット）
  - 「他のキャラに挑戦」（ホームへ）
  - **「本物の出会いを試す」→ アフィリンク**（Pairs / with / Tinder）

### Phase 7: マイページ
- 累計プレイ統計
- 全エンディング達成率
- 解放済みキャラ一覧
- 自分のプロフィール編集
- 課金・サブスク管理

---

## 3. データモデル（Supabase / PostgreSQL）

### `users`
| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK / Supabase Auth と連携 |
| email | text | |
| created_at | timestamptz | |

### `user_profiles`
| カラム | 型 | 備考 |
|---|---|---|
| user_id | uuid | FK → users.id |
| age | int | nullable |
| gender | text | 'male' / 'female' / 'other' |
| job | text | |
| hobbies | text[] | タグ配列 |
| bio | text | 自己PR |

### `characters`
| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| name | text | |
| age | int | |
| job | text | |
| location | text | 例：東京都 |
| hobbies | text[] | |
| bio | text | プロフ文 |
| avatar_url | text | Supabase Storage |
| persona_prompt | text | system prompt 本体 |
| values_prompt | text | 価値観・NG項目定義 |
| difficulty | int | 1〜5 |
| is_premium | boolean | 課金キャラフラグ |

### `play_sessions`
| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| character_id | uuid | |
| started_at | timestamptz | |
| ended_at | timestamptz | nullable |
| ending_id | uuid | nullable / FK → endings.id |
| current_stage | text | 'greeting'/'chat'/'line_exchange'/'date_invite'/'date'/'confession' |
| affection_score | int | 0〜100 |
| skill_uses_remaining | int | デフォ3 |

### `messages`
| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | |
| role | text | 'user' / 'assistant' / 'system' |
| content | text | |
| metadata | jsonb | 思考内容・スコア変動など |
| created_at | timestamptz | |

### `endings`
| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | PK |
| character_id | uuid | |
| code | text | 'good_confession' / 'bad_blocked' / 'bad_silent' etc |
| type | text | 'good' / 'bad' |
| title | text | |
| description | text | |
| condition | jsonb | 到達条件（スコア・キーワード等） |

### `user_ending_unlocks`
| カラム | 型 | 備考 |
|---|---|---|
| user_id | uuid | |
| ending_id | uuid | |
| unlocked_at | timestamptz | |
| count | int | 何回到達したか |

---

## 4. チャット コアエンジン仕様

### 4.1 状態モデル
セッション開始時に以下を初期化：
```ts
type SessionState = {
  affectionScore: number;        // 0-100, 初期20
  currentStage: Stage;           // 'greeting'
  skillUsesRemaining: number;    // 3
  redFlagCount: number;          // NG言動カウント
  consecutiveRedFlags: number;   // 連続NGカウント
  topicHistory: string[];        // 既出トピック
  userProfile: UserProfile;
};

type Stage =
  | 'greeting'        // 挨拶
  | 'chat'            // 雑談
  | 'line_exchange'   // LINE交換
  | 'date_invite'     // デート誘い
  | 'date'            // デート当日
  | 'confession';     // 告白
```

### 4.2 メッセージ送信フロー
```
ユーザー入力
  ↓
1. 入力評価 (Claude API): {scoreDelta, isRedFlag, detectedKeywords, thoughtSummary}
  ↓
2. 状態更新 (affectionScore, redFlagCount, etc)
  ↓
3. バッドエンド判定 (連続NG3回 or score<=0 等)
  ├ 該当 → エンディング画面へ
  └ 非該当 ↓
4. ステージ遷移判定 (現stage到達条件チェック)
  ↓
5. キャラ返答生成 (Claude API): キャラpersona + 現状態 + 履歴
  ├ 既読無視判定: 一定確率で返信遅延・短文化
  ↓
6. UIへストリーミング表示
  ↓
7. 必要なら演出 (タイピング表示・既読マーク等)
```

### 4.3 評価プロンプト（入力評価用）
```
あなたは恋愛コーチです。以下のチャットで男性が送ったメッセージを、女性キャラの視点から評価してください。

【女性キャラ情報】
{character.persona_prompt}
{character.values_prompt}

【現在の関係性】
- ステージ: {stage}
- 好感度: {affectionScore}/100
- 累計NG回数: {redFlagCount}

【男性のプロフィール】
{userProfile}

【過去の会話】
{lastNMessages}

【今回の発言】
{userMessage}

以下の JSON で出力：
{
  "scoreDelta": -10〜+10,
  "isRedFlag": boolean,
  "redFlagReason": string | null,
  "detectedKeywords": string[],
  "thoughtSummary": string,  // 「なに考えてるの？」表示用、女性目線の本音
  "recommendedNextBehavior": "normal" | "short_reply" | "delayed_reply" | "ignore"
}
```

### 4.4 キャラ応答プロンプト
```
あなたは{character.name}（{character.age}歳・{character.job}）。
マッチングアプリで初マッチした男性とチャット中。

【あなたの人格】
{character.persona_prompt}

【あなたの価値観・許容ライン】
{character.values_prompt}

【現在の状態】
- 相手への好感度: {affectionScore}/100
- 関係ステージ: {stage}
- 直近の印象: {recommendedNextBehavior}

【絶対遵守ルール】
1. 忖度禁止：相手に気を使って楽しいフリをしない
2. 興味なくなったら自然に返信を短くする
3. 拒絶を直接伝えず、態度で示す（短文化・遅延・話題切り替え）
4. 自分の価値観に反する発言には冷たく反応
5. 相手のプロフを踏まえた質問・反応をする

【今回の状態指示】
{behavior_instruction_based_on_score}

返信を1〜3文で生成してください。LINE風の自然な口調で。
```

### 4.5 ステージ遷移ルール（ハイブリッド方式）
- 会話自体はAI生成
- ステージ遷移は**ルール判定**で安定化
```ts
// 例：LINE交換ステージへの遷移条件
{
  fromStage: 'chat',
  toStage: 'line_exchange',
  conditions: {
    minAffection: 50,
    minTurns: 8,
    requiredKeywordsAny: ['LINE', 'ライン', '連絡先'],
  }
}
```
全遷移ルールは `packages/core/src/stages.ts` に集約。

### 4.6 「なに考えてるの？」スキル
- 1セッション3回（無料・課金で増加）
- 発動時：直近の `thoughtSummary` を吹き出しで表示
- 演出：相手アイコン頭上に💭バルーン、3秒で消える
- スクショ防止：表示中はスクリーンショット警告（※iOS制約あり、完全防止は不可）
- 課金UX：「もう1回見たい？」CTA → アプリ内課金

### 4.7 バッドエンド トリガー条件
| エンディング | 条件 |
|---|---|
| 既読無視 | affection ≤ 10 が3ターン継続 |
| ブロック | redFlag重大級1回 or 軽微NG5連続 |
| 塩対応化 | affection 11〜30で長期停滞 |
| 業者疑い | URL送信 / 怪しい誘導文言検出 |
| ヤリモク認定 | 下心キーワード検出 + 早期デート誘い |
| ガチ恋気持ち悪い | 過剰な愛情表現を初期段階で連発 |
| 無風BAD（会話枯れ） | 同じ話題ループ・質問ゼロが続く |
| ドタキャン | デート当日ステージで相手の好感度低下 |

### 4.8 グッドエンド条件
- 告白成功：affection ≥ 80 + 全ステージ通過 + 告白フラグ
- LINE交換成功：affection ≥ 50 で交換ステージ突破
- デート成功：affection ≥ 70 でデート完走

---

## 5. UI/UX 設計指針

### 5.1 デザインの目標
**実際のマッチングアプリと完全に同じ体験**を再現することで没入感を最大化。
- ただし**実在アプリの完全コピーは避ける**（意匠権・不競法リスク）
- 雰囲気・配置・遷移パターンは踏襲しつつ、独自のビジュアル言語を持つ

### 5.2 デザインシステム
- iOS：Apple HIG 準拠
- Android：Material Design 3 準拠
- カラー：温かみのあるピンク/オレンジ系をプライマリ
- タイポ：システムフォント（San Francisco / Roboto）
- コンポーネント：shadcn/ui（Web） / NativeWind カスタム（RN）

### 5.3 主要画面コンポーネント
- `CharacterCard`：スワイプ可能なキャラカード
- `MatchAnimation`：マッチ成立フルスクリーン演出
- `ChatBubble`：吹き出し（ユーザー・相手・システム3種）
- `ThoughtBubble`：💭スキル発動時の本音バルーン
- `StageProgressBar`：上部の進行ステージ表示
- `SkillButton`：左下の💭ボタン（残回数バッジ付）
- `EndingScreen`：エンディング演出（タイプ別アニメ）
- `BranchTreeView`：Detroit風フローチャート

### 5.4 重要な演出
- **タイピング表示**（「...」アニメ）：返信中の没入感
- **既読/未読マーク**：マッチアプリ風
- **送信不可演出**：バッドエンド時の入力欄グレーアウト
- **ブロック演出**：「○○さんはあなたをブロックしました」モーダル
- **シルエット表示**：未踏ルートの🔒演出

---

## 6. キャラクター設計テンプレート

### 6.1 必須項目
```yaml
name: 結衣
age: 27
job: 広告代理店プランナー
location: 東京都港区
hobbies: [カフェ巡り, 映画鑑賞, ヨガ]
bio: |
  港区で働いています。最近ヨガにハマってます🧘‍♀️
  美味しいご飯屋さん教えてくれる人と仲良くなりたいです。
difficulty: 3
persona_prompt: |
  あなたは結衣、27歳の広告代理店プランナー。
  キャリア志向で自立している。仕事が忙しく、時間を大切にする。
  会話のテンポ感・知的な話題が好き。
  返信は基本的に簡潔で、絵文字は控えめ。
values_prompt: |
  【好きなタイプの言動】
  - 仕事の話を対等に聞いてくれる
  - 自分の意見を持っている
  - 適度な距離感を保てる

  【嫌いな言動】
  - タメ口（初回から）
  - 自分語りばかり
  - 「美人ですね」など外見への言及
  - 早すぎるデート誘い（5ターン以内）
  - 下心が透ける発言
  - 絵文字過多・長文

  【返信パターン】
  - 興味あるとき：質問返ししつつ自分の話も少し
  - 興味薄いとき：1〜2文の短い相槌
  - 不快なとき：話題を変えるか既読無視
```

### 6.2 MVP用キャララインナップ案
1. **結衣**（27歳・キャリア系）難易度★★★
2. **美咲**（24歳・看護師・癒し系）難易度★★
3. **彩花**（22歳・大学生・ギャル）難易度★★
4. **玲奈**（30歳・経営者・年上）難易度★★★★
5. **桃花**（19歳・専門学校生）難易度★★★（年齢ギャップ罠）

→ MVPは**1〜2人で出す**。キャラ作り込みが品質の命。

---

## 7. MVP スコープ

### 7.1 MVPに含める
- [x] オンボーディング（プロフ入力スキップ可）
- [x] ホーム（カードスワイプ）
- [x] マッチ演出
- [x] チャット画面（ストリーミング）
- [x] 「なに考えてるの？」スキル（3回）
- [x] ステージ進行（5段階）
- [x] グッドエンド1種 + バッドエンド5種
- [x] 結果画面（簡易フローチャート・5〜7ノード）
- [x] アフィリンク導線
- [x] キャラ1〜2人

### 7.2 MVPに含めない（後回し）
- [ ] 課金システム（最初は全機能無料で検証）
- [ ] 複数キャラ追加
- [ ] サブスク
- [ ] 高度な分岐ツリー（Detroit級）
- [ ] 配信者モード
- [ ] 学習履歴の高度な可視化
- [ ] SNS連携・シェア機能（v2）

### 7.3 開発フェーズ
| フェーズ | 期間目安 | 内容 |
|---|---|---|
| Phase 0 | 2〜3日 | モノリポ・スタック整備・Supabase初期化 |
| Phase 1 | 3〜5日 | コアエンジン（packages/core） |
| Phase 2 | 5〜7日 | Web版MVP（お試し1キャラ） |
| Phase 3 | 7〜10日 | Mobile版MVP（Expo） |
| Phase 4 | 3〜5日 | キャラ追加・チューニング |
| Phase 5 | 3〜5日 | アフィ導線・分析計測・ストア申請 |

合計：3〜4週間（けいすけ稼働具合次第）

---

## 8. ディレクトリ構成

```
matchtrainer/
├── apps/
│   ├── mobile/
│   │   ├── app/                    # Expo Router
│   │   │   ├── (onboarding)/
│   │   │   ├── (main)/
│   │   │   │   ├── home.tsx
│   │   │   │   ├── matches.tsx
│   │   │   │   └── profile.tsx
│   │   │   ├── chat/[sessionId].tsx
│   │   │   └── ending/[sessionId].tsx
│   │   ├── components/
│   │   └── package.json
│   │
│   └── web/
│       ├── app/                    # Next.js App Router
│       │   ├── (marketing)/        # LP
│       │   ├── try/                # お試し版本体
│       │   └── api/
│       ├── components/
│       └── package.json
│
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── engine.ts           # メインエンジン
│   │   │   ├── stages.ts           # ステージ遷移ルール
│   │   │   ├── endings.ts          # エンディング判定
│   │   │   ├── prompts.ts          # プロンプトテンプレ
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   ├── ui/                          # 共通UI（プラットフォーム別実装）
│   ├── api-client/                  # Supabase + Claude
│   └── types/                       # 共通型
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql                     # キャラデータ初期投入
│   └── functions/                   # Edge Functions（必要なら）
│
├── .claude/
│   ├── CLAUDE.md                    # プロジェクト指示
│   └── skills/
│       └── matchtrainer-dev/
│
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

---

## 9. 実装順序（Claude Code への指示）

### Step 1: 基盤構築
1. pnpm + Turborepo モノリポ初期化
2. `packages/types` で共通型定義
3. `packages/core` でエンジン雛形（テスト先行）
4. Supabase プロジェクト作成・マイグレーション・シードデータ

### Step 2: コアエンジン
1. `engine.ts`：状態管理・メッセージ処理パイプライン
2. `prompts.ts`：評価・応答プロンプトテンプレ
3. `stages.ts`：ステージ遷移ルール
4. `endings.ts`：エンディング判定
5. ユニットテスト（Vitest）：シナリオ別の状態遷移を検証

### Step 3: Web版（お試し）
1. Next.js 初期化・shadcn/ui セットアップ
2. ランディング → お試し開始 → チャット → エンディング → アフィCTA
3. 1キャラのみ・サインアップ不要（localStorage で十分）
4. Vercel デプロイ

### Step 4: Mobile版
1. Expo 初期化・Expo Router・NativeWind
2. オンボーディング・ホーム・マッチ演出
3. チャット画面（Web版と同じエンジンを利用）
4. エンディング・フローチャート
5. EAS Build で TestFlight / 内部テスト配布

### Step 5: 品質チューニング
1. プロンプト調整（実プレイで違和感あるところを潰す）
2. キャラ追加（2人目）
3. アナリティクス（PostHog or Mixpanel）
4. クラッシュ監視（Sentry）

### Step 6: ストア申請
1. App Store Connect / Google Play Console セットアップ
2. スクリーンショット・説明文・年齢制限17+
3. 審査対策：「練習用シミュレーター」の位置づけ明示

---

## 10. リスク・前提

### 技術リスク
- **Claude API のキャラ崩壊**：system prompt のチューニング次第。few-shot examples で安定化
- **「忖度なし」の難しさ**：RLHF傾向に逆らうため、塩対応サンプル20件以上を埋め込む
- **App Store 審査**：出会い系疑いで Reject の可能性。位置づけ・年齢制限を慎重に

### ビジネスリスク
- 競合（Character.AI 等）が同機能投入で一瞬で陳腐化
- アフィ規約変更・報酬率低下
- マッチングアプリ業界全体の縮小

### 前提
- Claude API 利用料：1セッション平均 $0.05〜0.15 想定
- 想定LTV：アフィCV1件で ¥1,000〜¥5,000 → 1〜3%CV で黒字化

---

## 11. このドキュメントの使い方（Claude Code 向け）

1. このファイルを `.claude/specs/SPEC.md` として配置
2. `.claude/CLAUDE.md` で「常にSPEC.md を参照すること」を指示
3. 各タスクごとに該当章を引用しながら実装
4. 実装中に矛盾が見つかった場合は SPEC.md を先に更新してから実装

---

## 12. 現在の暫定実装（Web 静的デモ）

> 本章は SPEC.md と現リポジトリ実装の差分メモ。MVP 検証段階の暫定であり、本来は §1・§8 の monorepo に移行予定。

### 12.1 配置
- リポジトリ：`ekusiek716/ekusiek716.github.io`（GitHub Pages 静的配信）
- 既存の `master` の `index.html` 等は個人ポートフォリオ。**触らない**。
- MatchTrainer は `matchtrainer/` 配下にのみ配置。`https://ekusiek716.github.io/matchtrainer/` で公開される想定。

### 12.2 構成
- ビルドステップ無し（素の HTML/CSS + ES Modules）
- AI バックエンドは API キー不要のモック（`matchtrainer/js/mockAI.js`）
- プロンプトテンプレ（§4.3, §4.4）は `matchtrainer/js/prompts.js` に保持し、将来 Claude API に差し替え可能
- 永続化は `localStorage` のみ（エンディング解放履歴）

### 12.3 暫定スコープ
- キャラ：結衣（§6.2 の 1 番）のみ
- ステージ：5 段階全て（greeting → chat → line_exchange → date_invite → date → confession）
- スキル「なに考えてるの？」：3 回
- グッドエンド：告白成功・LINE 交換成功・デート成功
- バッドエンド：既読無視・ブロック・塩対応・ヤリモク認定・ガチ恋気持ち悪い・業者疑い・無風

### 12.4 移行方針
- `matchtrainer/js/engine.js`, `stages.js`, `endings.js`, `prompts.js`, `mockAI.js` は **フレームワーク非依存の純粋ロジック**として書く。将来 `packages/core` にコピペ移行できる粒度を維持する。
- UI（`app.js`）はモノリポ移行時に Next.js / Expo の View 層に書き換え。

---

**最終更新**：2026-05-03
**バージョン**：v0.1.1（Web 静的デモ章追記）
