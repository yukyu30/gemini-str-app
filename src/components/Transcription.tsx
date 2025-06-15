import { useState } from 'react'
import AudioFileCard, { AudioFileData, TranscriptionType } from './AudioFileCard'
import FileDropZone from './FileDropZone'
import { GEMINI_MODELS } from '../constants/prompts'
import './Transcription.css'

const Transcription = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFileData[]>([])
  const [globalError, setGlobalError] = useState('')
  const [globalSettings, setGlobalSettings] = useState<{
    defaultModel: string
    defaultTranscriptionType: TranscriptionType
  }>({
    defaultModel: GEMINI_MODELS[0].id,
    defaultTranscriptionType: 'basic'
  })

  const handleFilesAdded = (files: File[]) => {
    const newAudioFiles = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      transcriptionType: globalSettings.defaultTranscriptionType,
      selectedModel: globalSettings.defaultModel,
      status: 'idle' as const,
      result: '',
      error: '',
      progress: ''
    }))

    setAudioFiles(prev => [...prev, ...newAudioFiles])
    setGlobalError('')
  }

  const handleFileUpdate = (id: string, updates: Partial<AudioFileData>) => {
    setAudioFiles(prev => 
      prev.map(file => 
        file.id === id ? { ...file, ...updates } : file
      )
    )
  }

  const handleFileDelete = (id: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== id))
  }

  const handleFileError = (error: string) => {
    setGlobalError(error)
  }

  const handleBulkAction = (action: 'start' | 'retry' | 'delete') => {
    switch (action) {
      case 'start':
        audioFiles
          .filter(audioFile => audioFile.status === 'idle')
          .forEach(() => {
            // Trigger transcription for each idle file
            // This will be handled by individual AudioFileCard components
          })
        break
      case 'retry':
        audioFiles
          .filter(audioFile => audioFile.status === 'error')
          .forEach(audioFile => {
            handleFileUpdate(audioFile.id, { status: 'idle' })
          })
        break
      case 'delete':
        setAudioFiles(prev => prev.filter(audioFile => audioFile.status !== 'completed'))
        break
    }
  }

  const getStatusCounts = () => {
    const counts = {
      idle: 0,
      processing: 0,
      completed: 0,
      error: 0
    }
    
    audioFiles.forEach(file => {
      counts[file.status]++
    })
    
    return counts
  }

  const applyGlobalSettings = () => {
    setAudioFiles(prev => 
      prev.map(file => ({
        ...file,
        transcriptionType: globalSettings.defaultTranscriptionType,
        selectedModel: globalSettings.defaultModel
      }))
    )
  }

  const statusCounts = getStatusCounts()

  return (
    <div className="transcription">
      <h2>音声文字起こし</h2>
      
      <FileDropZone 
        onFilesAdded={handleFilesAdded}
        onError={handleFileError}
      />

      {globalError && (
        <div className="error-message">
          {globalError}
        </div>
      )}

      {audioFiles.length > 0 && (
        <>
          <div className="control-panel">
            <div className="status-summary">
              <span className="status-item">待機中: {statusCounts.idle}</span>
              <span className="status-item">処理中: {statusCounts.processing}</span>
              <span className="status-item">完了: {statusCounts.completed}</span>
              <span className="status-item">エラー: {statusCounts.error}</span>
            </div>
            
            <div className="global-settings">
              <div className="setting-group">
                <label>デフォルトモデル</label>
                <select
                  value={globalSettings.defaultModel}
                  onChange={(e) => setGlobalSettings(prev => ({ 
                    ...prev, 
                    defaultModel: e.target.value 
                  }))}
                >
                  {GEMINI_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="setting-group">
                <label>デフォルトタイプ</label>
                <select
                  value={globalSettings.defaultTranscriptionType}
                  onChange={(e) => setGlobalSettings(prev => ({ 
                    ...prev, 
                    defaultTranscriptionType: e.target.value as TranscriptionType 
                  }))}
                >
                  <option value="basic">基本的な文字起こし</option>
                  <option value="srt">SRT字幕形式</option>
                  <option value="summary">要約</option>
                </select>
              </div>
              
              <button 
                className="apply-settings-btn"
                onClick={applyGlobalSettings}
              >
                設定を全ファイルに適用
              </button>
            </div>
            
            <div className="bulk-actions">
              {statusCounts.error > 0 && (
                <button 
                  className="bulk-btn retry-btn"
                  onClick={() => handleBulkAction('retry')}
                >
                  エラーファイルを再試行
                </button>
              )}
              {statusCounts.completed > 0 && (
                <button 
                  className="bulk-btn delete-btn"
                  onClick={() => handleBulkAction('delete')}
                >
                  完了ファイルを削除
                </button>
              )}
            </div>
          </div>

          <div className="audio-files-list">
            {audioFiles.map(fileData => (
              <AudioFileCard
                key={fileData.id}
                fileData={fileData}
                onUpdate={handleFileUpdate}
                onDelete={handleFileDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Transcription