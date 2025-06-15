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
import { 
  SRT_PROMPT, 
  INITIAL_TRANSCRIPTION_PROMPT, 
  GEMINI_MODELS 
} from '@/constants/prompts'
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
  const [showGeminiDebug, setShowGeminiDebug] = useState(false)

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

    if (audioFile.settings.enableAdvancedProcessing) {
      await startAdvancedTranscription(apiKey)
    } else {
      await startBasicTranscription(apiKey)
    }
  }

  const startBasicTranscription = async (apiKey: string) => {
    onUpdate(audioFile.id, {
      status: 'processing',
      error: undefined,
      progress: 'ステップ 1/5: ファイルを一時保存中... (数秒)'
    })

    try {
      const tempFilePath = await saveFileTemporarily(audioFile.file)
      
      onUpdate(audioFile.id, { progress: 'ステップ 2/5: プロンプトを準備中...' })
      
      const prompt = SRT_PROMPT(
        undefined,
        audioFile.settings.maxCharsPerSubtitle,
        audioFile.settings.enableSpeakerDetection
      )
      
      onUpdate(audioFile.id, { progress: 'ステップ 3/5: Gemini APIに音声ファイルを送信中...' })
      await new Promise(resolve => setTimeout(resolve, 500))
      
      onUpdate(audioFile.id, { progress: 'ステップ 4/5: AI音声解析・SRT字幕生成中... (1-3分)' })
      
      const result = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt,
        model: audioFile.settings.model,
        apiKey
      })

      onUpdate(audioFile.id, { progress: 'ステップ 5/5: SRT形式の検証と最終化中...' })

      // Parse and validate SRT
      const subtitles = parseSrt(result)
      const validation = validateSrt(result)
      
      onUpdate(audioFile.id, {
        status: 'completed',
        result,
        subtitles: validation.isValid ? subtitles : undefined,
        progress: undefined,
        srtValidation: validation
      })
    } catch (error) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: `エラーが発生しました: ${error}`,
        progress: undefined
      })
    }
  }

  const startAdvancedTranscription = async (apiKey: string) => {
    onUpdate(audioFile.id, {
      status: 'processing',
      error: undefined,
      progress: 'ステップ 1/6: ファイルを一時保存中...',
      stages: {
        initialTranscription: { name: '基本文字起こし (Gemini 2.0 Flash)', status: 'pending' },
        topicAnalysis: { name: 'トピック分析 (Gemini 2.0 Flash)', status: 'pending' },
        dictionaryCreation: { name: '辞書作成 (Google検索+Gemini 2.0 Flash)', status: 'pending' },
        finalTranscription: { name: '最終字幕生成 (Gemini 2.5 Pro)', status: 'pending' }
      }
    })

    try {
      const tempFilePath = await saveFileTemporarily(audioFile.file)
      
      // ステップ1: 基本文字起こし（音声ファイルを使用）
      onUpdate(audioFile.id, { 
        progress: 'ステップ 2/6: 基本文字起こし中... (Gemini 2.0 Flash)',
        stages: {
          ...audioFile.stages,
          initialTranscription: { name: '基本文字起こし (Gemini 2.0 Flash)', status: 'processing' }
        }
      })
      
      const initialPrompt = INITIAL_TRANSCRIPTION_PROMPT()
      const initialResult = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt: initialPrompt,
        model: 'gemini-2.0-flash',
        apiKey
      })

      onUpdate(audioFile.id, {
        stages: {
          ...audioFile.stages,
          initialTranscription: { name: '基本文字起こし (Gemini 2.0 Flash)', status: 'completed', result: initialResult }
        }
      })

      // ステップ2: トピック分析（テキストベース処理）
      onUpdate(audioFile.id, { 
        progress: 'ステップ 3/6: 会話トピック分析中... (Gemini 2.0 Flash)',
        stages: {
          ...audioFile.stages,
          topicAnalysis: { name: 'トピック分析 (Gemini 2.0 Flash)', status: 'processing' }
        }
      })

      const topicResult = await invoke<string>('analyze_topic', {
        transcription: initialResult,
        apiKey
      })

      onUpdate(audioFile.id, {
        analyzedTopic: topicResult,
        stages: {
          ...audioFile.stages,
          topicAnalysis: { name: 'トピック分析 (Gemini 2.0 Flash)', status: 'completed', result: topicResult }
        }
      })

      // ステップ3: 辞書作成（テキストベース処理）
      // トピックから主要テーマを抽出
      const topicLine = topicResult.split('\n').find(line => line.includes('メイントピック:'))
      const mainTopic = topicLine ? topicLine.replace('メイントピック:', '').trim() : 'この会話'
      
      onUpdate(audioFile.id, { 
        progress: `ステップ 4/6: ${mainTopic}に関する用語集を生成中... (Google検索+Gemini 2.0 Flash)`,
        stages: {
          ...audioFile.stages,
          dictionaryCreation: { name: `用語集作成: ${mainTopic} (Google検索+Gemini 2.0 Flash)`, status: 'processing' }
        }
      })

      let dictionary = ''
      if (audioFile.settings.customDictionaryPath) {
        // カスタム辞書を読み込み
        dictionary = await invoke<string>('load_dictionary_csv', {
          filePath: audioFile.settings.customDictionaryPath
        })
      } else {
        // 自動生成
        dictionary = await invoke<string>('create_dictionary', {
          topic: topicResult,
          apiKey
        })
        
        // 生成した辞書をエクスポート
        const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '')
        const savedPath = await invoke<string>('save_dictionary_csv', {
          content: dictionary,
          suggestedFilename: `${baseName}_dictionary.csv`
        })
        console.log('Dictionary saved to:', savedPath)
      }

      onUpdate(audioFile.id, {
        dictionary,
        stages: {
          ...audioFile.stages,
          dictionaryCreation: { name: `用語集作成: ${mainTopic} (Google検索+Gemini 2.0 Flash) - CSV保存済み`, status: 'completed', result: dictionary }
        }
      })

      // ステップ4: 最終SRT生成（辞書付きテキスト変換）
      onUpdate(audioFile.id, { 
        progress: 'ステップ 5/6: 高精度SRT字幕生成中... (Gemini 2.5 Pro)',
        stages: {
          ...audioFile.stages,
          finalTranscription: { name: '最終字幕生成 (Gemini 2.5 Pro)', status: 'processing' }
        }
      })

      // 文字起こし結果を辞書を使ってSRT形式に変換
      const finalResult = await invoke<string>('enhance_transcription_with_dictionary', {
        initialTranscription: initialResult,
        dictionary: dictionary,
        maxCharsPerSubtitle: audioFile.settings.maxCharsPerSubtitle,
        enableSpeakerDetection: audioFile.settings.enableSpeakerDetection,
        apiKey
      })

      onUpdate(audioFile.id, { progress: 'ステップ 6/6: SRT形式の検証中...' })

      // Parse and validate SRT
      const subtitles = parseSrt(finalResult)
      const validation = validateSrt(finalResult)
      
      onUpdate(audioFile.id, {
        status: 'completed',
        result: finalResult,
        subtitles: validation.isValid ? subtitles : undefined,
        progress: undefined,
        srtValidation: validation,
        stages: {
          ...audioFile.stages,
          finalTranscription: { name: '最終字幕生成 (Gemini 2.5 Pro)', status: 'completed', result: finalResult }
        }
      })
    } catch (error) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: `高度処理でエラーが発生しました: ${error}`,
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

  const downloadSrt = async () => {
    if (!audioFile.result) {
      alert('ダウンロードできる内容がありません')
      return
    }
    
    const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '')
    const filename = `${baseName}_subtitles.srt`
    
    try {
      await downloadSrtFile(audioFile.result, filename)
    } catch (error) {
      console.error('Download failed in SrtFileCard:', error)
      alert('ファイルのダウンロードに失敗しました')
    }
  }

  const downloadDictionary = async () => {
    if (!audioFile.dictionary) {
      alert('ダウンロードできる辞書がありません')
      return
    }
    
    const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '')
    const filename = `${baseName}_dictionary.csv`
    
    try {
      const savedPath = await invoke<string>('save_dictionary_csv', {
        content: audioFile.dictionary,
        suggestedFilename: filename
      })
      alert(`辞書CSVを保存しました: ${savedPath}`)
    } catch (error) {
      console.error('Dictionary download failed:', error)
      alert('辞書のダウンロードに失敗しました')
    }
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
              {audioFile.file.size === 0 && (
                <span className="ml-2 text-xs text-muted-foreground">(履歴から復元)</span>
              )}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">生成進行状況</span>
              <span className="text-xs text-muted-foreground">
                {audioFile.settings.enableAdvancedProcessing ? '高精度モード' : '標準モード'}
              </span>
            </div>
            <Progress value={undefined} className="h-3" />
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">{audioFile.progress}</p>
            </div>
            
            {/* Advanced Processing Stages */}
            {audioFile.settings.enableAdvancedProcessing && audioFile.stages && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-md">
                <p className="text-xs font-medium text-muted-foreground">処理段階</p>
                {Object.entries(audioFile.stages).map(([key, stage]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      {stage.status === 'completed' && <CheckCircle className="h-3 w-3 text-green-500" />}
                      {stage.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      {stage.status === 'pending' && <div className="h-3 w-3 rounded-full bg-gray-300" />}
                      {stage.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                      <span className={stage.status === 'completed' ? 'text-green-600' : stage.status === 'processing' ? 'text-blue-600' : 'text-muted-foreground'}>
                        {stage.name}
                      </span>
                      {stage.status === 'completed' && stage.result && (
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            onClick={() => {
                              const element = document.getElementById(`stage-detail-${key}`)
                              if (element) {
                                const details = element.querySelector('details') as HTMLDetailsElement
                                if (details) {
                                  details.open = !details.open
                                }
                                element.scrollIntoView({ behavior: 'smooth' })
                              }
                            }}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            デバッグ
                          </button>
                        </div>
                      )}
                      {stage.status === 'processing' && (
                        <div className="ml-auto">
                          <span className="text-xs text-blue-600">♻️ 実行中</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Inline debug info for completed steps */}
                    {stage.status === 'completed' && stage.result && (
                      <div className="ml-5 border-l-2 border-green-200 pl-3">
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
                            <span>☑️ 完了 - レスポンス確認</span>
                            <span className="group-open:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="mt-2 bg-gray-900 text-gray-100 p-2 rounded text-xs max-h-32 overflow-y-auto">
                            <pre className="whitespace-pre-wrap font-mono">
                              {stage.result.length > 300 ? stage.result.substring(0, 300) + '...' : stage.result}
                            </pre>
                          </div>
                          <div className="mt-1 flex gap-2">
                            <button
                              onClick={() => navigator.clipboard.writeText(stage.result!)}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              コピー
                            </button>
                            <button
                              onClick={() => {
                                const element = document.getElementById(`stage-detail-${key}`)
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth' })
                                }
                              }}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              詳細表示
                            </button>
                          </div>
                        </details>
                      </div>
                    )}
                    
                    {stage.status === 'error' && stage.error && (
                      <div className="ml-5 text-xs text-red-600 bg-red-50 p-2 rounded border-l-2 border-red-200">
                        <div className="font-medium">❌ エラー詳細:</div>
                        <pre className="mt-1 whitespace-pre-wrap">{stage.error}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Section */}
        {audioFile.status === 'error' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{audioFile.error}</p>
          </div>
        )}

        {/* SRT Validation Warning */}
        {audioFile.status === 'completed' && audioFile.srtValidation && !audioFile.srtValidation.isValid && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800">SRT形式の警告</p>
                <p className="text-sm text-orange-700 mt-1">
                  生成されたテキストにSRT形式の問題がありますが、内容の表示とダウンロードは可能です。
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-orange-600 cursor-pointer hover:text-orange-800">
                    詳細を表示
                  </summary>
                  <ul className="text-xs text-orange-600 mt-1 ml-4">
                    {audioFile.srtValidation.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
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

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">
                処理モード
                <span className="text-xs text-muted-foreground ml-2">
                  (現在: {audioFile.settings.enableAdvancedProcessing ? '高精度モード' : '標準モード'})
                </span>
              </label>
              <Select 
                value={audioFile.settings.enableAdvancedProcessing ? 'true' : 'false'}
                onValueChange={(value) => updateSettings('enableAdvancedProcessing', value === 'true')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">標準モード - 高速処理</SelectItem>
                  <SelectItem value="true">高精度モード - トピック分析＋専門用語辞書</SelectItem>
                </SelectContent>
              </Select>
              {audioFile.settings.enableAdvancedProcessing && (
                <p className="text-xs text-muted-foreground">
                  高精度モードでは、文字起こし→トピック分析→Google検索で正確性を確認した辞書作成→最終生成の4段階処理を行います
                </p>
              )}
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
                {audioFile.srtValidation && !audioFile.srtValidation.isValid 
                  ? 'テキストダウンロード (.srt)' 
                  : 'SRTダウンロード'
                }
              </Button>
              {audioFile.settings.enableAdvancedProcessing && audioFile.dictionary && (
                <Button onClick={downloadDictionary} variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  辞書CSVダウンロード
                </Button>
              )}
              {!audioFile.settings.enableAdvancedProcessing && (
                <Button 
                  onClick={() => setShowGeminiDebug(!showGeminiDebug)} 
                  variant="ghost" 
                  className="flex items-center gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {showGeminiDebug ? 'Geminiデバッグを隠す' : 'Geminiデバッグを表示'}
                </Button>
              )}
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
            
            <div className="text-sm text-muted-foreground">
              {audioFile.subtitles ? (
                `合計 ${audioFile.subtitles.length} 個の字幕が生成されました`
              ) : audioFile.srtValidation && !audioFile.srtValidation.isValid ? (
                'SRT形式の解析に失敗しましたが、生のテキストを表示・ダウンロードできます'
              ) : (
                'テキストが生成されました'
              )}
            </div>
            
            {/* Generated Dictionary Section */}
            {audioFile.settings.enableAdvancedProcessing && audioFile.dictionary && (
              <div className="space-y-2 mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <h5 className="font-medium text-sm">生成された専門用語辞書</h5>
                  <Button 
                    onClick={downloadDictionary} 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-3 w-3" />
                    CSV保存
                  </Button>
                </div>
                <div className="bg-muted p-3 rounded-md max-h-48 overflow-y-auto">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {audioFile.dictionary}
                  </pre>
                </div>
                <div className="text-xs text-muted-foreground">
                  専門用語辞書が生成されました。この辞書を使用してより精度の高い字幕が作成されています。
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Steps Details (GitHub Actions style) */}
        {audioFile.status === 'completed' && audioFile.settings.enableAdvancedProcessing && audioFile.stages && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">処理詳細</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                完了済み
              </div>
            </div>
            
            <div className="border rounded-lg bg-card">
              {Object.entries(audioFile.stages).map(([key, stage], index) => (
                <div key={key} id={`stage-detail-${key}`} className={`border-b last:border-b-0 ${stage.status === 'completed' ? 'bg-green-50/50' : stage.status === 'error' ? 'bg-red-50/50' : ''}`}>
                  <details className="group">
                    <summary className="cursor-pointer p-4 hover:bg-muted/30 flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {stage.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                        {stage.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
                        <span className="font-medium text-sm">{stage.name}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          ステップ {index + 1}/{Object.keys(audioFile.stages || {}).length}
                        </div>
                        <div className="text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                          ▼
                        </div>
                      </div>
                    </summary>
                    
                    <div className="px-4 pb-4">
                      {stage.status === 'completed' && stage.result && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-600">✓ 処理完了</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigator.clipboard.writeText(stage.result!)}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                コピー
                              </button>
                            </div>
                          </div>
                          <div className="bg-gray-900 text-gray-100 p-3 rounded-md max-h-80 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap font-mono">
                              {stage.result}
                            </pre>
                          </div>
                        </div>
                      )}
                      
                      {stage.status === 'error' && stage.error && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-red-600">✗ エラーが発生しました</span>
                          <div className="bg-red-100 text-red-800 p-3 rounded-md">
                            <pre className="text-xs whitespace-pre-wrap">
                              {stage.error}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gemini Debug Section (for standard mode) */}
        {audioFile.status === 'completed' && showGeminiDebug && !audioFile.settings.enableAdvancedProcessing && audioFile.result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Geminiレスポンスデバッグ情報</h4>
            </div>
            
            <div className="border rounded-lg bg-card">
              <details className="group">
                <summary className="cursor-pointer p-4 hover:bg-muted/30 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-sm">標準文字起こし (Gemini {audioFile.settings.model})</span>
                  </div>
                  <div className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                    ▼
                  </div>
                </summary>
                
                <div className="px-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-600">✓ 処理完了</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(audioFile.result!)}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        コピー
                      </button>
                    </div>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-md max-h-80 overflow-y-auto">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {audioFile.result}
                      </pre>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SrtFileCard