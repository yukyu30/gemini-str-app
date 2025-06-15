import { useState, useRef } from 'react'
import './FileDropZone.css'

interface FileDropZoneProps {
  onFilesAdded: (files: File[]) => void
  onError: (error: string) => void
}

const FileDropZone = ({ onFilesAdded, onError }: FileDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supportedFormats = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 
    'audio/flac', 'audio/m4a', 'audio/opus', 'audio/webm'
  ]

  const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB

  const validateFiles = (files: File[]): File[] => {
    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of files) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: ファイルサイズが1GBを超えています`)
        continue
      }

      // Check file type
      const isValidType = supportedFormats.some(format => 
        file.type === format || file.name.toLowerCase().endsWith(format.split('/')[1])
      )

      if (!isValidType) {
        errors.push(`${file.name}: サポートされていないファイル形式です`)
        continue
      }

      validFiles.push(file)
    }

    if (errors.length > 0) {
      onError(errors.join('\n'))
    }

    return validFiles
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const validFiles = validateFiles(files)

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = validateFiles(files)

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div 
      className={`file-drop-zone ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="drop-zone-content">
        <div className="drop-zone-icon">
          📁
        </div>
        <div className="drop-zone-text">
          <h3>音声ファイルをドロップ</h3>
          <p>または、クリックしてファイルを選択</p>
          <div className="drop-zone-info">
            <p>対応形式: MP3, WAV, OGG, AAC, FLAC, M4A, OPUS, WebM</p>
            <p>最大サイズ: 1GB</p>
            <p>複数ファイル同時選択可能</p>
          </div>
        </div>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default FileDropZone