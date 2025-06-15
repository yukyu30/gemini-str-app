import { useState, useEffect } from 'react'
import { AlertCircle, FileAudio, Settings as SettingsIcon, Save } from 'lucide-react'

import SrtDropZone from './SrtDropZone'
import SrtFileCard from './SrtFileCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { AudioFile, DEFAULT_SRT_SETTINGS, SrtSettings } from '@/types/srt'
import { settingsStorage } from '@/lib/settings-storage'
import { useProcessing } from '../App'

const SrtTranscription = () => {
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [globalError, setGlobalError] = useState('')
  const [globalSettings, setGlobalSettings] = useState<SrtSettings>(DEFAULT_SRT_SETTINGS)
  const [settingsSaved, setSettingsSaved] = useState(false)
  
  const { setProcessingCount } = useProcessing()

  // Load default settings on component mount
  useEffect(() => {
    const savedSettings = settingsStorage.loadDefaultSettings()
    setGlobalSettings(savedSettings)
  }, [])

  // Update processing count whenever file statuses change
  useEffect(() => {
    const processingCount = audioFiles.filter(file => file.status === 'processing').length
    setProcessingCount(processingCount)
  }, [audioFiles, setProcessingCount])

  const handleFilesAdded = (files: File[]) => {
    const newAudioFiles = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      settings: { ...globalSettings },
      status: 'idle' as const,
      result: undefined,
      subtitles: undefined,
      error: undefined,
      progress: undefined
    }))

    setAudioFiles(prev => [...prev, ...newAudioFiles])
    setGlobalError('')
  }

  const handleFileUpdate = (id: string, updates: Partial<AudioFile>) => {
    setAudioFiles(prev => 
      prev.map(file => 
        file.id === id ? { ...file, ...updates } : file
      )
    )
  }

  const handleFileDelete = (id: string) => {
    setAudioFiles(prev => prev.filter(file => file.id !== id))
  }

  const handleFileError = (error: string) => {
    setGlobalError(error)
  }

  const applyGlobalSettings = () => {
    setAudioFiles(prev => 
      prev.map(file => ({
        ...file,
        settings: { ...globalSettings }
      }))
    )
  }

  const clearCompleted = () => {
    setAudioFiles(prev => prev.filter(file => file.status !== 'completed'))
  }

  const retryErrors = () => {
    setAudioFiles(prev => 
      prev.map(file => 
        file.status === 'error' 
          ? { ...file, status: 'idle', error: undefined }
          : file
      )
    )
  }

  const getStatusCounts = () => {
    const counts = {
      idle: 0,
      processing: 0,
      completed: 0,
      error: 0
    }
    
    audioFiles.forEach(file => {
      counts[file.status]++
    })
    
    return counts
  }

  const updateGlobalSetting = (key: keyof SrtSettings, value: any) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }))
    setSettingsSaved(false) // Mark as unsaved when settings change
  }

  const saveDefaultSettings = () => {
    settingsStorage.saveDefaultSettings(globalSettings)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000) // Reset after 2 seconds
  }



  const statusCounts = getStatusCounts()

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <FileAudio className="h-8 w-8" />
          SRT字幕生成ツール
        </h1>
        <p className="text-muted-foreground">
          音声ファイルから高品質なSRT字幕ファイルを自動生成
        </p>
        
      </div>

      <SrtDropZone 
        onFilesAdded={handleFilesAdded}
        onError={handleFileError}
      />

      {globalError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="whitespace-pre-line">{globalError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {audioFiles.length > 0 && (
        <>
          {/* Status Summary & Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                制御パネル
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  待機中: {statusCounts.idle}
                </Badge>
                <Badge variant="processing" className="flex items-center gap-1">
                  処理中: {statusCounts.processing}
                </Badge>
                <Badge variant="success" className="flex items-center gap-1">
                  完了: {statusCounts.completed}
                </Badge>
                <Badge variant="destructive" className="flex items-center gap-1">
                  エラー: {statusCounts.error}
                </Badge>
              </div>

              {/* Global Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">デフォルト設定</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-md">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">最大文字数/字幕</label>
                      <Select 
                        value={globalSettings.maxCharsPerSubtitle.toString()}
                        onValueChange={(value) => updateGlobalSetting('maxCharsPerSubtitle', parseInt(value))}
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
                        <span className="text-xs text-muted-foreground">
                          (現在: {globalSettings.enableSpeakerDetection ? '有効' : '無効'})
                        </span>
                      </label>
                      <Select 
                        value={globalSettings.enableSpeakerDetection ? 'true' : 'false'}
                        onValueChange={(value) => updateGlobalSetting('enableSpeakerDetection', value === 'true')}
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


                  <div className="md:col-span-2 flex gap-2">
                    <Button
                      variant="outline"
                      onClick={applyGlobalSettings}
                      className="flex-1"
                    >
                      全ファイルに設定を適用
                    </Button>
                    <Button
                      onClick={saveDefaultSettings}
                      className="flex items-center gap-2"
                      disabled={settingsSaved}
                    >
                      <Save className="h-4 w-4" />
                      {settingsSaved ? '保存済み' : 'デフォルトとして保存'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bulk Actions */}
              <div className="flex flex-wrap gap-2">
                {statusCounts.error > 0 && (
                  <Button variant="outline" onClick={retryErrors}>
                    エラーファイルを再試行 ({statusCounts.error})
                  </Button>
                )}
                {statusCounts.completed > 0 && (
                  <Button variant="outline" onClick={clearCompleted}>
                    完了ファイルを削除 ({statusCounts.completed})
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>


          {/* File List */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">音声ファイル ({audioFiles.length})</h3>
            {audioFiles.map(audioFile => (
              <SrtFileCard
                key={audioFile.id}
                audioFile={audioFile}
                onUpdate={handleFileUpdate}
                onDelete={handleFileDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SrtTranscription