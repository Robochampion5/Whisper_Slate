import { useState, useCallback, useEffect, useRef } from 'react'
import ConnectionBadge from './components/ConnectionBadge'
import LoginScreen from './components/LoginScreen'
import CaptureScreen from './components/CaptureScreen'
import PreviewScreen from './components/PreviewScreen'
import UploadingScreen from './components/UploadingScreen'
import AwaitingReviewScreen, { type ReviewDecision } from './components/AwaitingReviewScreen'
import OutcomeScreen from './components/ConfirmationScreen'
import { getMyDoubts } from './services/api'
import { StudentWs } from './services/studentWs'
import type { StudentWsMessage } from './services/studentWs'

// ---------------------------------------------------------------------------
// State machine (v2 architecture — §13.4):
//
//   LOGIN → CAPTURE → PREVIEW → UPLOADING → AWAITING_REVIEW → OUTCOME → CAPTURE
//
// The penalty countdown lives at App level so CaptureScreen can always see it.
// ---------------------------------------------------------------------------
type AppState = 'LOGIN' | 'CAPTURE' | 'PREVIEW' | 'UPLOADING' | 'AWAITING_REVIEW' | 'OUTCOME'

// Storage keys for cross-session recovery
const STORAGE_KEY_TOKEN = 'ws_device_token'
const STORAGE_KEY_DOUBT = 'ws_doubt_id'

