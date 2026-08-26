import { pipeline, env } from '@huggingface/transformers';

// Skip local model checks, we are downloading from huggingface directly
env.allowLocalModels = false;

class PipelineFactory {
  static task = 'automatic-speech-recognition' as const;
  static model = 'Xenova/whisper-tiny.en';
  static instance: any = null;

  static async getInstance(progress_callback: (progressInfo: any) => void) {
    if (this.instance === null) {
      try {
        // Try WebGPU first
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          device: 'webgpu'
        });
      } catch (e) {
        console.warn("WebGPU not supported or failed, falling back to WASM", e);
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          device: 'wasm'
        });
      }
    }
    return this.instance;
  }
}
class FeatureExtractionPipelineFactory {
  static task = 'feature-extraction' as const;
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progress_callback: (progressInfo: any) => void) {
    if (this.instance === null) {
      try {
        // Try WebGPU first
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          device: 'webgpu'
        });
      } catch (e) {
        console.warn("WebGPU not supported or failed for feature extraction, falling back to WASM", e);
        this.instance = await pipeline(this.task, this.model, {
          progress_callback,
          device: 'wasm'
        });
      }
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, audio } = event.data;

  if (type === 'load') {
    try {
      let sttReady = false;
      let embReady = false;
      const checkReady = () => { if(sttReady && embReady) self.postMessage({ type: 'ready' }); };

      // Load STT Model
      PipelineFactory.getInstance((x: any) => {
        self.postMessage({ type: 'progress', data: x });
      }).then(() => {
        sttReady = true;
        checkReady();
      }).catch(err => {
        self.postMessage({ type: 'error', error: err.message });
      });

      // Load Embedding Model
      FeatureExtractionPipelineFactory.getInstance((x: any) => {
        self.postMessage({ type: 'progress', data: x });
      }).then(() => {
        embReady = true;
        checkReady();
      }).catch(err => {
        self.postMessage({ type: 'error', error: err.message });
      });
    } catch (err: any) {
      self.postMessage({ type: 'error', error: err.message });
    }
  } else if (type === 'transcribe') {
    try {
      const transcriber = await PipelineFactory.getInstance((_x: any) => {});
      
      // =======================================================================
      // CRITICAL CONSTRAINT VERIFICATION:
      // Audio provided is a 16kHz Float32Array.
      // This call runs entirely on-device (WASM or WebGPU).
      // NO network requests (fetch/XHR) are made during this transcription call.
      // Reference: Section 4 and 10 of Project_spec.md
      // =======================================================================
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'en',
        task: 'transcribe',
      });
      
      const text = output.text.trim();
      
      // Now run feature extraction
      const extractor = await FeatureExtractionPipelineFactory.getInstance((_x: any) => {});
      
      // Extract embeddings, pooling='mean' and normalize=true for cosine similarity
      const embOutput = await extractor(text, { pooling: 'mean', normalize: true });
      
      // Convert Tensor back to normal Array
      const embeddingArray = Array.from(embOutput.data);

      self.postMessage({ type: 'result', text, embedding: embeddingArray });
    } catch (err: any) {
      self.postMessage({ type: 'error', error: err.message });
    }
  }
});
