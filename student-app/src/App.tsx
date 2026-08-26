import { useState, useCallback } from 'react'
import ConnectionBadge from './components/ConnectionBadge'
import LoginScreen from './components/LoginScreen'
import CaptureScreen from './components/CaptureScreen'
import UploadingScreen from './components/UploadingScreen'
import AwaitingReviewScreen, { type ReviewDecision } from './components/AwaitingReviewScreen'
import OutcomeScreen from './components/ConfirmationScreen'

// ---------------------------------------------------------------------------
// State machine (v2 architecture — §13.4):
//
//   LOGIN → CAPTURE → UPLOADING → AWAITING_REVIEW → ACCEPTED | REJECTED
//                ↑______________________↑______________________↑
//
// The old DOWNLOAD state (model warm-up), PROCESSING state (on-device Whisper),
// and REVIEW state (transcript edit) have been removed.  The AI pipeline now
// runs on the server after a fast multipart upload.
// ---------------------------------------------------------------------------
type AppState = 'LOGIN' | 'CAPTURE' | 'UPLOADING' | 'AWAITING_REVIEW' | 'OUTCOME'

function App() {
  const [appState, setAppState] = useState<AppState>('LOGIN')

  // Credentials set at login
  const [sessionCode, setSessionCode] = useState('')
  const [deviceToken, setDeviceToken] = useState('')

  // Set when the user finishes recording
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // Set when the server responds to /doubts/audio
  const [doubtId, setDoubtId] = useState('')

  // Set when the teacher makes a decision
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null)

  // -------------------------------------------------------------------------
  // Transition handlers
  // -------------------------------------------------------------------------

  const handleLoginSuccess = (code: string, token: string) => {
    setSessionCode(code)
    setDeviceToken(token)
    setAppState('CAPTURE')
  }

  const handleRecordingComplete = (blob?: Blob) => {
    if (!blob) {
      // Recording was discarded or errored
      setAppState('CAPTURE')
      return
    }
    setAudioBlob(blob)
    setAppState('UPLOADING')
  }

  const handleUploaded = useCallback((id: string) => {
    setDoubtId(id)
    setAppState('AWAITING_REVIEW')
  }, [])

  const handleUploadError = useCallback((err: string) => {
    console.error('Upload error:', err)
    alert('Failed to send your doubt: ' + err)
    setAppState('CAPTURE')
  }, [])

  const handleDecision = useCallback((decision: ReviewDecision) => {
    setReviewDecision(decision)
    setAppState('OUTCOME')
  }, [])

  const handleOutcomeComplete = () => {
    // Reset per-doubt state and return to capture
    setAudioBlob(null)
    setDoubtId('')
    setReviewDecision(null)
    setAppState('CAPTURE')
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <main className="relative min-h-screen bg-teal-950 selection:bg-emerald-500/30 text-teal-50">
      {appState !== 'LOGIN' && <ConnectionBadge />}

      {appState === 'LOGIN' && (
        <LoginScreen onSuccess={handleLoginSuccess} />
      )}

      {appState === 'CAPTURE' && (
        <CaptureScreen onRecordingComplete={handleRecordingComplete} />
      )}

      {appState === 'UPLOADING' && audioBlob && (
        <UploadingScreen
          audioBlob={audioBlob}
          sessionCode={sessionCode}
          deviceToken={deviceToken}
          onUploaded={handleUploaded}
          onError={handleUploadError}
        />
      )}

      {appState === 'AWAITING_REVIEW' && (
        <AwaitingReviewScreen
          doubtId={doubtId}
          onDecision={handleDecision}
        />
      )}

      {appState === 'OUTCOME' && reviewDecision && (
        <OutcomeScreen
          decision={reviewDecision}
          onComplete={handleOutcomeComplete}
        />
      )}
    </main>
  )
}

export default App
