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
  enableAdvancedProcessing: boolean
  customDictionaryPath?: string
}

export interface SrtValidation {
  isValid: boolean
  errors: string[]
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
  // 高精度モード用
  dictionary?: string
  analyzedTopic?: string
}

export const DEFAULT_SRT_SETTINGS: SrtSettings = {
  maxCharsPerSubtitle: 20,
  enableSpeakerDetection: false,
  removeFillerWords: true,
  enableAdvancedProcessing: false,
  customDictionaryPath: undefined
}