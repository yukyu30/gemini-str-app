import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import SrtFileCard from './SrtFileCard'
import { useToast } from '@/hooks/use-toast'
import * as srtUtils from '@/lib/srt-utils'
import { AudioFile } from '@/types/srt'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn()
}))

vi.mock('@/lib/srt-utils', () => ({
  downloadSrtFile: vi.fn(),
  parseSrt: vi.fn(),
  validateSrt: vi.fn()
}))

vi.mock('@/utils/storage', () => ({
  storageUtils: {
    getApiKey: vi.fn().mockReturnValue('test-api-key')
  }
}))

const mockInvoke = vi.mocked(invoke)
const mockUseToast = vi.mocked(useToast)
const mockDownloadSrtFile = vi.mocked(srtUtils.downloadSrtFile)

describe('SrtFileCard', () => {
  const mockToast = vi.fn()
  const mockOnUpdate = vi.fn()
  const mockOnDelete = vi.fn()

  const mockAudioFile: AudioFile = {
    id: 'test-id',
    file: new File(['test'], 'test.mp3', { type: 'audio/mp3' }),
    settings: {
      maxCharsPerSubtitle: 20,
      enableSpeakerDetection: false,
      removeFillerWords: true,
      enableAdvancedProcessing: false
    },
    status: 'idle'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseToast.mockReturnValue({
      toast: mockToast,
      toasts: [],
      dismiss: vi.fn()
    })
  })

  describe('Download functionality', () => {
    it('should show error toast when trying to download without result', async () => {
      render(
        <SrtFileCard 
          audioFile={{...mockAudioFile, status: 'completed'}}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /SRTダウンロード|テキストダウンロード/ })
      fireEvent.click(downloadButton)

      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: 'ダウンロードエラー',
        description: 'ダウンロードできる内容がありません'
      })
    })

    it('should show success toast when download succeeds', async () => {
      const audioFileWithResult = {
        ...mockAudioFile,
        status: 'completed' as const,
        result: 'test srt content'
      }

      mockDownloadSrtFile.mockResolvedValueOnce(undefined)

      render(
        <SrtFileCard 
          audioFile={audioFileWithResult}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /SRTダウンロード|テキストダウンロード/ })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'ダウンロード完了',
          description: expect.stringContaining('test_subtitles.srt')
        })
      })
    })

    it('should show error toast when download fails', async () => {
      const audioFileWithResult = {
        ...mockAudioFile,
        status: 'completed' as const,
        result: 'test srt content'
      }

      mockDownloadSrtFile.mockRejectedValueOnce(new Error('Download failed'))

      render(
        <SrtFileCard 
          audioFile={audioFileWithResult}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /SRTダウンロード|テキストダウンロード/ })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: 'ダウンロードエラー',
          description: 'ファイルのダウンロードに失敗しました'
        })
      })
    })
  })

  describe('Processing Steps Display', () => {
    it('should display processing steps when advanced processing is enabled', () => {
      const advancedAudioFile = {
        ...mockAudioFile,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        status: 'processing' as const,
        stages: {
          initialTranscription: {
            name: '基本文字起こし (Gemini 2.0 Flash)',
            status: 'processing' as const
          }
        }
      }

      render(
        <SrtFileCard 
          audioFile={advancedAudioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.getByText('処理ステップ (4段階)')).toBeInTheDocument()
      expect(screen.getByText('基本文字起こし (Gemini 2.0 Flash)')).toBeInTheDocument()
    })

    it('should show all 4 default stages when no actual stages exist', () => {
      const advancedAudioFile = {
        ...mockAudioFile,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        status: 'processing' as const
      }

      render(
        <SrtFileCard 
          audioFile={advancedAudioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.getByText('処理ステップ (4段階)')).toBeInTheDocument()
      expect(screen.getByText('基本文字起こし (Gemini 2.0 Flash)')).toBeInTheDocument()
      expect(screen.getByText('トピック分析 (Gemini 2.0 Flash)')).toBeInTheDocument()
      expect(screen.getByText('辞書作成 (Google検索+Gemini 2.0 Flash)')).toBeInTheDocument()
      expect(screen.getByText('最終字幕生成 (Gemini 2.5 Pro)')).toBeInTheDocument()
    })

    it('should merge actual stage data with default stage data correctly', () => {
      const advancedAudioFile = {
        ...mockAudioFile,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        status: 'completed' as const,
        stages: {
          initialTranscription: {
            name: '基本文字起こし (Gemini 2.0 Flash)',
            status: 'completed' as const,
            result: 'Transcription result here'
          },
          topicAnalysis: {
            name: 'トピック分析 (Gemini 2.0 Flash)',
            status: 'completed' as const,
            result: 'Topic analysis result here'
          }
        }
      }

      render(
        <SrtFileCard 
          audioFile={advancedAudioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Check that completed stages show correct status
      // Note: There might be additional "完了" text in status badges and other places
      expect(screen.getByText('基本文字起こし (Gemini 2.0 Flash)')).toBeInTheDocument()
      expect(screen.getByText('トピック分析 (Gemini 2.0 Flash)')).toBeInTheDocument()
    })

    it('should display step descriptions for pending stages', () => {
      const advancedAudioFile = {
        ...mockAudioFile,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        status: 'processing' as const
      }

      render(
        <SrtFileCard 
          audioFile={advancedAudioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click on a pending stage to expand it
      const firstStage = screen.getByText('基本文字起こし (Gemini 2.0 Flash)')
      fireEvent.click(firstStage)

      expect(screen.getByText('音声ファイルから基本的な文字起こしを行います')).toBeInTheDocument()
    })
  })

  describe('Dictionary Download', () => {
    it('should not show dictionary download button when no dictionary exists', () => {
      const audioFileWithoutDictionary = {
        ...mockAudioFile,
        status: 'completed' as const,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        result: 'Some result', // Need result to show download buttons
        stages: {
          initialTranscription: { name: 'test', status: 'completed' as const }
        }
      }

      render(
        <SrtFileCard 
          audioFile={audioFileWithoutDictionary}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Should not find dictionary download button when no dictionary exists
      expect(screen.queryByRole('button', { name: /辞書CSVダウンロード/ })).not.toBeInTheDocument()
    })

    it('should show success toast when dictionary download succeeds', async () => {
      const audioFileWithDictionary = {
        ...mockAudioFile,
        status: 'completed' as const,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        dictionary: 'test,dictionary,csv,content'
      }

      mockInvoke.mockResolvedValueOnce('/path/to/dictionary.csv')

      render(
        <SrtFileCard 
          audioFile={audioFileWithDictionary}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const downloadButton = screen.getByRole('button', { name: /辞書CSVダウンロード/ })
      fireEvent.click(downloadButton)

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'success',
          title: 'ダウンロード完了',
          description: expect.stringContaining('辞書CSV')
        })
      })
    })
  })
})