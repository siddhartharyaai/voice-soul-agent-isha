import { MicVAD, utils } from '@ricky0123/vad-web'

export interface AudioChunk {
  data: Float32Array
  timestamp: number
}

export interface VADConfig {
  onSpeechStart: () => void
  onSpeechEnd: () => void
  onVADMisfire: () => void
  onAudioChunk: (chunk: AudioChunk) => void
  positiveSpeechThreshold?: number
  negativeSpeechThreshold?: number
  redemptionFrames?: number
  frameSamples?: number
  preSpeechPadFrames?: number
  minSpeechFrames?: number
}

export class VoiceAudioManager {
  private vad: MicVAD | null = null
  private mediaRecorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private isRecording = false
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null

  constructor(private config: VADConfig) {}

  async initialize(): Promise<void> {
    try {
      console.log('🎤 Initializing Voice Audio Manager with VAD...')
      
      // Request microphone access with optimal settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      console.log('🎤 Microphone access granted')

      // Initialize Web Audio API for real-time processing
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      
      // Initialize VAD
      this.vad = await MicVAD.new({
        stream: this.stream,
        onSpeechStart: () => {
          console.log('🗣️ Speech started (VAD)')
          this.config.onSpeechStart()
          this.startContinuousRecording()
        },
        onSpeechEnd: () => {
          console.log('🤐 Speech ended (VAD)')
          this.config.onSpeechEnd()
          this.stopContinuousRecording()
        },
        onVADMisfire: () => {
          console.log('🔄 VAD misfire detected')
          this.config.onVADMisfire()
        },
        positiveSpeechThreshold: this.config.positiveSpeechThreshold || 0.5,
        negativeSpeechThreshold: this.config.negativeSpeechThreshold || 0.35,
        redemptionFrames: this.config.redemptionFrames || 8,
        frameSamples: this.config.frameSamples || 1536,
        preSpeechPadFrames: this.config.preSpeechPadFrames || 1,
        minSpeechFrames: this.config.minSpeechFrames || 4,
      })

      // Set up continuous audio processing for streaming
      this.setupContinuousAudioProcessing()

      console.log('🎤 Voice Audio Manager initialized successfully')
    } catch (error) {
      console.error('🔥 Failed to initialize Voice Audio Manager:', error)
      throw error
    }
  }

  private setupContinuousAudioProcessing(): void {
    if (!this.audioContext || !this.source) return

    // Create script processor for real-time audio processing
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    
    this.processor.onaudioprocess = (event) => {
      if (this.isRecording) {
        const inputData = event.inputBuffer.getChannelData(0)
        const audioChunk: AudioChunk = {
          data: new Float32Array(inputData),
          timestamp: Date.now()
        }
        this.config.onAudioChunk(audioChunk)
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  private startContinuousRecording(): void {
    console.log('🎙️ Starting continuous recording...')
    this.isRecording = true

    if (this.stream) {
      // Set up MediaRecorder for Opus encoding
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options)
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.isRecording) {
          // Convert blob to base64 and send immediately
          const reader = new FileReader()
          reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1]
            const audioChunk: AudioChunk = {
              data: new Float32Array(), // MediaRecorder data is already encoded
              timestamp: Date.now()
            }
            // Send encoded audio chunk
            this.config.onAudioChunk(audioChunk)
          }
          reader.readAsDataURL(event.data)
        }
      }

      // Record in small chunks for streaming (20-50ms)
      this.mediaRecorder.start(20)
    }
  }

  private stopContinuousRecording(): void {
    console.log('🛑 Stopping continuous recording...')
    this.isRecording = false

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
  }

  start(): void {
    console.log('🎤 Starting VAD...')
    this.vad?.start()
  }

  pause(): void {
    console.log('⏸️ Pausing VAD...')
    this.vad?.pause()
    this.stopContinuousRecording()
  }

  stop(): void {
    console.log('🛑 Stopping Voice Audio Manager...')
    
    this.vad?.destroy()
    this.vad = null
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.mediaRecorder = null

    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    this.isRecording = false
  }

  // Interrupt current audio playback
  interrupt(): void {
    console.log('🛑 Interrupting current session...')
    this.pause()
    // Resume after short delay
    setTimeout(() => {
      if (this.vad) {
        this.start()
      }
    }, 100)
  }

  // Encode Float32Array to base64 for transmission
  static encodeAudioToBase64(audioData: Float32Array): string {
    const int16Array = new Int16Array(audioData.length)
    for (let i = 0; i < audioData.length; i++) {
      const s = Math.max(-1, Math.min(1, audioData[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    
    const uint8Array = new Uint8Array(int16Array.buffer)
    let binary = ''
    const chunkSize = 0x8000
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length))
      binary += String.fromCharCode.apply(null, Array.from(chunk))
    }
    
    return btoa(binary)
  }
}

export class AudioPlaybackQueue {
  private queue: Uint8Array[] = []
  private isPlaying = false
  private audioContext: AudioContext
  private currentSource: AudioBufferSourceNode | null = null

  constructor() {
    this.audioContext = new AudioContext()
  }

  async addToQueue(audioData: string): Promise<void> {
    // Convert base64 to Uint8Array
    const binaryString = atob(audioData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    this.queue.push(bytes)
    
    if (!this.isPlaying) {
      await this.playNext()
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const audioData = this.queue.shift()!

    try {
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer.slice(0))
      
      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer
      this.currentSource.connect(this.audioContext.destination)
      
      this.currentSource.onended = () => {
        this.currentSource = null
        this.playNext()
      }
      
      this.currentSource.start(0)
    } catch (error) {
      console.error('🔥 Error playing audio:', error)
      this.playNext() // Continue with next chunk
    }
  }

  interrupt(): void {
    // Stop current playback and clear queue
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
    }
    this.queue = []
    this.isPlaying = false
  }

  async destroy(): Promise<void> {
    this.interrupt()
    await this.audioContext.close()
  }
}