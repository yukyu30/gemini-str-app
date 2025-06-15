import { AudioFile } from '@/types/srt'

const HISTORY_STORAGE_KEY = 'srt_transcription_history'
const MAX_HISTORY_ITEMS = 50 // 最大保存件数

interface TranscriptionHistoryItem {
  id: string
  fileName: string
  fileSize: number
  settings: AudioFile['settings']
  status: AudioFile['status']
  result?: string
  subtitles?: AudioFile['subtitles']
  error?: string
  srtValidation?: AudioFile['srtValidation']
  timestamp: number
  completedAt?: number
}

export const transcriptionHistory = {
  // 履歴を保存
  saveItem: (audioFile: AudioFile): void => {
    try {
      const history = transcriptionHistory.loadHistory()
      
      const historyItem: TranscriptionHistoryItem = {
        id: audioFile.id,
        fileName: audioFile.file.name,
        fileSize: audioFile.file.size,
        settings: audioFile.settings,
        status: audioFile.status,
        result: audioFile.result,
        subtitles: audioFile.subtitles,
        error: audioFile.error,
        srtValidation: audioFile.srtValidation,
        timestamp: Date.now(),
        completedAt: audioFile.status === 'completed' ? Date.now() : undefined
      }
      
      // 既存のアイテムを更新するか、新しいアイテムを追加
      const existingIndex = history.findIndex(item => item.id === audioFile.id)
      if (existingIndex >= 0) {
        history[existingIndex] = historyItem
      } else {
        history.unshift(historyItem) // 新しいアイテムを先頭に追加
      }
      
      // 最大件数を超えた場合は古いものを削除
      if (history.length > MAX_HISTORY_ITEMS) {
        history.splice(MAX_HISTORY_ITEMS)
      }
      
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
      console.log('Transcription history saved for:', audioFile.file.name)
    } catch (error) {
      console.error('Failed to save transcription history:', error)
    }
  },

  // 履歴を読み込み
  loadHistory: (): TranscriptionHistoryItem[] => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        const history = JSON.parse(stored) as TranscriptionHistoryItem[]
        // 日付順にソート（新しい順）
        return history.sort((a, b) => b.timestamp - a.timestamp)
      }
    } catch (error) {
      console.error('Failed to load transcription history:', error)
    }
    return []
  },

  // 特定のアイテムを履歴から復元
  restoreItem: (historyItem: TranscriptionHistoryItem): AudioFile | null => {
    try {
      // FileオブジェクトはserializeできないのでダミーのFileを作成
      const dummyFile = new File([''], historyItem.fileName, { 
        type: 'audio/wav' // デフォルトタイプ
      })
      
      const audioFile: AudioFile = {
        id: historyItem.id,
        file: dummyFile,
        settings: historyItem.settings,
        status: historyItem.status,
        result: historyItem.result,
        subtitles: historyItem.subtitles,
        error: historyItem.error,
        srtValidation: historyItem.srtValidation,
        progress: undefined
      }
      
      console.log('Restored audio file from history:', historyItem.fileName)
      return audioFile
    } catch (error) {
      console.error('Failed to restore transcription item:', error)
      return null
    }
  },

  // 特定のアイテムを削除
  removeItem: (id: string): void => {
    try {
      const history = transcriptionHistory.loadHistory()
      const filtered = history.filter(item => item.id !== id)
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered))
      console.log('Removed item from history:', id)
    } catch (error) {
      console.error('Failed to remove history item:', error)
    }
  },

  // 履歴をクリア
  clearHistory: (): void => {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY)
      console.log('Transcription history cleared')
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  },

  // 完了したアイテムのみを取得
  getCompletedItems: (): TranscriptionHistoryItem[] => {
    return transcriptionHistory.loadHistory().filter(item => item.status === 'completed')
  },

  // 履歴統計を取得
  getStats: (): { total: number; completed: number; failed: number } => {
    const history = transcriptionHistory.loadHistory()
    return {
      total: history.length,
      completed: history.filter(item => item.status === 'completed').length,
      failed: history.filter(item => item.status === 'error').length
    }
  }
}

export type { TranscriptionHistoryItem }