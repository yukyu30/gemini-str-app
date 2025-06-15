import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { GEMINI_MODELS } from '../constants/config'
import { storageUtils } from '../utils/storage'
import './AudioFileCard.css'

export type TranscriptionType = 'basic' | 'srt' | 'summary'
export type ProcessingStatus = 'idle' | 'processing' | 'completed' | 'error'

export interface AudioFileData {
  id: string
  file: File
  transcriptionType: TranscriptionType
  selectedModel: string
  status: ProcessingStatus
  result: string
  error: string
  progress: string
}

interface AudioFileCardProps {
  fileData: AudioFileData
  onUpdate: (id: string, updates: Partial<AudioFileData>) => void
  onDelete: (id: string) => void
}

const AudioFileCard = ({ fileData, onUpdate, onDelete }: AudioFileCardProps) => {
  const [showResult, setShowResult] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }


  const saveFileTemporarily = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const tempFilePath = await invoke<string>('save_temp_file', {
      fileData: Array.from(uint8Array),
      fileName: file.name
    })
    
    return tempFilePath
  }

  const startTranscription = async () => {
    const apiKey = storageUtils.getApiKey()
    if (!apiKey) {
      onUpdate(fileData.id, {
        status: 'error',
        error: 'API key not found. Please set your Gemini API key in settings.'
      })
      return
    }

    onUpdate(fileData.id, {
      status: 'processing',
      error: '',
      progress: 'ファイルを準備中...'
    })

    try {
      const tempFilePath = await saveFileTemporarily(fileData.file)
      
      onUpdate(fileData.id, { progress: 'Gemini APIにアップロード中...' })
      
      const result = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        maxCharsPerSubtitle: 20, // デフォルト値
        enableSpeakerDetection: false, // デフォルト値  
        durationMs: null,
        model: fileData.selectedModel,
        apiKey
      })

      onUpdate(fileData.id, {
        status: 'completed',
        result,
        progress: ''
      })
    } catch (error) {
      onUpdate(fileData.id, {
        status: 'error',
        error: `エラーが発生しました: ${error}`,
        progress: ''
      })
    }
  }

  const retryTranscription = () => {
    startTranscription()
  }

  const copyToClipboard = async () => {
    if (!fileData.result) return

    try {
      await navigator.clipboard.writeText(fileData.result)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const downloadResult = () => {
    if (!fileData.result) return

    const element = document.createElement('a')
    const file = new Blob([fileData.result], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `transcription_${fileData.file.name}_${Date.now()}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  const getStatusColor = () => {
    switch (fileData.status) {
      case 'idle': return '#6c757d'
      case 'processing': return '#007bff'
      case 'completed': return '#28a745'
      case 'error': return '#dc3545'
      default: return '#6c757d'
    }
  }

  const getStatusText = () => {
    switch (fileData.status) {
      case 'idle': return '待機中'
      case 'processing': return '処理中'
      case 'completed': return '完了'
      case 'error': return 'エラー'
      default: return '不明'
    }
  }

  return (
    <div className="audio-file-card">
      <div className="card-header">
        <div className="file-info">
          <h3 className="file-name">{fileData.file.name}</h3>
          <div className="file-meta">
            <span className="file-size">{formatFileSize(fileData.file.size)}</span>
            <span 
              className="status-badge" 
              style={{ backgroundColor: getStatusColor() }}
            >
              {getStatusText()}
            </span>
          </div>
        </div>
        <button 
          className="delete-btn"
          onClick={() => onDelete(fileData.id)}
          disabled={fileData.status === 'processing'}
        >
          ×
        </button>
      </div>

      <div className="card-content">
        {fileData.status === 'processing' && (
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <p className="progress-text">{fileData.progress}</p>
          </div>
        )}

        {fileData.status === 'error' && (
          <div className="error-section">
            <p className="error-message">{fileData.error}</p>
            <button className="retry-btn" onClick={retryTranscription}>
              再試行
            </button>
          </div>
        )}

        {fileData.status !== 'processing' && (
          <div className="settings-section">
            <div className="setting-group">
              <label>モデル</label>
              <select
                value={fileData.selectedModel}
                onChange={(e) => onUpdate(fileData.id, { selectedModel: e.target.value })}
              >
                {GEMINI_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="setting-group">
              <label>文字起こしタイプ</label>
              <select
                value={fileData.transcriptionType}
                onChange={(e) => onUpdate(fileData.id, { 
                  transcriptionType: e.target.value as TranscriptionType 
                })}
              >
                <option value="basic">基本的な文字起こし</option>
                <option value="srt">SRT字幕形式</option>
                <option value="summary">要約</option>
              </select>
            </div>
          </div>
        )}

        <div className="action-section">
          {fileData.status === 'idle' && (
            <button className="primary-btn" onClick={startTranscription}>
              文字起こし開始
            </button>
          )}

          {fileData.status === 'completed' && (
            <>
              <button className="primary-btn" onClick={retryTranscription}>
                再実行
              </button>
              <button 
                className="secondary-btn" 
                onClick={() => setShowResult(!showResult)}
              >
                {showResult ? '結果を隠す' : '結果を表示'}
              </button>
            </>
          )}
        </div>

        {fileData.status === 'completed' && showResult && (
          <div className="result-section">
            <div className="result-actions">
              <button onClick={copyToClipboard} className="action-btn">
                📋 コピー
              </button>
              <button onClick={downloadResult} className="action-btn">
                💾 ダウンロード
              </button>
            </div>
            
            {copySuccess && (
              <div className="copy-success">
                クリップボードにコピーしました
              </div>
            )}
            
            <div className="result-content">
              <pre>{fileData.result}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AudioFileCard