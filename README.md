# Web検索連携 字幕文字起こしアプリ

**Gemini API**と**Web検索**を組み合わせた、高精度な字幕文字起こしデスクトップアプリです。

## 特徴

- 🎵 **音声ファイルから字幕生成**: m4a、mp3等の音声ファイルを読み込んでSRT字幕を生成
- 🔍 **Web検索による精度向上**: 話題から固有名詞・専門用語を抽出してGoogle検索で辞書を作成
- 🤖 **複数のGeminiモデル活用**: 用途に応じて最適なモデルを使い分け
- 📱 **デスクトップアプリ**: Tauriによるクロスプラットフォーム対応

## 処理フロー

1. **音声文字起こし** - Gemini 2.5 Proで初回文字起こし
2. **話題抽出** - Gemini 2.0 Flashで重要キーワードを抽出  
3. **辞書作成** - Google検索で固有名詞・専門用語の正確な表記を調査
4. **最終字幕生成** - 辞書を参照してより正確な字幕を生成

## 技術構成

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Rust (Tauri framework)
- **API**: Google Gemini API

## セットアップ

### 必要な環境

- Node.js 18以上
- Rust (最新安定版)
- Tauri CLI

### 1. リポジトリをクローン

```bash
git clone https://github.com/yukyu30/gemini-str-app.git
cd gemini-str-app
```

### 2. 依存関係をインストール

```bash
npm install
```


**APIキーの入手方法:**
1. [Google AI Studio](https://aistudio.google.com/u/1/apikey) にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリックしてAPIキーを生成
4. 生成されたAPIキーをアプリの設定画面から登録

### 4. 開発環境の起動

```bash
npm run tauri dev
```

これでアプリケーションが起動し、開発モードで動作確認できます。

## 使い方

1. アプリを起動
2. 「音声ファイルを選択」ボタンから音声ファイル（m4a、mp3等）を選択
3. 「文字起こし開始」ボタンをクリック
4. 処理完了後、生成された字幕（SRT形式）がダウンロードフォルダに保存されます

## ビルド


### 本番用ビルド（実行ファイル生成）
```bash
npm run tauri build
```


## 関連記事

[Web検索を組み合わせた文字起こしアプリを作ってみた](https://zenn.dev/yu_9/articles/a63374835c7af0)
