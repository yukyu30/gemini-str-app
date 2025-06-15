import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import AudioUpload from './AudioUpload'
import { TRANSCRIPTION_PROMPTS, GEMINI_MODELS } from '../constants/prompts'
import './Transcription.css'

type TranscriptionType = 'basic' | 'srt' | 'summary'

interface TranscriptionState {
  file: File | null
  transcriptionType: TranscriptionType
  selectedModel: string
  isTranscribing: boolean
  result: string
  error: string
  progress: string
  copySuccess: boolean
}

const Transcription = () => {
  const [state, setState] = useState<TranscriptionState>({
    file: null,
    transcriptionType: 'basic',
    selectedModel: GEMINI_MODELS[0].id,
    isTranscribing: false,
    result: '',
    error: '',
    progress: '',
    copySuccess: false
  })

  const handleFileSelect = (file: File) => {
    setState(prev => ({
      ...prev,
      file,
      result: '',
      error: '',
      copySuccess: false
    }))
  }

  const handleFileError = (error: string) => {
    setState(prev => ({
      ...prev,
      error,
      file: null
    }))
  }

  const handleTranscriptionTypeChange = (type: TranscriptionType) => {
    setState(prev => ({ ...prev, transcriptionType: type }))
  }

  const handleModelChange = (modelId: string) => {
    setState(prev => ({ ...prev, selectedModel: modelId }))
  }

  const getPromptForType = (type: TranscriptionType): string => {
    switch (type) {
      case 'basic':
        return TRANSCRIPTION_PROMPTS.BASIC_TRANSCRIPT
      case 'srt':
        return TRANSCRIPTION_PROMPTS.SRT_FORMAT()
      case 'summary':
        return TRANSCRIPTION_PROMPTS.SUMMARY
      default:
        return TRANSCRIPTION_PROMPTS.BASIC_TRANSCRIPT
    }
  }

  const saveFileTemporarily = async (file: File): Promise<string> => {
    // In a real implementation, this would save the file to a temp location
    // For now, we'll use the file name as a placeholder
    // In Tauri, you'd typically use the fs plugin to save to a temp directory
    return file.name
  }

  const startTranscription = async () => {
    if (!state.file) return

    setState(prev => ({
      ...prev,
      isTranscribing: true,
      result: '',
      error: '',
      progress: 'ファイルを準備中...'
    }))

    try {
      // Save file temporarily
      const tempFilePath = await saveFileTemporarily(state.file)
      
      setState(prev => ({ ...prev, progress: 'Gemini APIにアップロード中...' }))
      
      const prompt = getPromptForType(state.transcriptionType)
      
      const result = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt,
        model: state.selectedModel
      })

      setState(prev => ({
        ...prev,
        isTranscribing: false,
        result,
        progress: ''
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isTranscribing: false,
        error: `エラーが発生しました: ${error}`,
        progress: ''
      }))
    }
  }

  const cancelTranscription = () => {
    setState(prev => ({
      ...prev,
      isTranscribing: false,
      progress: ''
    }))
  }

  const downloadResult = () => {
    if (!state.result) return

    const element = document.createElement('a')
    const file = new Blob([state.result], { type: 'text/plain' })
    element.href = URL.createObjectURL(file)
    element.download = `transcription_${Date.now()}.txt`
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    URL.revokeObjectURL(element.href)
  }

  const copyToClipboard = async () => {
    if (!state.result) return

    try {
      await navigator.clipboard.writeText(state.result)
      setState(prev => ({ ...prev, copySuccess: true }))
      setTimeout(() => {
        setState(prev => ({ ...prev, copySuccess: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <div className="transcription">
      <h2>音声文字起こし</h2>
      
      <div className="upload-section">
        <AudioUpload 
          onFileSelect={handleFileSelect}
          onError={handleFileError}
        />
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      {state.file && !state.isTranscribing && !state.result && (
        <div className="transcription-options">
          <h3>モデルを選択</h3>
          <div className="model-group">
            {GEMINI_MODELS.map((model) => (
              <label key={model.id} className="model-option">
                <input
                  type="radio"
                  name="selectedModel"
                  value={model.id}
                  checked={state.selectedModel === model.id}
                  onChange={() => handleModelChange(model.id)}
                />
                <span>{model.name}</span>
                <small>{model.description}</small>
              </label>
            ))}
          </div>

          <h3>文字起こしタイプを選択</h3>
          <div className="option-group">
            <label className="option">
              <input
                type="radio"
                name="transcriptionType"
                value="basic"
                checked={state.transcriptionType === 'basic'}
                onChange={() => handleTranscriptionTypeChange('basic')}
              />
              <span>基本的な文字起こし</span>
              <small>音声をそのまま文字に変換します</small>
            </label>
            
            <label className="option">
              <input
                type="radio"
                name="transcriptionType"
                value="srt"
                checked={state.transcriptionType === 'srt'}
                onChange={() => handleTranscriptionTypeChange('srt')}
              />
              <span>SRT字幕形式</span>
              <small>タイムスタンプ付きの字幕形式で出力します</small>
            </label>
            
            <label className="option">
              <input
                type="radio"
                name="transcriptionType"
                value="summary"
                checked={state.transcriptionType === 'summary'}
                onChange={() => handleTranscriptionTypeChange('summary')}
              />
              <span>要約</span>
              <small>音声内容を要約して出力します</small>
            </label>
          </div>

          <button 
            className="start-button"
            onClick={startTranscription}
            disabled={!state.file}
          >
            文字起こし開始
          </button>
        </div>
      )}

      {state.isTranscribing && (
        <div className="transcription-progress">
          <div className="progress-indicator">
            <div className="spinner"></div>
            <span>文字起こし中...</span>
          </div>
          <p className="progress-text">{state.progress}</p>
          <button 
            className="cancel-button"
            onClick={cancelTranscription}
          >
            キャンセル
          </button>
        </div>
      )}

      {state.result && (
        <div className="transcription-result">
          <h3>文字起こし結果</h3>
          <div className="result-actions">
            <button onClick={copyToClipboard} className="action-button">
              📋 クリップボードにコピー
            </button>
            <button onClick={downloadResult} className="action-button">
              💾 テキストファイルをダウンロード
            </button>
          </div>
          
          {state.copySuccess && (
            <div className="copy-success">
              クリップボードにコピーしました
            </div>
          )}
          
          <div className="result-content">
            <pre>{state.result}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transcription