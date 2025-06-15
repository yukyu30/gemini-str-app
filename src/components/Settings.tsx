import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import './Settings.css'

const Settings = () => {
  const [apiKey, setApiKey] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadApiKey()
  }, [])

  const loadApiKey = async () => {
    try {
      const key = await invoke<string>('get_api_key')
      setApiKey(key || '')
    } catch (error) {
      console.error('Failed to load API key:', error)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      await invoke('set_api_key', { apiKey })
      setMessage('API Keyが保存されました')
    } catch (error) {
      setMessage('保存に失敗しました')
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
        </div>

        {message && (
          <div className={`message ${message.includes('失敗') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <button type="submit" disabled={isLoading || !apiKey.trim()}>
          {isLoading ? '保存中...' : '保存'}
        </button>
      </form>
    </div>
  )
}

export default Settings