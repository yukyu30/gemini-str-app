import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Transcription from './Transcription'
import { TRANSCRIPTION_PROMPTS } from '../constants/prompts'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

const mockInvoke = vi.mocked(await import('@tauri-apps/api/core')).invoke

// Mock file object
const createMockFile = (name: string, size: number, type: string) => {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('Transcription Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders transcription interface', () => {
    render(<Transcription />)
    
    expect(screen.getByText('音声文字起こし')).toBeInTheDocument()
    expect(screen.getByText('音声ファイルをアップロード')).toBeInTheDocument()
  })

  it('shows transcription options after file upload', async () => {
    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      expect(screen.getByText('文字起こしタイプを選択')).toBeInTheDocument()
      expect(screen.getByText('基本的な文字起こし')).toBeInTheDocument()
      expect(screen.getByText('SRT字幕形式')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '文字起こし開始' })).toBeInTheDocument()
    })
  })

  it('starts transcription with basic prompt', async () => {
    mockInvoke.mockResolvedValueOnce('テストの文字起こし結果です。')

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', {
        filePath: expect.any(String),
        prompt: TRANSCRIPTION_PROMPTS.BASIC_TRANSCRIPT
      })
    })
  })

  it('starts transcription with SRT format', async () => {
    mockInvoke.mockResolvedValueOnce('SRT形式の文字起こし結果です。')

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const srtRadio = screen.getByDisplayValue('srt')
      fireEvent.click(srtRadio)
      
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', {
        filePath: expect.any(String),
        prompt: TRANSCRIPTION_PROMPTS.SRT_FORMAT()
      })
    })
  })

  it('shows loading state during transcription', async () => {
    let resolveTranscription: (value: string) => void
    const transcriptionPromise = new Promise<string>((resolve) => {
      resolveTranscription = resolve
    })
    mockInvoke.mockReturnValueOnce(transcriptionPromise)

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    expect(screen.getByText('文字起こし中...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()

    // Complete transcription
    resolveTranscription!('完了した文字起こし結果')

    await waitFor(() => {
      expect(screen.getByText('完了した文字起こし結果')).toBeInTheDocument()
    })
  })

  it('handles transcription errors', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('API key not found'))

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    await waitFor(() => {
      expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument()
      expect(screen.getByText(/API key not found/)).toBeInTheDocument()
    })
  })

  it('allows result download as text file', async () => {
    const transcriptionResult = 'ダウンロード用の文字起こし結果です。'
    mockInvoke.mockResolvedValueOnce(transcriptionResult)

    // Mock URL.createObjectURL and document.createElement
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const mockRevokeMockObjectURL = vi.fn()
    const mockClick = vi.fn()
    const mockRemove = vi.fn()
    
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeMockObjectURL
    
    const mockAnchor = {
      click: mockClick,
      remove: mockRemove,
      href: '',
      download: '',
      nodeType: 1,
      nodeName: 'A'
    }
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any)

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    await waitFor(() => {
      expect(screen.getByText(transcriptionResult)).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole('button', { name: 'テキストファイルをダウンロード' })
    fireEvent.click(downloadButton)

    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(mockRevokeMockObjectURL).toHaveBeenCalled()
  })

  it('allows copying result to clipboard', async () => {
    const transcriptionResult = 'クリップボード用の文字起こし結果です。'
    mockInvoke.mockResolvedValueOnce(transcriptionResult)

    // Mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    })

    // Mock DOM methods
    const mockAnchor = { nodeType: 1, nodeName: 'A' }
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor as any)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor as any)

    render(<Transcription />)
    
    const mockFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3')
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    
    fireEvent.change(fileInput, { target: { files: [mockFile] } })
    
    await waitFor(() => {
      const startButton = screen.getByRole('button', { name: '文字起こし開始' })
      fireEvent.click(startButton)
    })

    await waitFor(() => {
      expect(screen.getByText(transcriptionResult)).toBeInTheDocument()
    })

    const copyButton = screen.getByRole('button', { name: 'クリップボードにコピー' })
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(transcriptionResult)
      expect(screen.getByText('クリップボードにコピーしました')).toBeInTheDocument()
    })
  })
})