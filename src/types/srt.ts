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
}

export const DEFAULT_SRT_SETTINGS: SrtSettings = {
  maxCharsPerSubtitle: 20,
  enableSpeakerDetection: true,
  removeFillerWords: true,
  model: 'gemini-2.0-flash'
}