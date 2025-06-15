import { useState } from "react";
import SrtTranscription from "./components/SrtTranscription";
import Settings from "./components/Settings";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { FileAudio, Settings as SettingsIcon } from "lucide-react";

type ActiveTab = 'transcription' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcription');

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">SRT字幕生成ツール</h1>
            </div>
            <nav className="flex gap-2">
              <Button 
                variant={activeTab === 'transcription' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('transcription')}
                className="flex items-center gap-2"
              >
                <FileAudio className="h-4 w-4" />
                字幕生成
              </Button>
              <Button 
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2"
              >
                <SettingsIcon className="h-4 w-4" />
                設定
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
    </main>
  );
}

export default App;
