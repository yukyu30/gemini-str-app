import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { 
  Play, 
  Settings, 
  Download, 
  Copy, 
  Trash2, 
  RotateCcw, 
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { AudioFile, SrtSettings } from '@/types/srt'
import { SRT_PROMPT, GEMINI_MODELS } from '@/constants/prompts'
import { storageUtils } from '@/utils/storage'
import { formatFileSize } from '@/lib/utils'
import { downloadSrtFile, parseSrt, validateSrt } from '@/lib/srt-utils'

interface SrtFileCardProps {
  audioFile: AudioFile
  onUpdate: (id: string, updates: Partial<AudioFile>) => void
  onDelete: (id: string) => void
}

const SrtFileCard = ({ audioFile, onUpdate, onDelete }: SrtFileCardProps) => {
  const [showSettings, setShowSettings] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const saveFileTemporarily = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const tempFilePath = await invoke<string>('save_temp_file', {
      fileData: Array.from(uint8Array),
      fileName: file.name
    })
    
    return tempFilePath
  }

  const startTranscription = async () => {
    const apiKey = storageUtils.getApiKey()
    if (!apiKey) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: 'API key not found. Please set your Gemini API key in settings.'
      })
      return
    }

    onUpdate(audioFile.id, {
      status: 'processing',
      error: undefined,
      progress: 'ファイルを準備中...'
    })

    try {
      const tempFilePath = await saveFileTemporarily(audioFile.file)
      
      onUpdate(audioFile.id, { progress: 'SRT字幕を生成中...' })
      
      console.log('Transcription settings:', {
        maxCharsPerSubtitle: audioFile.settings.maxCharsPerSubtitle,
        enableSpeakerDetection: audioFile.settings.enableSpeakerDetection,
        model: audioFile.settings.model
      })
      
      const prompt = SRT_PROMPT(
        undefined,
        audioFile.settings.maxCharsPerSubtitle,
        audioFile.settings.enableSpeakerDetection
      )
      
      console.log('Generated prompt contains speaker detection:', 
        prompt.includes('話者名を明記') ? 'YES' : 'NO')
      console.log('Prompt preview:', prompt.substring(0, 500) + '...')
      
      const result = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt,
        model: audioFile.settings.model,
        apiKey
      })

      // Parse and validate SRT
      const subtitles = parseSrt(result)
      const validation = validateSrt(result)
      
      if (!validation.isValid) {
        onUpdate(audioFile.id, {
          status: 'error',
          error: `SRT形式エラー: ${validation.errors.join(', ')}`,
          progress: undefined
        })
        return
      }

      onUpdate(audioFile.id, {
        status: 'completed',
        result,
        subtitles,
        progress: undefined
      })
    } catch (error) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: `エラーが発生しました: ${error}`,
        progress: undefined
      })
    }
  }

  const retryTranscription = () => {
    startTranscription()
  }

  const copyToClipboard = async () => {
    if (!audioFile.result) return

    try {
      await navigator.clipboard.writeText(audioFile.result)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const downloadSrt = () => {
    if (!audioFile.result) return
    
    const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '')
    const filename = `${baseName}_subtitles.srt`
    downloadSrtFile(audioFile.result, filename)
  }

  const updateSettings = (key: keyof SrtSettings, value: any) => {
    onUpdate(audioFile.id, {
      settings: { ...audioFile.settings, [key]: value }
    })
  }

  const getStatusIcon = () => {
    switch (audioFile.status) {
      case 'idle':
        return <Play className="h-4 w-4" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const getStatusVariant = () => {
    switch (audioFile.status) {
      case 'idle':
        return 'secondary'
      case 'processing':
        return 'processing'
      case 'completed':
        return 'success'
      case 'error':
        return 'destructive'
    }
  }

  const getStatusText = () => {
    switch (audioFile.status) {
      case 'idle':
        return '待機中'
      case 'processing':
        return '処理中'
      case 'completed':
        return '完了'
      case 'error':
        return 'エラー'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {audioFile.file.name}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatFileSize(audioFile.file.size)}</span>
              <Badge variant={getStatusVariant()} className="flex items-center gap-1">
                {getStatusIcon()}
                {getStatusText()}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              disabled={audioFile.status === 'processing'}
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(audioFile.id)}
              disabled={audioFile.status === 'processing'}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Progress Section */}
        {audioFile.status === 'processing' && (
          <div className="space-y-2">
            <Progress value={undefined} className="h-2" />
            <p className="text-sm text-muted-foreground">{audioFile.progress}</p>
          </div>
        )}

        {/* Error Section */}
        {audioFile.status === 'error' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{audioFile.error}</p>
          </div>
        )}

        {/* Settings Section */}
        {showSettings && audioFile.status !== 'processing' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
            <div className="space-y-2">
              <label className="text-sm font-medium">AIモデル</label>
              <Select 
                value={audioFile.settings.model}
                onValueChange={(value) => updateSettings('model', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEMINI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">1字幕あたりの最大文字数</label>
              <Select 
                value={audioFile.settings.maxCharsPerSubtitle.toString()}
                onValueChange={(value) => updateSettings('maxCharsPerSubtitle', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15文字</SelectItem>
                  <SelectItem value="20">20文字</SelectItem>
                  <SelectItem value="25">25文字</SelectItem>
                  <SelectItem value="30">30文字</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                話者識別
                <span className="text-xs text-muted-foreground ml-2">
                  (現在: {audioFile.settings.enableSpeakerDetection ? '有効' : '無効'})
                </span>
              </label>
              <Select 
                value={audioFile.settings.enableSpeakerDetection ? 'true' : 'false'}
                onValueChange={(value) => updateSettings('enableSpeakerDetection', value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">有効 - 話者名を追加</SelectItem>
                  <SelectItem value="false">無効 - 純粋な発話内容のみ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {audioFile.status === 'idle' && (
            <Button onClick={startTranscription} className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              SRT字幕生成開始
            </Button>
          )}

          {audioFile.status === 'completed' && (
            <>
              <Button onClick={retryTranscription} variant="outline" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                再生成
              </Button>
              <Button 
                onClick={() => setShowResult(!showResult)} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {showResult ? '結果を隠す' : '結果を表示'}
              </Button>
              <Button onClick={downloadSrt} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                SRTダウンロード
              </Button>
            </>
          )}

          {audioFile.status === 'error' && (
            <Button onClick={retryTranscription} variant="outline" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              再試行
            </Button>
          )}
        </div>

        {/* Result Section */}
        {audioFile.status === 'completed' && showResult && audioFile.result && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">SRT字幕結果</h4>
              <div className="flex gap-2">
                <Button 
                  onClick={copyToClipboard} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Copy className="h-3 w-3" />
                  コピー
                </Button>
              </div>
            </div>
            
            {copySuccess && (
              <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                クリップボードにコピーしました
              </div>
            )}
            
            <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {audioFile.result}
              </pre>
            </div>
            
            {audioFile.subtitles && (
              <div className="text-sm text-muted-foreground">
                合計 {audioFile.subtitles.length} 個の字幕が生成されました
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SrtFileCard