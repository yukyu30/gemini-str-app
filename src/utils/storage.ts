// Simple encryption/decryption using base64 encoding
// Note: This is not cryptographically secure, but provides basic obfuscation
const STORAGE_KEY = 'gemini_api_key'
const SIMPLE_KEY = 'str-app-secret-2024'

// Simple XOR cipher for basic obfuscation
function simpleEncrypt(text: string, key: string): string {
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    const keyChar = key.charCodeAt(i % key.length)
    result += String.fromCharCode(char ^ keyChar)
  }
  return btoa(result) // Base64 encode
}

function simpleDecrypt(encryptedText: string, key: string): string {
  try {
    const decoded = atob(encryptedText) // Base64 decode
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      const char = decoded.charCodeAt(i)
      const keyChar = key.charCodeAt(i % key.length)
      result += String.fromCharCode(char ^ keyChar)
    }
    return result
  } catch (error) {
    console.error('Failed to decrypt:', error)
    return ''
  }
}

export const storageUtils = {
  saveApiKey: (apiKey: string): boolean => {
    try {
      if (!apiKey || apiKey.trim() === '') {
        localStorage.removeItem(STORAGE_KEY)
        return true
      }
      
      const encrypted = simpleEncrypt(apiKey.trim(), SIMPLE_KEY)
      localStorage.setItem(STORAGE_KEY, encrypted)
      console.log('API key saved to localStorage successfully')
      return true
    } catch (error) {
      console.error('Failed to save API key to localStorage:', error)
      return false
    }
  },

  getApiKey: (): string => {
    try {
      const encrypted = localStorage.getItem(STORAGE_KEY)
      if (!encrypted) {
        console.log('No API key found in localStorage')
        return ''
      }
      
      const decrypted = simpleDecrypt(encrypted, SIMPLE_KEY)
      console.log('API key retrieved from localStorage, length:', decrypted.length)
      return decrypted
    } catch (error) {
      console.error('Failed to retrieve API key from localStorage:', error)
      return ''
    }
  },

  getApiKeyPreview: (): string => {
    const apiKey = storageUtils.getApiKey()
    if (!apiKey) return ''
    
    if (apiKey.length > 4) {
      return `****${apiKey.slice(-4)}`
    } else {
      return '****'
    }
  },

  deleteApiKey: (): boolean => {
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log('API key removed from localStorage')
      return true
    } catch (error) {
      console.error('Failed to remove API key from localStorage:', error)
      return false
    }
  },

  hasApiKey: (): boolean => {
    return !!localStorage.getItem(STORAGE_KEY)
  }
}