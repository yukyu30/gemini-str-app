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