export interface SrtSubtitle {
  index: number
  startTime: string
  endTime: string
  text: string
}

export interface SrtSettings {
  maxCharsPerSubtitle: number
  enableSpeakerDetection: boolean
  removeFillerWords: boolean
  model: string
  enableAdvancedProcessing: boolean
  customDictionaryPath?: string
}

export interface SrtValidation {
  isValid: boolean
  errors: string[]
}

export interface ProcessingStage {
  name: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: string
  error?: string
}

export interface AudioFile {
  id: string
  file: File
  settings: SrtSettings
  status: 'idle' | 'processing' | 'completed' | 'error'
  result?: string
  subtitles?: SrtSubtitle[]
  error?: string
  progress?: string
  srtValidation?: SrtValidation
  // 多段階処理の情報
  stages?: {
    initialTranscription?: ProcessingStage
    topicAnalysis?: ProcessingStage
    dictionaryCreation?: ProcessingStage
    finalTranscription?: ProcessingStage
  }
  analyzedTopic?: string
  dictionary?: string
  // Geminiデバッグ情報
  geminiDebugInfo?: {
    initialTranscription?: { request: any; response: any }
    topicAnalysis?: { request: any; response: any }
    dictionaryCreation?: { request: any; response: any }
    finalTranscription?: { request: any; response: any }
  }
}

export const DEFAULT_SRT_SETTINGS: SrtSettings = {
  maxCharsPerSubtitle: 20,
  enableSpeakerDetection: false, // デフォルトを false に変更
  removeFillerWords: true,
  model: 'gemini-2.0-flash',
  enableAdvancedProcessing: false,
  customDictionaryPath: undefined
}