import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import Settings from './Settings'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockInvoke = vi.mocked(invoke)

describe('Settings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders settings form with API key input', () => {
    render(<Settings />)
    
    expect(screen.getByText('設定')).toBeInTheDocument()
    expect(screen.getByLabelText('Gemini API Key')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('loads existing API key on mount', async () => {
    const mockApiKey = 'test-api-key-123'
    mockInvoke.mockResolvedValueOnce(mockApiKey)

    render(<Settings />)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_api_key')
    })

    await waitFor(() => {
      expect(screen.getByDisplayValue(mockApiKey)).toBeInTheDocument()
    })
  })

  it('saves API key when form is submitted', async () => {
    mockInvoke.mockResolvedValueOnce('') // Initial load
    mockInvoke.mockResolvedValueOnce(true) // Save response

    render(<Settings />)

    const input = screen.getByLabelText('Gemini API Key')
    const saveButton = screen.getByRole('button', { name: '保存' })

    fireEvent.change(input, { target: { value: 'new-api-key' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('set_api_key', { apiKey: 'new-api-key' })
    })
  })

  it('shows success message after saving', async () => {
    mockInvoke.mockResolvedValueOnce('') // Initial load
    mockInvoke.mockResolvedValueOnce(true) // Save response

    render(<Settings />)

    const input = screen.getByLabelText('Gemini API Key')
    const saveButton = screen.getByRole('button', { name: '保存' })

    fireEvent.change(input, { target: { value: 'new-api-key' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('API Keyが保存されました')).toBeInTheDocument()
    })
  })

  it('shows error message when save fails', async () => {
    mockInvoke.mockResolvedValueOnce('') // Initial load
    mockInvoke.mockRejectedValueOnce(new Error('Save failed')) // Save error

    render(<Settings />)

    const input = screen.getByLabelText('Gemini API Key')
    const saveButton = screen.getByRole('button', { name: '保存' })

    fireEvent.change(input, { target: { value: 'new-api-key' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })
  })

  it('masks API key input by default', () => {
    render(<Settings />)
    
    const input = screen.getByLabelText('Gemini API Key') as HTMLInputElement
    expect(input.type).toBe('password')
  })

  it('can toggle API key visibility', () => {
    render(<Settings />)
    
    const input = screen.getByLabelText('Gemini API Key') as HTMLInputElement
    const toggleButton = screen.getByRole('button', { name: 'API Keyを表示' })

    expect(input.type).toBe('password')

    fireEvent.click(toggleButton)
    expect(input.type).toBe('text')

    fireEvent.click(toggleButton)
    expect(input.type).toBe('password')
  })
})