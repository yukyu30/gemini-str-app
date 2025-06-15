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
import { SRT_PROMPT, INITIAL_TRANSCRIPTION_PROMPT } from '@/constants/prompts';
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

    if (audioFile.settings.enableAdvancedProcessing) {
      await startAdvancedTranscription(apiKey);
    } else {
      await startBasicTranscription(apiKey);
    }
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

  const startAdvancedTranscription = async (apiKey: string) => {
    onUpdate(audioFile.id, {
      status: 'processing',
      error: undefined,
      progress: 'ステップ 1/6: ファイルを一時保存中...',
      stages: {
        initialTranscription: {
          name: '基本文字起こし (Gemini 2.0 Flash)',
          status: 'pending',
        },
        topicAnalysis: {
          name: 'トピック分析 (Gemini 2.0 Flash)',
          status: 'pending',
        },
        dictionaryCreation: {
          name: '辞書作成 (Google検索+Gemini 2.0 Flash)',
          status: 'pending',
        },
        finalTranscription: {
          name: '最終字幕生成 (Gemini 2.5 Pro)',
          status: 'pending',
        },
      },
    });

    try {
      const tempFilePath = await saveFileTemporarily(audioFile.file);

      // ステップ1: 基本文字起こし（音声ファイルを使用）
      onUpdate(audioFile.id, {
        progress: 'ステップ 2/6: 基本文字起こし中... (Gemini 2.0 Flash)',
        stages: {
          ...audioFile.stages,
          initialTranscription: {
            name: '基本文字起こし (Gemini 2.0 Flash)',
            status: 'processing',
          },
        },
      });

      const initialPrompt = INITIAL_TRANSCRIPTION_PROMPT();
      const initialResult = await invoke<string>('transcribe_audio', {
        filePath: tempFilePath,
        prompt: initialPrompt,
        model: 'gemini-2.0-flash',
        apiKey,
      });

      onUpdate(audioFile.id, {
        stages: {
          ...audioFile.stages,
          initialTranscription: {
            name: '基本文字起こし (Gemini 2.0 Flash)',
            status: 'completed',
            result: initialResult,
          },
        },
      });

      // ステップ2: トピック分析（テキストベース処理）
      onUpdate(audioFile.id, {
        progress: 'ステップ 3/6: 会話トピック分析中... (Gemini 2.0 Flash)',
        stages: {
          ...audioFile.stages,
          topicAnalysis: {
            name: 'トピック分析 (Gemini 2.0 Flash)',
            status: 'processing',
          },
        },
      });

      const topicResult = await invoke<string>('analyze_topic', {
        transcription: initialResult,
        apiKey,
      });

      onUpdate(audioFile.id, {
        analyzedTopic: topicResult,
        stages: {
          ...audioFile.stages,
          topicAnalysis: {
            name: 'トピック分析 (Gemini 2.0 Flash)',
            status: 'completed',
            result: topicResult,
          },
        },
      });

      // ステップ3: 辞書作成（テキストベース処理）
      // トピックから主要テーマを抽出
      const topicLine = topicResult
        .split('\n')
        .find((line) => line.includes('メイントピック:'));
      const mainTopic = topicLine
        ? topicLine.replace('メイントピック:', '').trim()
        : 'この会話';

      onUpdate(audioFile.id, {
        progress: `ステップ 4/6: ${mainTopic}に関する用語集を生成中... (Google検索+Gemini 2.0 Flash)`,
        stages: {
          ...audioFile.stages,
          dictionaryCreation: {
            name: `用語集作成: ${mainTopic} (Google検索+Gemini 2.0 Flash)`,
            status: 'processing',
          },
        },
      });

      let dictionary = '';
      if (audioFile.settings.customDictionaryPath) {
        // カスタム辞書を読み込み
        dictionary = await invoke<string>('load_dictionary_csv', {
          filePath: audioFile.settings.customDictionaryPath,
        });
      } else {
        // 自動生成
        dictionary = await invoke<string>('create_dictionary', {
          topic: topicResult,
          apiKey,
        });

        // 生成した辞書をエクスポート
        const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '');
        const savedPath = await invoke<string>('save_dictionary_csv', {
          content: dictionary,
          suggestedFilename: `${baseName}_dictionary.csv`,
        });
        console.log('Dictionary saved to:', savedPath);
      }

      onUpdate(audioFile.id, {
        dictionary,
        stages: {
          ...audioFile.stages,
          dictionaryCreation: {
            name: `用語集作成: ${mainTopic} (Google検索+Gemini 2.0 Flash) - CSV保存済み`,
            status: 'completed',
            result: dictionary,
          },
        },
      });

      // ステップ4: 最終SRT生成（辞書付きテキスト変換）
      onUpdate(audioFile.id, {
        progress: 'ステップ 5/6: 高精度SRT字幕生成中... (Gemini 2.5 Pro)',
        stages: {
          ...audioFile.stages,
          finalTranscription: {
            name: '最終字幕生成 (Gemini 2.5 Pro)',
            status: 'processing',
          },
        },
      });

      // 文字起こし結果を辞書を使ってSRT形式に変換
      const finalResult = await invoke<string>(
        'enhance_transcription_with_dictionary',
        {
          initialTranscription: initialResult,
          dictionary: dictionary,
          maxCharsPerSubtitle: audioFile.settings.maxCharsPerSubtitle,
          enableSpeakerDetection: audioFile.settings.enableSpeakerDetection,
          apiKey,
        }
      );

      onUpdate(audioFile.id, { progress: 'ステップ 6/6: SRT形式の検証中...' });

      // Parse and validate SRT
      const subtitles = parseSrt(finalResult);
      const validation = validateSrt(finalResult);

      onUpdate(audioFile.id, {
        status: 'completed',
        result: finalResult,
        subtitles: validation.isValid ? subtitles : undefined,
        progress: undefined,
        srtValidation: validation,
        stages: {
          ...audioFile.stages,
          finalTranscription: {
            name: '最終字幕生成 (Gemini 2.5 Pro)',
            status: 'completed',
            result: finalResult,
          },
        },
      });
    } catch (error) {
      onUpdate(audioFile.id, {
        status: 'error',
        error: `高度処理でエラーが発生しました: ${error}`,
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

  const downloadDictionary = async () => {
    if (!audioFile.dictionary) {
      toast({
        variant: 'destructive',
        title: 'ダウンロードエラー',
        description: 'ダウンロードできる辞書がありません',
      });
      return;
    }

    const baseName = audioFile.file.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}_dictionary.csv`;

    try {
      await invoke<string>('save_dictionary_csv', {
        content: audioFile.dictionary,
        suggestedFilename: filename,
      });
      toast({
        variant: 'success',
        title: 'ダウンロード完了',
        description: `辞書CSV (${filename}) をダウンロードしました`,
      });
    } catch (error) {
      console.error('Dictionary download failed:', error);
      toast({
        variant: 'destructive',
        title: 'ダウンロードエラー',
        description: '辞書のダウンロードに失敗しました',
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
              <span className="text-xs text-muted-foreground">
                {audioFile.settings.enableAdvancedProcessing
                  ? '高精度モード'
                  : '標準モード'}
              </span>
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
                    <summary className="text-xs text-orange-600 cursor-pointer hover:text-orange-800 list-none">
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

            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">
                処理モード
                <span className="text-xs text-muted-foreground ml-2">
                  (現在:{' '}
                  {audioFile.settings.enableAdvancedProcessing
                    ? '高精度モード'
                    : '標準モード'}
                  )
                </span>
              </label>
              <Select
                value={
                  audioFile.settings.enableAdvancedProcessing ? 'true' : 'false'
                }
                onValueChange={(value) =>
                  updateSettings('enableAdvancedProcessing', value === 'true')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">標準モード - 高速処理</SelectItem>
                  <SelectItem value="true">
                    高精度モード - トピック分析＋専門用語辞書
                  </SelectItem>
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
              {audioFile.settings.enableAdvancedProcessing &&
                audioFile.dictionary && (
                  <Button
                    onClick={downloadDictionary}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
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
                  {showGeminiDebug
                    ? 'Geminiデバッグを隠す'
                    : 'Geminiデバッグを表示'}
                </Button>
              )}
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

        {/* GitHub Actions Style Processing Steps */}
        {audioFile.settings.enableAdvancedProcessing && (
          audioFile.status === 'processing' || audioFile.status === 'completed' || audioFile.status === 'error'
        ) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">処理ステップ (4段階)</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {audioFile.status === 'completed' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    すべて完了
                  </>
                )}
                {audioFile.status === 'processing' && (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    処理中
                  </>
                )}
              </div>
            </div>

            <div className="border rounded-lg bg-card overflow-hidden">
              {(() => {
                // デフォルトのステップ定義
                const defaultStages = {
                  initialTranscription: {
                    name: '基本文字起こし (Gemini 2.0 Flash)',
                    status: 'pending' as const,
                    description: '音声ファイルから基本的な文字起こしを行います'
                  },
                  topicAnalysis: {
                    name: 'トピック分析 (Gemini 2.0 Flash)',
                    status: 'pending' as const,
                    description: '文字起こし結果からトピックと主要テーマを分析します'
                  },
                  dictionaryCreation: {
                    name: '辞書作成 (Google検索+Gemini 2.0 Flash)',
                    status: 'pending' as const,
                    description: 'トピックに関連する専門用語辞書をGoogle検索で作成します'
                  },
                  finalTranscription: {
                    name: '最終字幕生成 (Gemini 2.5 Pro)',
                    status: 'pending' as const,
                    description: '辞書を使用して高精度なSRT字幕を生成します'
                  }
                };
                
                // 実際のステージと統合（実際のデータを優先）
                const stages = audioFile.stages ? 
                  Object.fromEntries(
                    Object.entries(defaultStages).map(([key, defaultStage]) => {
                      const stageKey = key as keyof typeof audioFile.stages;
                      return [
                        key, 
                        audioFile.stages?.[stageKey] ? {
                          ...defaultStage,
                          ...audioFile.stages[stageKey]
                        } : defaultStage
                      ];
                    })
                  ) : defaultStages;
                
                return Object.entries(stages).map(([key, stage], index) => {
                  const isExpanded =
                    stage.status === 'completed' || stage.status === 'error';

                  return (
                    <div
                    key={key}
                    id={`stage-detail-${key}`}
                    className={`border-b last:border-b-0 ${
                      stage.status === 'completed'
                        ? 'bg-green-50/30'
                        : stage.status === 'error'
                          ? 'bg-red-50/30'
                          : stage.status === 'processing'
                            ? 'bg-blue-50/30'
                            : 'bg-gray-50/30'
                    }`}
                  >
                    <details className="group" open={isExpanded}>
                      <summary className="cursor-pointer list-none">
                        <div className="p-4 hover:bg-muted/20 flex items-center gap-3">
                          <div className="flex items-center gap-3 flex-1">
                            {/* Step Icon */}
                            <div className="flex-shrink-0">
                              {stage.status === 'completed' && (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              )}
                              {stage.status === 'processing' && (
                                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                              )}
                              {stage.status === 'pending' && (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                              )}
                              {stage.status === 'error' && (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>

                            {/* Step Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm truncate">
                                  {stage.name}
                                </span>
                                <div className="flex items-center gap-2 ml-4">
                                  {stage.status === 'completed' && (
                                    <span className="text-xs text-green-600 font-medium">
                                      完了
                                    </span>
                                  )}
                                  {stage.status === 'processing' && (
                                    <span className="text-xs text-blue-600 font-medium">
                                      実行中
                                    </span>
                                  )}
                                  {stage.status === 'error' && (
                                    <span className="text-xs text-red-600 font-medium">
                                      エラー
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {index + 1}/4
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Expand Icon */}
                            <div className="flex-shrink-0">
                              <svg
                                className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z"
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </summary>

                      {/* Step Content */}
                      <div className="border-t bg-background/50">
                        <div className="p-4 pl-12">
                          {stage.status === 'completed' && stage.result && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                  <span className="text-sm font-medium text-green-700">
                                    このステップは正常に完了しました
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    navigator.clipboard.writeText(stage.result!)
                                  }
                                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                  レスポンスをコピー
                                </button>
                              </div>

                              <div className="bg-gray-950 text-gray-100 p-4 rounded-lg max-h-96 overflow-y-auto border">
                                <div className="text-xs text-gray-400 mb-2 font-mono">
                                  {key === 'initialTranscription' &&
                                    'Gemini 2.0 Flash - 基本文字起こしレスポンス:'}
                                  {key === 'topicAnalysis' &&
                                    'Gemini 2.0 Flash - トピック分析レスポンス:'}
                                  {key === 'dictionaryCreation' &&
                                    'Gemini 2.0 Flash + Google検索 - 辞書作成レスポンス:'}
                                  {key === 'finalTranscription' &&
                                    'Gemini 2.5 Pro - 最終SRT生成レスポンス:'}
                                </div>
                                <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed">
                                  {stage.result}
                                </pre>
                              </div>

                              {/* 特定のステップに応じた追加情報 */}
                              {key === 'topicAnalysis' && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                  <div className="text-xs font-medium text-blue-700 mb-1">
                                    分析結果:
                                  </div>
                                  <div className="text-sm text-blue-600">
                                    このトピック分析結果を基に、次のステップで専門用語辞書が作成されます
                                  </div>
                                </div>
                              )}

                              {key === 'dictionaryCreation' &&
                                audioFile.dictionary && (
                                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                                    <div className="text-xs font-medium text-green-700 mb-1">
                                      生成された辞書:
                                    </div>
                                    <div className="text-sm text-green-600">
                                      この辞書は最終的なSRT生成で専門用語の正確性向上に使用されます
                                    </div>
                                    <div className="mt-2 bg-white border p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                                      {audioFile.dictionary}
                                    </div>
                                  </div>
                                )}

                              {key === 'initialTranscription' && (
                                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                                  <div className="text-xs font-medium text-yellow-700 mb-1">
                                    次のステップ:
                                  </div>
                                  <div className="text-sm text-yellow-600">
                                    この基本文字起こし結果を基にトピック分析が実行されます
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {stage.status === 'processing' && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-blue-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">
                                  このステップを実行中です...
                                </span>
                              </div>
                              {stage.description && (
                                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                  <div className="text-xs font-medium text-blue-700 mb-1">
                                    実行中の処理:
                                  </div>
                                  <div className="text-sm text-blue-600">
                                    {stage.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {stage.status === 'error' && stage.error && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm font-medium text-red-700">
                                  このステップでエラーが発生しました
                                </span>
                              </div>
                              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                                <pre className="text-sm whitespace-pre-wrap">
                                  {stage.error}
                                </pre>
                              </div>
                            </div>
                          )}

                          {stage.status === 'pending' && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 text-gray-500">
                                <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                                <span className="text-sm">
                                  このステップは待機中です
                                </span>
                              </div>
                              {stage.description && (
                                <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                                  <div className="text-xs font-medium text-gray-700 mb-1">
                                    ステップ概要:
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {stage.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Gemini Debug Section (for standard mode) */}
        {audioFile.status === 'completed' &&
          showGeminiDebug &&
          !audioFile.settings.enableAdvancedProcessing &&
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
                    <div className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">
                      ▼
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
