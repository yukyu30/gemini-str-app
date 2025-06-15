# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a Tauri desktop application built with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust (Tauri framework)
- **Build System**: Vite for frontend, Cargo for Rust backend

The application follows Tauri's standard structure:
- `src/` - React frontend code
- `src-tauri/` - Rust backend code and Tauri configuration
- Frontend communicates with backend via Tauri's `invoke()` API

## Development Commands

```bash
# Start development server (runs both frontend and backend)
npm run tauri dev

# Frontend only development
npm run dev

# Build application for production
npm run tauri build

# Build frontend only
npm run build

# Preview production build
npm run preview

# TypeScript compilation check
npx tsc --noEmit
```

## Key Configuration Files

- `src-tauri/tauri.conf.json` - Main Tauri configuration
- `src-tauri/Cargo.toml` - Rust dependencies and build settings  
- `package.json` - Frontend dependencies and npm scripts
- `vite.config.ts` - Vite configuration optimized for Tauri

## Tauri Command System

Backend functions are exposed to frontend via Tauri commands:
- Rust functions marked with `#[tauri::command]` in `src-tauri/src/lib.rs`
- Registered in the `invoke_handler` in the Tauri builder
- Called from frontend using `invoke("command_name", { args })`

Example: The `greet` command in `lib.rs:3` is called from `App.tsx:12`

### Rule
TDDの考え方を使い、実装を進めます。

- 与えられた命令について、タスクを作ってください。
- タスクを一つ選んで、サブタスクへ分解してから実装をしてください
- まずテストを作り、TDDで実装をすすめていきます
- 実装中は、1変更1コミットとなるようにし、Conventional Commitsのルールに従いコミットをしてください。また、Co Authorに'Claude pro'を指定してください。
- コミットをして次のタスクを実行する

### コミットのルール
- 1変更1コミットとなるようにし、Conventional Commitsのルールに従いコミットをしてください。
- Co Authorに'Claude pro'を指定してください。
