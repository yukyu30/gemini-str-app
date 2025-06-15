import { useState, createContext, useContext } from "react";
import SrtTranscription from "./components/SrtTranscription";
import Settings from "./components/Settings";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { Toaster } from "./components/ui/toaster";
import { FileAudio, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { useProcessingLock } from "./hooks/useProcessingLock";

type ActiveTab = 'transcription' | 'settings';

// Processing状態を管理するContext
interface ProcessingContextType {
  processingCount: number
  setProcessingCount: (count: number) => void
  isProcessing: boolean
}

const ProcessingContext = createContext<ProcessingContextType | null>(null)

export const useProcessing = () => {
  const context = useContext(ProcessingContext)
  if (!context) {
    throw new Error('useProcessing must be used within ProcessingProvider')
  }
  return context
}

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcription')
  const [processingCount, setProcessingCount] = useState(0)
  const [showNavigationWarning, setShowNavigationWarning] = useState(false)
  
  const isProcessing = processingCount > 0

  // 処理中のナビゲーション制御
  const handleTabChange = (newTab: ActiveTab) => {
    if (isProcessing) {
      setShowNavigationWarning(true)
      return
    }
    setActiveTab(newTab)
  }

  const confirmNavigation = () => {
    setShowNavigationWarning(false)
    // 処理を強制停止することはできないので、警告のみ
    const proceed = window.confirm(
      `${processingCount}件の音声変換が実行中です。\n` +
      'タブを切り替えると処理状況を確認できなくなります。\n' +
      '続行しますか？'
    )
    
    if (proceed) {
      setActiveTab(activeTab === 'transcription' ? 'settings' : 'transcription')
    }
  }

  // ページ離脱の制御
  useProcessingLock({
    isProcessing,
    processingCount,
    onNavigationAttempt: confirmNavigation
  })

  return (
    <ProcessingContext.Provider value={{ processingCount, setProcessingCount, isProcessing }}>
      <main className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileAudio className="h-8 w-8 text-primary" />
                <h1 className="text-2xl font-bold">SRT字幕生成ツール</h1>
                {isProcessing && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">{processingCount}件処理中</span>
                  </div>
                )}
              </div>
              <nav className="flex gap-2">
                <Button 
                  variant={activeTab === 'transcription' ? 'default' : 'ghost'}
                  onClick={() => handleTabChange('transcription')}
                  className="flex items-center gap-2"
                  disabled={isProcessing && activeTab !== 'transcription'}
                >
                  <FileAudio className="h-4 w-4" />
                  字幕生成
                  {isProcessing && activeTab !== 'transcription' && (
                    <span className="text-xs">(処理中)</span>
                  )}
                </Button>
                <Button 
                  variant={activeTab === 'settings' ? 'default' : 'ghost'}
                  onClick={() => handleTabChange('settings')}
                  className="flex items-center gap-2"
                  disabled={isProcessing && activeTab !== 'settings'}
                >
                  <SettingsIcon className="h-4 w-4" />
                  設定
                  {isProcessing && activeTab !== 'settings' && (
                    <span className="text-xs">(処理中)</span>
                  )}
                </Button>
              </nav>
            </div>
          </div>
        </header>

        <div className="py-6">
          {activeTab === 'transcription' && <SrtTranscription />}
          {activeTab === 'settings' && (
            <div className="container mx-auto px-6 max-w-2xl">
              <Card>
                <CardContent className="pt-6">
                  <Settings />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* Processing Warning Modal */}
        {showNavigationWarning && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-orange-500" />
                  <h3 className="text-lg font-semibold">処理実行中</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  {processingCount}件の音声変換が実行中です。
                  タブを切り替えると処理状況を確認できなくなります。
                </p>
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNavigationWarning(false)}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={confirmNavigation}>
                    続行
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <Toaster />
      </main>
    </ProcessingContext.Provider>
  );
}

export default App;
