import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AudioUpload from './AudioUpload'
import { API_LIMITS } from '../constants/prompts'

// Mock file objects
const createMockFile = (name: string, size: number, type: string) => {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('AudioUpload Component', () => {
  const mockOnFileSelect = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders upload area with correct text', () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    expect(screen.getByText('音声ファイルをアップロード')).toBeInTheDocument()
    expect(screen.getByText('ファイルを選択またはドラッグ&ドロップ')).toBeInTheDocument()
    expect(screen.getByText(/対応形式:/)).toBeInTheDocument()
  })

  it('accepts valid audio file', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    const validFile = createMockFile('test.mp3', 1024 * 1024, 'audio/mp3') // 1MB
    
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(mockOnFileSelect).toHaveBeenCalledWith(validFile)
      expect(mockOnError).not.toHaveBeenCalled()
    })
  })

  it('rejects file that is too large', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    const largeFile = createMockFile('large.mp3', 1025 * 1024 * 1024, 'audio/mp3') // 1025MB
    
    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        `ファイルサイズが${API_LIMITS.MAX_FILE_SIZE_MB}MBを超えています`
      )
      expect(mockOnFileSelect).not.toHaveBeenCalled()
    })
  })

  it('rejects unsupported file format', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    const invalidFile = createMockFile('test.txt', 1024, 'text/plain')
    
    fireEvent.change(fileInput, { target: { files: [invalidFile] } })
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('対応していないファイル形式です')
      expect(mockOnFileSelect).not.toHaveBeenCalled()
    })
  })

  it('handles drag and drop correctly', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const dropZone = screen.getByTestId('drop-zone')
    const validFile = createMockFile('test.wav', 1024 * 1024, 'audio/wav')
    
    const dropEvent = new Event('drop', { bubbles: true })
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { files: [validFile] }
    })
    
    fireEvent(dropZone, dropEvent)
    
    await waitFor(() => {
      expect(mockOnFileSelect).toHaveBeenCalledWith(validFile)
    })
  })

  it('prevents default behavior on drag over', () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const dropZone = screen.getByTestId('drop-zone')
    const dragOverEvent = new Event('dragover', { bubbles: true })
    const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault')
    
    fireEvent(dropZone, dragOverEvent)
    
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('shows visual feedback during drag over', () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const dropZone = screen.getByTestId('drop-zone')
    
    fireEvent.dragOver(dropZone)
    expect(dropZone).toHaveClass('drag-over')
    
    fireEvent.dragLeave(dropZone)
    expect(dropZone).not.toHaveClass('drag-over')
  })

  it('displays selected file information', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    const validFile = createMockFile('test-audio.mp3', 2 * 1024 * 1024, 'audio/mp3') // 2MB
    
    fireEvent.change(fileInput, { target: { files: [validFile] } })
    
    await waitFor(() => {
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
      expect(screen.getByText('2 MB')).toBeInTheDocument()
    })
  })

  it('allows file replacement', async () => {
    render(<AudioUpload onFileSelect={mockOnFileSelect} onError={mockOnError} />)
    
    const fileInput = screen.getByLabelText('音声ファイルを選択')
    const firstFile = createMockFile('first.mp3', 1024 * 1024, 'audio/mp3')
    const secondFile = createMockFile('second.wav', 2 * 1024 * 1024, 'audio/wav')
    
    // Upload first file
    fireEvent.change(fileInput, { target: { files: [firstFile] } })
    
    await waitFor(() => {
      expect(mockOnFileSelect).toHaveBeenCalledWith(firstFile)
    })
    
    // Replace with second file
    fireEvent.change(fileInput, { target: { files: [secondFile] } })
    
    await waitFor(() => {
      expect(mockOnFileSelect).toHaveBeenCalledWith(secondFile)
      expect(screen.getByText('second.wav')).toBeInTheDocument()
    })
  })
})