import { useState, useRef, useEffect } from 'react'
import ConnectionBadge from './components/ConnectionBadge'
import LoginScreen from './components/LoginScreen'
import DownloadScreen from './components/DownloadScreen'
import CaptureScreen from './components/CaptureScreen'
import ProcessingScreen from './components/ProcessingScreen'
import ReviewScreen from './components/ReviewScreen'
import ConfirmationScreen from './components/ConfirmationScreen'

type AppState = 'LOGIN' | 'DOWNLOAD' | 'CAPTURE' | 'PROCESSING' | 'REVIEW' | 'CONFIRMATION'

function App() {
  const [appState, setAppState] = useState<AppState>('LOGIN')
  
  // Shared state across the flow
  const [audioData, setAudioData] = useState<Float32Array | undefined>()
  const [transcribedText, setTranscribedText] = useState('')
  const [embedding, setEmbedding] = useState<number[]>([])
  const [sessionCode, setSessionCode] = useState<string>('')
  const [deviceToken, setDeviceToken] = useState<string>('')
  const worker = useRef<Worker | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('Initializing model...');

  useEffect(() => {
    // Create worker
    worker.current = new Worker(new URL('./services/worker.ts', import.meta.url), {
      type: 'module'
    });

    const onMessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        if (msg.data.status === 'progress') {
          setDownloadProgress(msg.data.progress || 0);
          setDownloadStatus(`Downloading: ${msg.data.file}`);
        } else if (msg.data.status === 'init') {
          setDownloadStatus(`Initializing: ${msg.data.file}`);
        } else if (msg.data.status === 'ready') {
          setDownloadStatus(`Loaded: ${msg.data.file}`);
        }
      } else if (msg.type === 'ready') {
        // When fully ready, and we are on the DOWNLOAD screen, transition to CAPTURE
        setAppState(prev => prev === 'DOWNLOAD' ? 'CAPTURE' : prev);
      } else if (msg.type === 'error') {
        console.error("Worker error:", msg.error);
        setDownloadStatus(`Error loading model: ${msg.error}`);
      }
    };
    
    worker.current.addEventListener('message', onMessage);

    return () => {
      worker.current?.removeEventListener('message', onMessage);
      worker.current?.terminate();
    };
  }, []);

  const handleLoginSuccess = (code: string, token: string) => {
    setSessionCode(code);
    setDeviceToken(token);
    setAppState('DOWNLOAD')
    worker.current?.postMessage({ type: 'load' });
  }
  
  const handleRecordingComplete = (audio?: Float32Array) => {
    if (!audio) {
      setAppState('CAPTURE');
      return;
    }
    setAudioData(audio)
    setAppState('PROCESSING')
  }

  const handleTranscriptionComplete = (text: string, emb: number[]) => {
    setTranscribedText(text)
    setEmbedding(emb)
    setAppState('REVIEW')
  }

  const handleTranscriptionError = (err: string) => {
    console.error("Transcription error:", err);
    alert("Transcription failed: " + err);
    setAppState('CAPTURE');
  }

  const handleReviewSent = () => setAppState('CONFIRMATION')
  const handleReviewDiscard = () => setAppState('CAPTURE')
  
  const handleConfirmationComplete = () => setAppState('CAPTURE')

  return (
    <main className="relative min-h-screen bg-teal-950 selection:bg-emerald-500/30 text-teal-50">
      {appState !== 'LOGIN' && <ConnectionBadge />}

      {appState === 'LOGIN' && (
        <LoginScreen onSuccess={handleLoginSuccess} />
      )}

      {appState === 'DOWNLOAD' && (
        <DownloadScreen progress={downloadProgress} status={downloadStatus} />
      )}
      
      {appState === 'CAPTURE' && (
        <CaptureScreen onRecordingComplete={handleRecordingComplete} />
      )}
      
      {appState === 'PROCESSING' && (
        <ProcessingScreen 
          audioData={audioData}
          worker={worker.current}
          onTranscriptionComplete={handleTranscriptionComplete} 
          onError={handleTranscriptionError}
        />
      )}
      
      {appState === 'REVIEW' && (
        <ReviewScreen 
          initialText={transcribedText}
          embedding={embedding}
          sessionCode={sessionCode}
          deviceToken={deviceToken}
          onSent={handleReviewSent} 
          onDiscard={handleReviewDiscard} 
        />
      )}
      
      {appState === 'CONFIRMATION' && (
        <ConfirmationScreen onComplete={handleConfirmationComplete} />
      )}
    </main>
  )
}

export default App
