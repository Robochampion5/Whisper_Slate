let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

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
    console.error("Microphone access denied or error:", err);
    throw err;
  }
}

export async function stopAudioCapture(): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      return reject(new Error("No recording in progress"));
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' }); 
      
      // Cleanup tracks to release microphone indicator
      mediaRecorder?.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;

      try {
        const audioData = await resampleAudio(blob, 16000);
        resolve(audioData);
      } catch (err) {
        reject(err);
      }
    };

    mediaRecorder.stop();
  });
}

/**
 * Resamples the audio blob to the given sample rate and returns a Float32Array of PCM data.
 * Whisper requires 16kHz mono audio.
 */
async function resampleAudio(blob: Blob, targetSampleRate: number): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  
  // Use OfflineAudioContext or AudioContext to decode and resample
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: targetSampleRate
  });
  
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  
  // getChannelData returns a Float32Array
  const pcmData = audioBuffer.getChannelData(0); 
  
  // Mix channels to mono if stereo
  if (numberOfChannels > 1) {
    const rightChannel = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      pcmData[i] = (pcmData[i] + rightChannel[i]) / 2;
    }
  }

  return pcmData;
}
