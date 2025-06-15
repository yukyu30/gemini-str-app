import { useState, useRef } from 'react'
import { Upload, FileAudio, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SrtDropZoneProps {
  onFilesAdded: (files: File[]) => void
  onError: (error: string) => void
}

const SrtDropZone = ({ onFilesAdded, onError }: SrtDropZoneProps) => {
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
    <Card 
      className={cn(
        "border-2 border-dashed transition-all duration-300 cursor-pointer hover:border-primary/50",
        isDragOver ? "border-primary bg-primary/5 scale-105" : "border-muted-foreground/25"
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <div className={cn(
          "mb-4 rounded-full p-4 transition-all duration-300",
          isDragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}>
          {isDragOver ? (
            <Upload className="h-8 w-8" />
          ) : (
            <FileAudio className="h-8 w-8" />
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">
            {isDragOver ? "ファイルをドロップ" : "音声ファイルを選択"}
          </h3>
          <p className="text-muted-foreground">
            ファイルをドラッグ&ドロップまたはクリックして選択
          </p>
        </div>
        
        <div className="mt-6 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>SRT字幕ファイルを自動生成します</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <strong>対応形式:</strong>
              <br />MP3, WAV, OGG, AAC, FLAC, M4A
            </div>
            <div>
              <strong>最大サイズ:</strong>
              <br />1GB まで
            </div>
          </div>
        </div>
      </CardContent>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
    </Card>
  )
}

export default SrtDropZone