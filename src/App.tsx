import { useState } from "react";
import Transcription from "./components/Transcription";
import Settings from "./components/Settings";
import "./App.css";

type ActiveTab = 'transcription' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcription');

  return (
    <main className="app">
      <header className="app-header">
        <h1>Gemini 音声文字起こしアプリ</h1>
        <nav className="app-nav">
          <button 
            className={`nav-button ${activeTab === 'transcription' ? 'active' : ''}`}
            onClick={() => setActiveTab('transcription')}
          >
            文字起こし
          </button>
          <button 
            className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            設定
          </button>
        </nav>
      </header>

      <div className="app-content">
        {activeTab === 'transcription' && <Transcription />}
        {activeTab === 'settings' && <Settings />}
      </div>
    </main>
  );
}

export default App;
