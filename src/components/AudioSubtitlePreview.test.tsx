import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AudioSubtitlePreview from './AudioSubtitlePreview'
import { SrtSubtitle } from '@/types/srt'

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
    text: 'First subtitle'
  },
  {
    index: 2,
    startTime: '00:00:03,000',
    endTime: '00:00:06,000',
    text: 'Second subtitle'
  },
  {
    index: 3,
    startTime: '00:00:06,000',
    endTime: '00:00:10,000',
    text: 'Third subtitle'
  }
]

const mockAudioFile = new File([''], 'test.mp3', { type: 'audio/mp3' })

describe('AudioSubtitlePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAudio.currentTime = 0
    mockAudio.paused = true
  })

  it('renders with audio controls and subtitle display', () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument()
    // Initially shows subtitle in list
    expect(screen.getByText('First subtitle')).toBeInTheDocument()
  })

  it('displays current subtitle based on audio time', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    // Initially shows no active subtitle in center display (time is 0)
    expect(screen.getByText('字幕を表示するには音声を再生してください')).toBeInTheDocument()

    // Simulate time update to second subtitle (4 seconds)
    mockAudio.currentTime = 4
    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')?.[1]
    
    if (timeUpdateCallback) {
      act(() => {
        timeUpdateCallback()
      })
    }

    await waitFor(() => {
      // Check that the subtitle appears in the center display area
      const centerSubtitle = screen.getByTestId('current-subtitle')
      expect(centerSubtitle).toHaveTextContent('Second subtitle')
    })
  })

  it('converts SRT time format to seconds correctly', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    // Test the time conversion by checking if subtitles change at correct times
    mockAudio.currentTime = 3.5
    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')?.[1]
    
    if (timeUpdateCallback) {
      act(() => {
        timeUpdateCallback()
      })
    }

    // Should show second subtitle (starts at 3 seconds)
    await waitFor(() => {
      // Check that the subtitle appears in the center display area
      const centerSubtitle = screen.getByTestId('current-subtitle')
      expect(centerSubtitle).toHaveTextContent('Second subtitle')
    })
  })

  it('plays and pauses audio when button is clicked', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    const playButton = screen.getByRole('button', { name: /play/i })
    
    // Click play
    fireEvent.click(playButton)
    expect(mockAudio.play).toHaveBeenCalled()

    // Simulate audio starting to play
    mockAudio.paused = false
    const playCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'play')?.[1]
    
    if (playCallback) {
      act(() => {
        playCallback()
      })
    }

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument()
    })

    // Click pause
    fireEvent.click(screen.getByRole('button', { name: /pause/i }))
    expect(mockAudio.pause).toHaveBeenCalled()
  })

  it('updates progress bar based on audio time', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    // Set duration first
    mockAudio.duration = 100
    const loadedMetadataCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'loadedmetadata')?.[1]
    
    if (loadedMetadataCallback) {
      act(() => {
        loadedMetadataCallback()
      })
    }

    // Simulate time progress
    mockAudio.currentTime = 50
    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')?.[1]
    
    if (timeUpdateCallback) {
      act(() => {
        timeUpdateCallback()
      })
    }

    await waitFor(() => {
      expect(screen.getByText('00:50 / 01:40')).toBeInTheDocument()
    })
  })

  it('handles seeking when progress bar is clicked', async () => {
    // Set duration first
    mockAudio.duration = 100
    
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    const progressBar = screen.getByRole('slider')
    
    // Simulate seeking to 25 seconds
    fireEvent.change(progressBar, { target: { value: '25' } })
    
    expect(mockAudio.currentTime).toBe(25)
  })

  it('shows no subtitle when time is outside subtitle ranges and not playing', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    // Simulate time after all subtitles when not playing
    mockAudio.currentTime = 15
    mockAudio.paused = true
    
    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')?.[1]
    
    if (timeUpdateCallback) {
      act(() => {
        timeUpdateCallback()
      })
    }

    await waitFor(() => {
      // Should show the default message when no subtitle is active and not playing
      expect(screen.getByText('字幕を表示するには音声を再生してください')).toBeInTheDocument()
    })
  })

  it('hides instruction message when playing audio even if no current subtitle', async () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    // Simulate playing audio but outside any subtitle range
    mockAudio.currentTime = 15 // No subtitle for this time
    mockAudio.paused = false
    
    // Trigger play event to set isPlaying to true
    const playCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'play')?.[1]
    
    if (playCallback) {
      act(() => {
        playCallback()
      })
    }

    const timeUpdateCallback = mockAudio.addEventListener.mock.calls
      .find(call => call[0] === 'timeupdate')?.[1]
    
    if (timeUpdateCallback) {
      act(() => {
        timeUpdateCallback()
      })
    }

    await waitFor(() => {
      // Should NOT show the instruction message when playing
      expect(screen.queryByText('字幕を表示するには音声を再生してください')).not.toBeInTheDocument()
    })
  })

  it('handles empty subtitles array gracefully', () => {
    render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={[]}
      />
    )

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByText('字幕がありません')).toBeInTheDocument()
  })

  it('cleans up audio event listeners on unmount', () => {
    const { unmount } = render(
      <AudioSubtitlePreview
        audioFile={mockAudioFile}
        subtitles={mockSubtitles}
      />
    )

    unmount()

    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function))
    expect(mockAudio.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function))
  })
})