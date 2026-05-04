# CLAUDE.md — MatchTrainer 開発ガイド

このリポジトリでは **MatchTrainer**（マッチングアプリ練習AI）を開発しています。

## 必読

すべてのタスクで `./specs/SPEC.md` を Source of Truth として参照してください。
矛盾が見つかったら **SPEC.md を先に更新** → 実装の順序です。

## ブランチ運用

- 開発：`claude/matchtrainer-app-*`
- マージ先：`master`
- 既存の `master` には個人ポートフォリオの `index.html` がある。誤って上書きしないこと。
- MatchTrainer のコードは `matchtrainer/` 配下にまとめる（GitHub Pages の同居運用）。

## 現状のリポジトリ構成

```
/
├── index.html, *.css, *.png, *.jpg   # 既存ポートフォリオ（触らない）
├── matchtrainer/                     # MatchTrainer 本体
│   ├── index.html                    # ランディング
│   ├── app.html                      # マッチ→チャット→エンディング
│   ├── styles.css
│   └── js/
│       ├── characters.js   # キャラ定義
│       ├── stages.js       # ステージ遷移ルール
│       ├── endings.js      # エンディング判定
│       ├── prompts.js      # Claude API 用プロンプトテンプレ
│       ├── mockAI.js       # API キー無しのモック応答
│       ├── engine.js       # チャットコアエンジン
│       └── app.js          # UI コントローラー
└── .claude/
    ├── CLAUDE.md           # このファイル
    └── specs/SPEC.md       # 仕様書本体
```

## 設計原則

- **エンジンと UI を分離**：`engine.js` 以下はフレームワーク非依存の純粋ロジック。将来 `packages/core` に切り出せる。
- **AI バックエンドは差し替え可能**：今は `mockAI.js`、将来 Claude API に切り替える際は同じインターフェース（`evaluateInput`, `generateReply`）を実装する。
- **ステージ遷移はルールベース**：会話自体は AI 任せでも、ステージ進行は仕様 §4.5 のルールで制御する。

## デプロイ

GitHub Pages（master）。`https://ekusiek716.github.io/matchtrainer/` で公開される想定。
ビルドステップ無し（ES Modules + 素の HTML/CSS）。

## 将来の移行

仕様 §1・§8 の monorepo（pnpm + Turborepo + Expo + Next.js + Supabase）へ移すのは MVP 検証後。
それまでは静的サイト構成のままで OK。
