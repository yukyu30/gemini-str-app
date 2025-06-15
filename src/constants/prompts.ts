export const TRANSCRIPTION_PROMPTS = {
  BASIC_TRANSCRIPT: "Generate a transcript of the speech.",
  
  SRT_FORMAT: (duration?: string) => `提供する音声（または動画）ファイルの内容を、高品質なSRT（SubRip Text）ファイル形式で文字起こししてください。${duration ? `\n\n**音声ファイルの長さ: ${duration}**` : ''}

# 1. SRTファイルの基本構造について

まず、納品していただくSRTファイルの構造について共通認識を持つために、基本的なルールを説明します。SRTファイルは、以下の4つの要素が1セットとなって構成されるテキストファイルです。

1.  **通し番号:** \`1\`から始まる字幕の連番です。
2.  **タイムスタンプ:** \`時:分:秒,ミリ秒 --> 時:分:秒,ミリ秒\` の形式で、字幕の表示開始時間と終了時間を指定します。（例: \`00:01:23,456 --> 00:01:28,912\`）
3.  **字幕テキスト:** 画面に表示する文章です。
4.  **空行:** 各字幕ブロックを区切るための、何も書かれていない行です。必ず必要です

**【具体例】**
1
00:00:05,520 --> 00:00:08,910
これは1番目の字幕の
テキストです。

2
00:00:09,150 --> 00:00:11,300
そして、これが2番目の字幕です。

この構造を厳密に守ってファイルを作成してください。

# 2. 文字起こしの詳細なルール

上記の基本構造を踏まえ、以下の詳細なルールに従って作業を進めてください。

1.  **タイムスタンプの精度**
    - \`hh:mm:ss,ms\` の形式を厳守し、ミリ秒は3桁で記述してください。
    - 音声の発話タイミングと字幕の表示タイミングを正確に一致させてください。

2.  **字幕テキストの編集ルール**
    - **文字数制限:** 1つの字幕ブロック（通し番号1つにつき）のテキストは、**20文字以内**を目安にしてください。長くなる場合は、意味の区切りが良い箇所で改行するなど、読みやすさを最優先してください。
    - **フィラーワードの削除:** 会話中の「えーっと」「あのー」「なんか」といった、意味を持たないフィラーワードはすべて削除し、自然で聞き取りやすい文章にしてください。
    - **話者の区別:** 会話に複数の話者がいる場合は、各字幕の先頭に話者名を明記してください。（例: \`アオイ: \`、\`ユーザー: \`）`,

  TIME_RANGE_TRANSCRIPT: (startTime: string, endTime: string) => 
    `Provide a transcript of the speech from ${startTime} to ${endTime}.`,
    
  SUMMARY: "Please summarize the audio.",
  
  DESCRIPTION: "Describe this audio clip"
} as const;

export const SUPPORTED_AUDIO_FORMATS = [
  'audio/wav',
  'audio/x-wav',
  'audio/mp3', 
  'audio/aiff',
  'audio/aac',
  'audio/ogg',
  'audio/flac'
] as const;

export const GEMINI_MODELS = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: '高速で費用効率的'
  },
  {
    id: 'gemini-2.5-pro-preview-06-05',
    name: 'Gemini 2.5 Pro Preview',
    description: '最新のプレビューモデル'
  }
] as const;

export const API_LIMITS = {
  MAX_FILE_SIZE_MB: 1024, // 1GB for Files API
  MAX_INLINE_SIZE_MB: 20,  // 20MB for inline data
  MAX_AUDIO_DURATION_HOURS: 9.5,
  TOKENS_PER_SECOND: 32
} as const;