function App() {
  const [appState, setAppState] = useState<AppState>('LOGIN')

  // Credentials set at login
  const [sessionCode, setSessionCode] = useState('')
  const [deviceToken, setDeviceToken] = useState('')

  // Set when the user finishes recording
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  // Set in PREVIEW state — the transcribed text (may be edited by user)
  const [previewText, setPreviewText] = useState('')

  // Set when the server responds to /doubts/audio
  const [doubtId, setDoubtId] = useState('')

  // Set when the teacher makes a decision
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision | null>(null)

  // Penalty countdown — managed here so CaptureScreen can disable the mic.
  // Derived from penaltyExpiresAt (wall-clock) for accuracy; decremented locally
  // every second for UX.  Server re-checks on every upload (source of truth §13.3).
  const [penaltyRemaining, setPenaltyRemaining] = useState(0)
  const penaltyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Standing per-device WebSocket
  const studentWsRef = useRef<StudentWs | null>(null)

  // -------------------------------------------------------------------------
  // Penalty timer helpers
  // -------------------------------------------------------------------------

  const startPenaltyCountdown = useCallback((expiresAt: string | null, seconds: number) => {
    // Clear any running timer
    if (penaltyTimerRef.current) clearInterval(penaltyTimerRef.current)

    // Derive remaining from wall-clock if expiresAt provided (more accurate)
    const initial = expiresAt
      ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : seconds

    if (initial <= 0) return

    setPenaltyRemaining(initial)

    penaltyTimerRef.current = setInterval(() => {
      setPenaltyRemaining(prev => {
        if (prev <= 1) {
          clearInterval(penaltyTimerRef.current!)
          penaltyTimerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const resyncPenalty = useCallback((remainingSeconds: number) => {
    // Called when the server returns 403 penalized on a submission attempt.
    // Resets the local countdown to the server's authoritative value.
    if (penaltyTimerRef.current) clearInterval(penaltyTimerRef.current)
    if (remainingSeconds <= 0) { setPenaltyRemaining(0); return }

    setPenaltyRemaining(remainingSeconds)
    penaltyTimerRef.current = setInterval(() => {
      setPenaltyRemaining(prev => {
        if (prev <= 1) { clearInterval(penaltyTimerRef.current!); penaltyTimerRef.current = null; return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  // -------------------------------------------------------------------------
  // Standing WS message handler
  // -------------------------------------------------------------------------

  const handleStudentWsMessage = useCallback((msg: StudentWsMessage) => {
    if (msg.type === 'REVIEW_DECISION') {
      const decision: ReviewDecision = {
        status: msg.status,
        replyMessage: msg.replyMessage ?? undefined,
        penaltySeconds: msg.penaltySeconds,
        penaltyExpiresAt: msg.penaltyExpiresAt ?? undefined,
      }

      if (msg.status === 'rejected' && msg.penaltySeconds > 0) {
        startPenaltyCountdown(msg.penaltyExpiresAt, msg.penaltySeconds)
      }

      setReviewDecision(decision)
      setAppState('OUTCOME')
    }
  }, [startPenaltyCountdown])

  // -------------------------------------------------------------------------
  // Start standing WS after login
  // -------------------------------------------------------------------------

  const connectStudentWs = useCallback((token: string) => {
    studentWsRef.current?.disconnect()
    const ws = new StudentWs(token, handleStudentWsMessage)
    ws.onGiveUp = () => {
      // WS gave up reconnecting — will fall back to polling via AwaitingReviewScreen
      console.warn('[App] StudentWs gave up — REST fallback active')
    }
    ws.connect()
    studentWsRef.current = ws
  }, [handleStudentWsMessage])

  // -------------------------------------------------------------------------
  // Reconnect / resync on app load
  // -------------------------------------------------------------------------

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN)
    const savedDoubtId = localStorage.getItem(STORAGE_KEY_DOUBT)
    if (!savedToken) return

    getMyDoubts(savedToken).then(data => {
      // Restore active penalty
      if (data.activePenalty) {
        startPenaltyCountdown(data.activePenalty.expiresAt, data.activePenalty.remainingSeconds)
      }

      // Restore in-flight doubt state
      if (data.latestDoubt) {
        const { status, reviewReason, penaltySeconds, penaltyExpiresAt } = data.latestDoubt
        const id = String(data.latestDoubt.id)

        if (status === 'pending_review' || status === 'processing') {
          // Doubt still awaiting review — restore AWAITING_REVIEW state
          setDeviceToken(savedToken)
          setDoubtId(id)
          connectStudentWs(savedToken)
          setAppState('AWAITING_REVIEW')
        } else if ((status === 'accepted' || status === 'rejected') && savedDoubtId === id) {
          // Decision arrived while app was closed — show outcome once
          const decision: ReviewDecision = {
            status,
            reviewReason: reviewReason ?? undefined,
            penaltySeconds: penaltySeconds ?? 0,
            penaltyExpiresAt: penaltyExpiresAt ?? undefined,
          }
          setDeviceToken(savedToken)
          setDoubtId(id)
          setReviewDecision(decision)
          connectStudentWs(savedToken)
          setAppState('OUTCOME')
        }
      }
    }).catch(() => {
      // Server not reachable — stay at LOGIN, user will reconnect manually
    })

    return () => {
      if (penaltyTimerRef.current) clearInterval(penaltyTimerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // run once on mount

  // -------------------------------------------------------------------------
  // Transition handlers
  // -------------------------------------------------------------------------

  const handleLoginSuccess = (code: string, token: string, authToken?: string) => {
    setSessionCode(code)
    setDeviceToken(token)
    // Persist for resync on reload
    localStorage.setItem(STORAGE_KEY_TOKEN, token)
    if (authToken) {
      localStorage.setItem('auth_token', authToken)
    }
    connectStudentWs(token)
    setAppState('CAPTURE')
  }

  const handleRecordingComplete = (blob?: Blob) => {
    if (!blob) {
      setAppState('CAPTURE')
      return
    }
    setAudioBlob(blob)
    setAppState('PREVIEW')
  }

  const handleUploaded = useCallback((id: string) => {
    setDoubtId(id)
    localStorage.setItem(STORAGE_KEY_DOUBT, id)
    setAppState('AWAITING_REVIEW')
  }, [])

  const handleUploadError = useCallback((err: string, remainingSeconds?: number) => {
    if (err === 'penalized' && remainingSeconds !== undefined) {
      // Server enforced the penalty — resync local countdown and stay on CAPTURE
      resyncPenalty(remainingSeconds)
      setAppState('CAPTURE')
      return
    }
    console.error('Upload error:', err)
    alert('Failed to send your doubt: ' + err)
    setAppState('CAPTURE')
  }, [resyncPenalty])

  const handleDecision = useCallback((decision: ReviewDecision) => {
    // This comes from AwaitingReviewScreen's doubt-scoped WS (before StudentWs fires).
    // The standing WS may also fire — guard against double-transition.
    if (decision.status === 'rejected' && (decision.penaltySeconds ?? 0) > 0) {
      startPenaltyCountdown(decision.penaltyExpiresAt ?? null, decision.penaltySeconds ?? 0)
    }
    setReviewDecision(decision)
    setAppState('OUTCOME')
  }, [startPenaltyCountdown])

  const handleOutcomeComplete = () => {
    // Clear stored doubt id — it's been shown
    localStorage.removeItem(STORAGE_KEY_DOUBT)
    setAudioBlob(null)
    setDoubtId('')
    setReviewDecision(null)
    setPreviewText('')
    setAppState('CAPTURE')
  }

  const handlePreviewSend = (text: string) => {
    // User confirmed the transcript (possibly edited); move to upload
    setPreviewText(text)
    setAppState('UPLOADING')
  }

  const handlePreviewCancel = () => {
    // User discarded the recording; go back to capture
    setAudioBlob(null)
    setPreviewText('')
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
        <CaptureScreen
          onRecordingComplete={handleRecordingComplete}
          penaltyRemaining={penaltyRemaining}
          onPenaltyResync={resyncPenalty}
        />
      )}

      {appState === 'PREVIEW' && audioBlob && (
        <PreviewScreen
          audioBlob={audioBlob}
          onSend={handlePreviewSend}
          onCancel={handlePreviewCancel}
        />
      )}

      {appState === 'UPLOADING' && audioBlob && (
        <UploadingScreen
          audioBlob={audioBlob}
          sessionCode={sessionCode}
          deviceToken={deviceToken}
          transcriptOverride={previewText}
          onUploaded={handleUploaded}
          onError={handleUploadError}
        />
      )}

      {appState === 'AWAITING_REVIEW' && (
        <AwaitingReviewScreen
          doubtId={doubtId}
          deviceToken={deviceToken}
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
