import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import { SUPPORTED_AUDIO_FORMATS, API_LIMITS } from '../constants/prompts'
import './AudioUpload.css'

interface AudioUploadProps {
  onFileSelect: (file: File) => void
  onError: (error: string) => void
}

const AudioUpload = ({ onFileSelect, onError }: AudioUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const size = bytes / Math.pow(k, i)
    return (size % 1 === 0 ? size.toString() : size.toFixed(2)) + ' ' + sizes[i]
  }

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!SUPPORTED_AUDIO_FORMATS.includes(file.type as any)) {
      return '対応していないファイル形式です'
    }

    // Check file size (convert MB to bytes)
    const maxSizeBytes = API_LIMITS.MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `ファイルサイズが${API_LIMITS.MAX_FILE_SIZE_MB}MBを超えています`
    }

    return null
  }

  const handleFileSelection = (file: File) => {
    const error = validateFile(file)
    if (error) {
      onError(error)
      return
    }

    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelection(files[0])
    }
  }

  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  const getSupportedFormatsText = () => {
    return SUPPORTED_AUDIO_FORMATS
      .map(format => format.split('/')[1].toUpperCase())
      .join(', ')
  }

  return (
    <div className="audio-upload">
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickUpload}
        data-testid="drop-zone"
      >
        <div className="upload-icon">🎵</div>
        <h3>音声ファイルをアップロード</h3>
        <p>ファイルを選択またはドラッグ&ドロップ</p>
        <p className="supported-formats">
          対応形式: {getSupportedFormatsText()}
        </p>
        <p className="size-limit">
          最大ファイルサイズ: {API_LIMITS.MAX_FILE_SIZE_MB}MB (1GB)
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_AUDIO_FORMATS.join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          aria-label="音声ファイルを選択"
        />
      </div>

      {selectedFile && (
        <div className="selected-file">
          <div className="file-icon">📁</div>
          <div className="file-info">
            <div className="file-name">{selectedFile.name}</div>
            <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            <div className="file-type">{selectedFile.type}</div>
          </div>
          <button
            className="change-file-btn"
            onClick={handleClickUpload}
            type="button"
          >
            変更
          </button>
        </div>
      )}
    </div>
  )
}

export default AudioUpload