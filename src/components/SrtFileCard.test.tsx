import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
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


  describe('Processing Steps Deletion', () => {
    it('should not display processing steps UI elements', () => {
      const audioFile = {
        ...mockAudioFile,
        status: 'processing' as const
      }

      render(
        <SrtFileCard 
          audioFile={audioFile}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      expect(screen.queryByText('処理ステップ (4段階)')).not.toBeInTheDocument()
      expect(screen.queryByText('基本文字起こし (Gemini 2.0 Flash)')).not.toBeInTheDocument()
      expect(screen.queryByText('トピック分析 (Gemini 2.0 Flash)')).not.toBeInTheDocument()
      expect(screen.queryByText('辞書作成 (Google検索+Gemini 2.0 Flash)')).not.toBeInTheDocument()
      expect(screen.queryByText('最終字幕生成 (Gemini 2.5 Pro)')).not.toBeInTheDocument()
    })
  })

  describe('Dictionary Download', () => {
    it('should not show dictionary download button when advanced processing is disabled', () => {
      const audioFileWithResult = {
        ...mockAudioFile,
        status: 'completed' as const,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: false
        },
        result: 'Some result'
      }

      render(
        <SrtFileCard 
          audioFile={audioFileWithResult}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Should not find dictionary download button when advanced processing is disabled
      expect(screen.queryByRole('button', { name: /辞書CSVダウンロード/ })).not.toBeInTheDocument()
    })

    it('should show dictionary download button when advanced processing is enabled and dictionary exists', () => {
      const audioFileWithDictionary = {
        ...mockAudioFile,
        status: 'completed' as const,
        settings: {
          ...mockAudioFile.settings,
          enableAdvancedProcessing: true
        },
        result: 'Some result',
        dictionary: 'test,dictionary,csv,content'
      }

      render(
        <SrtFileCard 
          audioFile={audioFileWithDictionary}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Should find dictionary download button when advanced processing is enabled and dictionary exists
      expect(screen.getByRole('button', { name: /辞書CSVダウンロード/ })).toBeInTheDocument()
    })
  })
})