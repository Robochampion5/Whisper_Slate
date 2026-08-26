let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

/**
 * Starts audio capture from the device microphone via MediaRecorder.
 * The raw audio is buffered in 250 ms chunks.
 */
export async function startAudioCapture(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.start(250);
  } catch (err) {
    console.error('Microphone access denied or error:', err);
    throw err;
  }
}

/**
 * Stops audio capture and resolves with the raw audio Blob (audio/webm;codecs=opus
 * or the browser's preferred MediaRecorder MIME type).
 *
 * NOTE (v2 architecture): we no longer resample to 16 kHz Float32Array here.
 * The Blob is POSTed directly to the server, where faster-whisper handles
 * decoding and transcription.  This removes the need for OfflineAudioContext
 * resampling and the @huggingface/transformers dependency entirely.
 */
export async function stopAudioCapture(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return reject(new Error('No recording in progress'));
    }

    mediaRecorder.onstop = () => {
      // Prefer opus inside webm (widely supported, efficient for voice).
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const blob = new Blob(audioChunks, { type: mimeType });

      // Release the microphone indicator
      mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorder = null;

      resolve(blob);
    };

    mediaRecorder.stop();
  });
}
