# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a new Gemini-based application project. The project structure and architecture are still being established.

## Development Commands

*Note: Development commands will be added as the project setup is completed.*

## Architecture

*Note: Architecture details will be documented as the codebase develops.*


### Environment Variables
- `GEMINI_API_KEY` - Google Gemini API key (required, server-side only for security)

### Key Features
- Audio file upload (supports all audio/* formats, max 1GB)
- Files API integration for large file handling (>20MB recommended, required for >20MB)
- Real-time transcription using Google Gemini 2.0 Flash
- Copy to clipboard functionality
- Download transcription as TXT file
- Error handling and loading states
- Responsive design with Tailwind CSS
- Comprehensive test coverage with TDD approach (39 tests)
- Secure server-side API implementation

### Path Aliases
- `@/*` maps to `./src/*` for imports

### Rule
TDDの考え方を使い、実装を進めます。

- 与えられた命令について、タスクを作ってください。
- タスクを一つ選んで、サブタスクへ分解してから実装をしてください
- まずテストを作り、TDDで実装をすすめていきます
- 実装中は、1変更1コミットとなるようにし、Conventional Commitsのルールに従いコミットをしてください。また、Co Authorに'Claude pro'を指定してください。

### コミットのルール
- 1変更1コミットとなるようにし、Conventional Commitsのルールに従いコミットをしてください。
- Co Authorに'Claude pro'を指定してください。
