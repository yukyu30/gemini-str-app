import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SrtFileCard from './SrtFileCard'
import { AudioFile, SrtSubtitle } from '@/types/srt'

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

// Mock audio element
const mockAudio = {
  currentTime: 0,
  duration: 100,
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

const mockSubtitles: SrtSubtitle[] = [
  {
    index: 1,
    startTime: '00:00:00,000',
    endTime: '00:00:03,000',
    text: 'Hello world'
  },
  {
    index: 2,
    startTime: '00:00:03,000',
    endTime: '00:00:06,000',
    text: 'This is a test subtitle'
  },
]

const mockAudioFile: AudioFile = {
  id: 'test-id',
  file: new File([''], 'test.mp3', { type: 'audio/mp3' }),
  settings: {
    maxCharsPerSubtitle: 20,
    enableSpeakerDetection: false,
    removeFillerWords: true,
    enableAdvancedProcessing: false,
  },
  status: 'completed',
  result: '1\n00:00:00,000 --> 00:00:03,000\nHello world\n\n2\n00:00:03,000 --> 00:00:06,000\nThis is a test subtitle',
  subtitles: mockSubtitles,
  srtValidation: { isValid: true, errors: [] },
}

const mockOnUpdate = vi.fn()
const mockOnDelete = vi.fn()

describe('SrtFileCard Preview Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAudio.currentTime = 0
    mockAudio.paused = true
  })

  it('shows preview tab when subtitles are available', () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.getByText('字幕プレビュー')).toBeInTheDocument()
    expect(screen.getByText('SRT字幕結果')).toBeInTheDocument()
  })

  it('does not show preview tab when no subtitles are available', () => {
    const audioFileWithoutSubtitles = {
      ...mockAudioFile,
      subtitles: undefined,
    }

    render(
      <SrtFileCard
        audioFile={audioFileWithoutSubtitles}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.queryByText('字幕プレビュー')).not.toBeInTheDocument()
    expect(screen.getByText('SRT字幕結果')).toBeInTheDocument()
  })

  it('does not show tabs when audio file is not completed', () => {
    const processingAudioFile = {
      ...mockAudioFile,
      status: 'processing' as const,
    }

    render(
      <SrtFileCard
        audioFile={processingAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    expect(screen.queryByText('字幕プレビュー')).not.toBeInTheDocument()
    expect(screen.queryByText('SRT字幕結果')).not.toBeInTheDocument()
  })

  it('switches between result and preview tabs when clicked', async () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Initially should show result tab content
    expect(screen.getByText(/Hello world/)).toBeInTheDocument()
    expect(screen.getByText(/This is a test subtitle/)).toBeInTheDocument()
    expect(screen.queryByTestId('subtitle-display')).not.toBeInTheDocument()
    
    // Click preview tab
    const previewTabs = screen.getAllByText('字幕プレビュー')
    fireEvent.click(previewTabs[0])
    
    await waitFor(() => {
      expect(screen.getByTestId('subtitle-display')).toBeInTheDocument()
    })
    
    // Check that AudioSubtitlePreview component is rendered
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByText('Hello world')).toBeInTheDocument()
    expect(screen.getByText('This is a test subtitle')).toBeInTheDocument()
    
    // Result content should be hidden  
    expect(screen.queryByText(/00:00:00,000 --> 00:00:03,000/)).not.toBeInTheDocument()
    
    // Click back to result tab
    const resultTab = screen.getByText('SRT字幕結果')
    fireEvent.click(resultTab)
    
    await waitFor(() => {
      expect(screen.getByText(/00:00:00,000 --> 00:00:03,000/)).toBeInTheDocument()
      expect(screen.queryByTestId('subtitle-display')).not.toBeInTheDocument()
    })
  })

  it('maintains other functionality while preview tab is active', async () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Switch to preview tab
    const previewTabs = screen.getAllByText('字幕プレビュー')
    fireEvent.click(previewTabs[0])

    await waitFor(() => {
      expect(screen.getByTestId('subtitle-display')).toBeInTheDocument()
    })

    // Action buttons should still be accessible
    expect(screen.getByText('SRTダウンロード')).toBeInTheDocument()
    expect(screen.getByText('Geminiデバッグを表示')).toBeInTheDocument()
    expect(screen.getByText('再生成')).toBeInTheDocument()

    // Settings button should still work
    const settingsButtons = screen.getAllByRole('button')
    const settingsButton = settingsButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-settings')
    )
    expect(settingsButton).toBeDefined()
    fireEvent.click(settingsButton!)
    expect(screen.getByText('1字幕あたりの最大文字数')).toBeInTheDocument()
  })

  it('correctly handles preview with different subtitle validation states', async () => {
    const audioFileWithInvalidSrt = {
      ...mockAudioFile,
      srtValidation: { isValid: false, errors: ['Invalid format'] },
      subtitles: undefined, // No subtitles due to invalid format
    }

    render(
      <SrtFileCard
        audioFile={audioFileWithInvalidSrt}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Preview button should not be shown for invalid SRT without subtitles
    expect(screen.queryByText('字幕プレビュー')).not.toBeInTheDocument()
    expect(screen.getByText('テキストダウンロード (.srt)')).toBeInTheDocument()
  })

  it('handles empty subtitles array gracefully in preview', async () => {
    const audioFileWithEmptySubtitles = {
      ...mockAudioFile,
      subtitles: [],
    }

    render(
      <SrtFileCard
        audioFile={audioFileWithEmptySubtitles}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Preview button should not be shown for empty subtitles
    expect(screen.queryByText('字幕プレビュー')).not.toBeInTheDocument()
  })

  it('passes correct props to AudioSubtitlePreview component', async () => {
    render(
      <SrtFileCard
        audioFile={mockAudioFile}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />
    )

    // Click preview tab (get the first one which is the tab button)
    const previewTabs = screen.getAllByText('字幕プレビュー')
    fireEvent.click(previewTabs[0])

    await waitFor(() => {
      expect(screen.getByTestId('subtitle-display')).toBeInTheDocument()
    })

    // Verify AudioSubtitlePreview receives correct data
    expect(screen.getByText('字幕一覧')).toBeInTheDocument() // Subtitle list header
    
    // Verify subtitle content is displayed
    mockSubtitles.forEach(subtitle => {
      expect(screen.getByText(subtitle.text)).toBeInTheDocument()
    })

    // Verify audio controls are present
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
})