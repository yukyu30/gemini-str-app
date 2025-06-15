import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SrtFileCard from './SrtFileCard'
import { AudioFile } from '@/types/srt'
import { invoke } from '@tauri-apps/api/core'

// Mock useToast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock storage utils
vi.mock('@/utils/storage', () => ({
  storageUtils: {
    getApiKey: vi.fn(() => 'mock-api-key'),
  },
}))

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock srt-utils
vi.mock('@/lib/srt-utils', () => ({
  downloadSrtFile: vi.fn(),
  parseSrt: vi.fn(),
  validateSrt: vi.fn(() => ({ isValid: true, errors: [] })),
}))

// Mock audio element with duration
const mockAudio = {
  currentTime: 0,
  duration: 150.5, // 2 minutes 30.5 seconds
  paused: true,
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  src: '',
  load: vi.fn(),
}

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url')
global.URL.revokeObjectURL = vi.fn()

// Mock Audio constructor
global.Audio = vi.fn(() => mockAudio) as any

const mockAudioFile: AudioFile = {
  id: 'test-id',
  file: new File([''], 'test.mp3', { type: 'audio/mp3' }),
  settings: {
    maxCharsPerSubtitle: 20,
    enableSpeakerDetection: false,
    removeFillerWords: true,
    enableAdvancedProcessing: false,
  },
  status: 'idle',
}

const mockOnUpdate = vi.fn()
const mockOnDelete = vi.fn()

describe('SrtFileCard Audio Duration Functionality', () => {
  const mockInvoke = vi.mocked(invoke)

  beforeEach(() => {
    vi.clearAllMocks()
    mockAudio.currentTime = 0
    mockAudio.paused = true
    mockAudio.duration = 150.5 // Reset to default duration
    
    // Mock successful transcription
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'save_temp_file') {
        return Promise.resolve('/tmp/test.mp3')
      }
      if (command === 'transcribe_audio') {
        return Promise.resolve('Mock SRT result')
      }
      return Promise.resolve('')
    })
  })

  it('extracts audio duration during basic transcription', async () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Start transcription
    const startButton = screen.getByRole('button', { name: /SRT字幕生成開始/ })
    fireEvent.click(startButton)

    // Wait for audio metadata to load
    const loadedMetadataCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'loadedmetadata')?.[1]
    
    if (loadedMetadataCallback) {
      loadedMetadataCallback()
    }

    // Verify the duration extraction step was called
    expect(mockOnUpdate).toHaveBeenCalledWith('test-id', expect.objectContaining({
      progress: 'ステップ 2/6: 音声ファイルの長さを取得中...',
    }))

    // Verify transcribe_audio was called with correct prompt containing duration
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', expect.objectContaining({
      prompt: expect.stringContaining('2分30秒 (150500ms)'),
    }))
  })

  it('handles duration extraction errors gracefully', async () => {
    // Mock audio that fails to load
    const failingAudio = {
      ...mockAudio,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'error') {
          callback()
        }
      }),
    }
    global.Audio = vi.fn(() => failingAudio) as any

    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Start transcription
    const startButton = screen.getByRole('button', { name: /SRT字幕生成開始/ })
    fireEvent.click(startButton)

    // Trigger error callback
    const errorCallback = failingAudio.addEventListener.mock.calls
      .find(call => call[0] === 'error')?.[1]
    
    if (errorCallback) {
      errorCallback()
    }

    // Should still proceed with transcription without duration
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', expect.objectContaining({
      prompt: expect.not.stringContaining('音声ファイルの長さ'),
    }))
  })

  it('includes duration in advanced transcription workflow', async () => {
    const advancedAudioFile = {
      ...mockAudioFile,
      settings: {
        ...mockAudioFile.settings,
        enableAdvancedProcessing: true,
      },
    }

    // Mock advanced transcription commands
    mockInvoke.mockImplementation((command: string) => {
      if (command === 'save_temp_file') {
        return Promise.resolve('/tmp/test.mp3')
      }
      if (command === 'transcribe_audio') {
        return Promise.resolve('Mock initial transcription')
      }
      if (command === 'analyze_topic') {
        return Promise.resolve('メイントピック: テスト\n専門分野: IT\nキーワード: テスト,開発')
      }
      if (command === 'create_dictionary') {
        return Promise.resolve('テスト,てすと\n開発,かいはつ')
      }
      if (command === 'enhance_transcription_with_dictionary') {
        return Promise.resolve('Enhanced SRT result')
      }
      return Promise.resolve('')
    })

    render(
      <SrtFileCard
        audioFile={advancedAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Start advanced transcription
    const startButton = screen.getByRole('button', { name: /SRT字幕生成開始/ })
    fireEvent.click(startButton)

    // Wait for audio metadata to load
    const loadedMetadataCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'loadedmetadata')?.[1]
    
    if (loadedMetadataCallback) {
      loadedMetadataCallback()
    }

    // Verify duration is passed to final enhancement step
    await new Promise(resolve => setTimeout(resolve, 200))
    
    expect(mockInvoke).toHaveBeenCalledWith('enhance_transcription_with_dictionary', expect.objectContaining({
      durationMs: 150500,
    }))
  })

  it('formats duration correctly for different lengths', async () => {
    // Test with different durations
    const testCases = [
      { duration: 30.5, expected: '0分30秒 (30500ms)' },
      { duration: 90, expected: '1分30秒 (90000ms)' },
      { duration: 3665.123, expected: '61分5秒 (3665123ms)' },
    ]

    for (const testCase of testCases) {
      mockAudio.duration = testCase.duration
      
      render(
        <SrtFileCard
          audioFile={mockAudioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const startButton = screen.getByRole('button', { name: /SRT字幕生成開始/ })
      fireEvent.click(startButton)

      // Wait for audio metadata to load
      const loadedMetadataCallback = mockAudio.addEventListener.mock.calls
        .find(call => call[0] === 'loadedmetadata')?.[1]
      
      if (loadedMetadataCallback) {
        loadedMetadataCallback()
      }

      await new Promise(resolve => setTimeout(resolve, 100))
      
      expect(mockInvoke).toHaveBeenCalledWith('transcribe_audio', expect.objectContaining({
        prompt: expect.stringContaining(testCase.expected),
      }))

      // Clean up for next test
      vi.clearAllMocks()
    }
  })

  it('shows updated step counts with duration extraction', async () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    const startButton = screen.getByRole('button', { name: /SRT字幕生成開始/ })
    fireEvent.click(startButton)

    // Verify the step count progression includes duration step
    const expectedSteps = [
      'ステップ 1/6: ファイルを一時保存中... (数秒)',
      'ステップ 2/6: 音声ファイルの長さを取得中...',
      'ステップ 3/6: プロンプトを準備中...',
      'ステップ 4/6: Gemini APIに音声ファイルを送信中...',
      'ステップ 5/6: AI音声解析・SRT字幕生成中... (1-3分)',
      'ステップ 6/6: SRT形式の検証と最終化中...',
    ]

    for (let i = 0; i < expectedSteps.length; i++) {
      expect(mockOnUpdate).toHaveBeenCalledWith('test-id', expect.objectContaining({
        progress: expectedSteps[i],
      }))
    }
  })
})