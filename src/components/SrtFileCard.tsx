import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  Loader2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { AudioFile, SrtSettings } from '@/types/srt';
import { SRT_PROMPT } from '@/constants/prompts';
import { storageUtils } from '@/utils/storage';
import { formatFileSize } from '@/lib/utils';
import { downloadSrtFile, parseSrt, validateSrt } from '@/lib/srt-utils';
import { useToast } from '@/hooks/use-toast';

interface SrtFileCardProps {
  audioFile: AudioFile;
  onUpdate: (id: string, updates: Partial<AudioFile>) => void;
  onDelete: (id: string) => void;
}

const SrtFileCard = ({ audioFile, onUpdate, onDelete }: SrtFileCardProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showGeminiDebug, setShowGeminiDebug] = useState(false);
  const { toast } = useToast();

  const saveFileTemporarily = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const tempFilePath = await invoke<string>('save_temp_file', {
      fileData: Array.from(uint8Array),
      fileName: file.name,
    });

    return tempFilePath;
  };

  const startTranscription = async () => {
    const apiKey = storageUtils.getApiKey();
    if (!apiKey) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: 'API key not found. Please set your Gemini API key in settings.',
      });
      return;
    }

    await startBasicTranscription(apiKey);
  };

  const startBasicTranscription = async (apiKey: string) => {
    onUpdate(audioFile.id, {
      status: 'processing',
      error: undefined,
      progress: 'ステップ 1/5: ファイルを一時保存中... (数秒)',
    });

    try {
      const tempFilePath = await saveFileTemporarily(audioFile.file);

      onUpdate(audioFile.id, {
        progress: 'ステップ 2/5: プロンプトを準備中...',
      });

      const prompt = SRT_PROMPT(
        undefined,
        audioFile.settings.maxCharsPerSubtitle,
        audioFile.settings.enableSpeakerDetection
      );

      onUpdate(audioFile.id, {
        progress: 'ステップ 3/5: Gemini APIに音声ファイルを送信中...',
      });
      await new Promise((resolve) => setTimeout(resolve, 500));

      onUpdate(audioFile.id, {
        progress: 'ステップ 4/5: AI音声解析・SRT字幕生成中... (1-3分)',
      });

      const result = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt,
        model: 'gemini-2.5-pro-preview-06-05',
        apiKey,
      });

      onUpdate(audioFile.id, {
        progress: 'ステップ 5/5: SRT形式の検証と最終化中...',
      });

      // Parse and validate SRT
      const subtitles = parseSrt(result);
      const validation = validateSrt(result);

      onUpdate(audioFile.id, {
        status: 'completed',
        result,
        subtitles: validation.isValid ? subtitles : undefined,
        progress: undefined,
        srtValidation: validation,
      });
    } catch (error) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: `エラーが発生しました: ${error}`,
        progress: undefined,
      });
    }
  };


  const retryTranscription = () => {
    startTranscription();
  };

  const copyToClipboard = async () => {
    if (!audioFile.result) return;

    try {
      await navigator.clipboard.writeText(audioFile.result);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadSrt = async () => {
    if (!audioFile.result) {
      toast({
        variant: 'destructive',
        title: 'ダウンロードエラー',
        description: 'ダウンロードできる内容がありません',
      });
      return;
    }

    const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_subtitles.srt`;

    try {
      await downloadSrtFile(audioFile.result, filename);
      toast({
        variant: 'success',
        title: 'ダウンロード完了',
        description: `${filename} をダウンロードしました`,
      });
    } catch (error) {
      console.error('Download failed in SrtFileCard:', error);
      toast({
        variant: 'destructive',
        title: 'ダウンロードエラー',
        description: 'ファイルのダウンロードに失敗しました',
      });
    }
  };


  const updateSettings = (key: keyof SrtSettings, value: any) => {
    onUpdate(audioFile.id, {
      settings: { ...audioFile.settings, [key]: value },
    });
  };

  const getStatusIcon = () => {
    switch (audioFile.status) {
      case 'idle':
        return <Play className="h-4 w-4" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusVariant = () => {
    switch (audioFile.status) {
      case 'idle':
        return 'secondary';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'success';
      case 'error':
        return 'destructive';
    }
  };

  const getStatusText = () => {
    switch (audioFile.status) {
      case 'idle':
        return '待機中';
      case 'processing':
        return '処理中';
      case 'completed':
        return '完了';
      case 'error':
        return 'エラー';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">
              {audioFile.file.name}
              {audioFile.file.size === 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (履歴から復元)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatFileSize(audioFile.file.size)}</span>
              <Badge
                variant={getStatusVariant()}
                className="flex items-center gap-1"
              >
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
            </div>
            <Progress value={undefined} className="h-3" />
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">
                {audioFile.progress}
              </p>
            </div>
          </div>
        )}

        {/* Error Section */}
        {audioFile.status === 'error' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-sm text-destructive">{audioFile.error}</p>
          </div>
        )}

        {/* SRT Validation Warning */}
        {audioFile.status === 'completed' &&
          audioFile.srtValidation &&
          !audioFile.srtValidation.isValid && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-800">
                    SRT形式の警告
                  </p>
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
              <label className="text-sm font-medium">
                1字幕あたりの最大文字数
              </label>
              <Select
                value={audioFile.settings.maxCharsPerSubtitle.toString()}
                onValueChange={(value) =>
                  updateSettings('maxCharsPerSubtitle', parseInt(value))
                }
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
                  (現在:{' '}
                  {audioFile.settings.enableSpeakerDetection ? '有効' : '無効'})
                </span>
              </label>
              <Select
                value={
                  audioFile.settings.enableSpeakerDetection ? 'true' : 'false'
                }
                onValueChange={(value) =>
                  updateSettings('enableSpeakerDetection', value === 'true')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">有効 - 話者名を追加</SelectItem>
                  <SelectItem value="false">
                    無効 - 純粋な発話内容のみ
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {audioFile.status === 'idle' && (
            <Button
              onClick={startTranscription}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              SRT字幕生成開始
            </Button>
          )}

          {audioFile.status === 'completed' && (
            <>
              <Button onClick={downloadSrt} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                {audioFile.srtValidation && !audioFile.srtValidation.isValid
                  ? 'テキストダウンロード (.srt)'
                  : 'SRTダウンロード'}
              </Button>
              <Button
                onClick={() => setShowGeminiDebug(!showGeminiDebug)}
                variant="ghost"
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {showGeminiDebug
                  ? 'Geminiデバッグを隠す'
                  : 'Geminiデバッグを表示'}
              </Button>
              <Button
                onClick={retryTranscription}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                再生成
              </Button>
            </>
          )}

          {audioFile.status === 'error' && (
            <Button
              onClick={retryTranscription}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              再試行
            </Button>
          )}
        </div>

        {/* Result Section */}
        {audioFile.status === 'completed' && audioFile.result && (
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
              {audioFile.subtitles
                ? `合計 ${audioFile.subtitles.length} 個の字幕が生成されました`
                : audioFile.srtValidation && !audioFile.srtValidation.isValid
                  ? 'SRT形式の解析に失敗しましたが、生のテキストを表示・ダウンロードできます'
                  : 'テキストが生成されました'}
            </div>
          </div>
        )}


        {/* Gemini Debug Section */}
        {audioFile.status === 'completed' &&
          showGeminiDebug &&
          audioFile.result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Geminiレスポンスデバッグ情報</h4>
              </div>

              <div className="border rounded-lg bg-card">
                <details className="group">
                  <summary className="cursor-pointer list-none p-4 hover:bg-muted/30 flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">
                        標準文字起こし (Gemini 2.5 Pro Preview)
                      </span>
                    </div>
                  </summary>

                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">
                          ✓ 処理完了
                        </span>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(audioFile.result!)
                          }
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
  );
};

export default SrtFileCard;
