/**
 * Audio Queue Manager for sequential audio playback
 * Handles base64 encoded audio data and plays them in sequence
 */

export class AudioQueue {
  private queue: string[] = []
  private isPlaying = false
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null

  constructor() {
    // Initialize audio context when first used
    this.initAudioContext()
  }

  private async initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Resume context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      console.log('🔊 AudioQueue: Audio context initialized')
    } catch (error) {
      console.error('Failed to initialize audio context:', error)
    }
  }

  async addToQueue(base64Audio: string) {
    console.log('🔊 AudioQueue: Adding audio to queue, queue length:', this.queue.length)
    this.queue.push(base64Audio)
    
    if (!this.isPlaying) {
      await this.playNext()
    }
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false
      console.log('🔊 AudioQueue: Queue empty, stopping playback')
      return
    }

    if (!this.audioContext) {
      await this.initAudioContext()
    }

    if (!this.audioContext) {
      console.error('AudioQueue: No audio context available')
      return
    }

    this.isPlaying = true
    const base64Audio = this.queue.shift()!

    try {
      console.log('🔊 AudioQueue: Playing next audio chunk')
      
      // Decode base64 to array buffer
      const binaryString = atob(base64Audio)
      const arrayBuffer = new ArrayBuffer(binaryString.length)
      const uint8Array = new Uint8Array(arrayBuffer)
      
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }

      // Decode audio data
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      
      // Create and play audio source
      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer
      this.currentSource.connect(this.audioContext.destination)
      
      // Play next when current finishes
      this.currentSource.onended = () => {
        console.log('🔊 AudioQueue: Audio chunk finished')
        this.currentSource = null
        this.playNext()
      }
      
      this.currentSource.start(0)
      console.log('🔊 AudioQueue: Audio chunk started playing')
      
    } catch (error) {
      console.error('🔊 AudioQueue: Error playing audio:', error)
      // Continue with next item even if current fails
      this.playNext()
    }
  }

  stop() {
    console.log('🔊 AudioQueue: Stopping all audio')
    this.queue = []
    
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
    }
    
    this.isPlaying = false
  }

  clear() {
    console.log('🔊 AudioQueue: Clearing queue')
    this.queue = []
  }

  getQueueLength(): number {
    return this.queue.length
  }
}