import { useState, useEffect } from 'react'
import { storageUtils } from '../utils/storage'
import './Settings.css'

const Settings = () => {
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [apiKeyPreview, setApiKeyPreview] = useState('')

  useEffect(() => {
    loadApiKey()
  }, [])

  const loadApiKey = () => {
    try {
      console.log('Loading API key preview...')
      const preview = storageUtils.getApiKeyPreview()
      console.log('Preview result:', preview)
      
      if (preview && preview.trim()) {
        setHasExistingKey(true)
        setApiKeyPreview(preview)
        setApiKey('') // Don't show the actual key in the input
        console.log('API key exists, showing preview')
      } else {
        setHasExistingKey(false)
        setApiKeyPreview('')
        setApiKey('')
        console.log('No API key found')
      }
    } catch (error) {
      console.error('Failed to load API key:', error)
      setHasExistingKey(false)
      setApiKeyPreview('')
    }
  }

  const debugStorage = () => {
    try {
      const hasKey = storageUtils.hasApiKey()
      const preview = storageUtils.getApiKeyPreview()
      const actualKey = storageUtils.getApiKey()
      
      const debug = `localStorage Debug:
- Has API key: ${hasKey}
- Preview: ${preview}
- Actual key length: ${actualKey.length}
- First 10 chars: ${actualKey.slice(0, 10)}`
      
      console.log('Debug storage result:', debug)
      setMessage(debug)
    } catch (error) {
      console.error('Debug storage error:', error)
      setMessage(`Debug error: ${error}`)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      console.log('Saving API key, length:', apiKey.length)
      const success = storageUtils.saveApiKey(apiKey)
      
      if (success) {
        console.log('API key saved successfully')
        setMessage('API Keyが保存されました')
        
        // Reload the preview immediately
        loadApiKey()
      } else {
        setMessage('保存に失敗しました')
      }
    } catch (error) {
      setMessage(`保存に失敗しました: ${error}`)
      console.error('Failed to save API key:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="settings-container">
      <h2>設定</h2>
      
      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
          <label htmlFor="api-key">Gemini API Key</label>
          
          {hasExistingKey && (
            <div className="api-key-status">
              <span className="status-text">✅ API Key設定済み: {apiKeyPreview}</span>
              <button
                type="button"
                onClick={() => setHasExistingKey(false)}
                className="change-key-btn"
              >
                変更
              </button>
            </div>
          )}
          {!hasExistingKey && (
            <div className="input-group">
              <input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Gemini API Keyを入力してください"
                required
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="toggle-visibility"
                aria-label={showApiKey ? 'API Keyを隠す' : 'API Keyを表示'}
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className={`message ${message.includes('失敗') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        {!hasExistingKey && (
          <button type="submit" disabled={isLoading || !apiKey.trim()}>
            {isLoading ? '保存中...' : '保存'}
          </button>
        )}
        
        <div className="debug-section">
          <button type="button" onClick={debugStorage} className="debug-btn">
            ストレージ状態をチェック
          </button>
          <button type="button" onClick={loadApiKey} className="debug-btn">
            プレビューを再読み込み
          </button>
        </div>
      </form>
    </div>
  )
}

export default Settings