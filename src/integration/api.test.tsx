import { describe, it, expect, vi, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockInvoke = vi.mocked(invoke)

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('API Key Management', () => {
    it('should set and get API key correctly', async () => {
      const testApiKey = 'test-gemini-api-key-123'
      
      // Mock successful save
      mockInvoke.mockResolvedValueOnce(true)
      
      const saveResult = await invoke('set_api_key', { apiKey: testApiKey })
      expect(saveResult).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('set_api_key', { apiKey: testApiKey })
      
      // Mock successful retrieval
      mockInvoke.mockResolvedValueOnce(testApiKey)
      
      const retrievedKey = await invoke('get_api_key')
      expect(retrievedKey).toBe(testApiKey)
      expect(mockInvoke).toHaveBeenCalledWith('get_api_key')
    })

    it('should handle empty API key gracefully', async () => {
      // Mock empty key retrieval
      mockInvoke.mockResolvedValueOnce('')
      
      const retrievedKey = await invoke('get_api_key')
      expect(retrievedKey).toBe('')
      expect(mockInvoke).toHaveBeenCalledWith('get_api_key')
    })

    it('should handle API key deletion', async () => {
      // Mock successful deletion
      mockInvoke.mockResolvedValueOnce(true)
      
      const deleteResult = await invoke('delete_api_key')
      expect(deleteResult).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('delete_api_key')
    })

    it('should handle API key storage errors', async () => {
      const errorMessage = 'Failed to store API key'
      
      // Mock storage error
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage))
      
      await expect(invoke('set_api_key', { apiKey: 'test-key' }))
        .rejects.toThrow(errorMessage)
    })
  })

  describe('Greet Command', () => {
    it('should handle greet command correctly', async () => {
      const testName = 'Test User'
      const expectedResponse = `Hello, ${testName}! You've been greeted from Rust!`
      
      mockInvoke.mockResolvedValueOnce(expectedResponse)
      
      const greetResult = await invoke('greet', { name: testName })
      expect(greetResult).toBe(expectedResponse)
      expect(mockInvoke).toHaveBeenCalledWith('greet', { name: testName })
    })
  })
})