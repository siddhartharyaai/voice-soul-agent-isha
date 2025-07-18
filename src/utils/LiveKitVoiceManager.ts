import { Room, RoomEvent, RemoteTrack, RemoteTrackPublication, RemoteParticipant, LocalTrack, LocalAudioTrack, Track } from 'livekit-client';
import { supabase } from '@/integrations/supabase/client';

export interface VoiceSession {
  room: Room;
  sessionId: string;
  botConfig: any;
  cleanup: () => void;
}

export interface AudioChunk {
  data: Float32Array;
  timestamp: number;
}

export class LiveKitVoiceManager {
  private room: Room | null = null;
  private localAudioTrack: LocalAudioTrack | null = null;
  private isRecording = false;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private sessionConfig: any = null;
  
  private onTranscriptCallback?: (transcript: string, isFinal: boolean) => void;
  private onAIResponseCallback?: (response: string) => void;
  private onAudioResponseCallback?: (audio: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(callbacks: {
    onTranscript?: (transcript: string, isFinal: boolean) => void;
    onAIResponse?: (response: string) => void;
    onAudioResponse?: (audio: string) => void;
    onError?: (error: string) => void;
  }) {
    this.onTranscriptCallback = callbacks.onTranscript;
    this.onAIResponseCallback = callbacks.onAIResponse;
    this.onAudioResponseCallback = callbacks.onAudioResponse;
    this.onErrorCallback = callbacks.onError;
  }

  async createSession(botId: string, userId: string): Promise<VoiceSession> {
    try {
      console.log('🎤 Creating LiveKit voice session...');
      
      // Get LiveKit session from Supabase function
      const { data: sessionData, error } = await supabase.functions.invoke('realtime-voice', {
        body: { botId, userId }
      });

      if (error || !sessionData?.success) {
        throw new Error(sessionData?.error || 'Failed to create voice session');
      }

      console.log('✅ Session created:', sessionData);
      
      this.sessionConfig = sessionData;
      
      // Create and connect to LiveKit room
      this.room = new Room();
      await this.setupRoomHandlers();
      
      await this.room.connect(sessionData.livekit.url, sessionData.livekit.token);
      console.log('✅ Connected to LiveKit room:', sessionData.livekit.roomName);

      // Start audio capture
      await this.startAudioCapture();

      return {
        room: this.room,
        sessionId: sessionData.sessionId,
        botConfig: sessionData.bot,
        cleanup: () => this.cleanup()
      };

    } catch (error) {
      console.error('❌ Failed to create voice session:', error);
      this.onErrorCallback?.(error instanceof Error ? error.message : 'Failed to create session');
      throw error;
    }
  }

  private async setupRoomHandlers() {
    if (!this.room) return;

    this.room.on(RoomEvent.Connected, () => {
      console.log('✅ Room connected');
    });

    this.room.on(RoomEvent.Disconnected, () => {
      console.log('🔌 Room disconnected');
      this.cleanup();
    });

    this.room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log('🎵 Track subscribed:', track.kind);
    });

    this.room.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        this.handleServerMessage(message);
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    });
  }

  private handleServerMessage(message: any) {
    console.log('📨 Received server message:', message.type);
    
    switch (message.type) {
      case 'transcript':
        this.onTranscriptCallback?.(message.transcript, message.is_final);
        break;
      case 'ai_response':
        this.onAIResponseCallback?.(message.response);
        break;
      case 'audio_response':
        this.onAudioResponseCallback?.(message.audio);
        break;
      case 'error':
        this.onErrorCallback?.(message.message);
        break;
    }
  }

  private async startAudioCapture() {
    try {
      console.log('🎤 Starting audio capture...');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });

      // Create local audio track
      this.localAudioTrack = new LocalAudioTrack(stream.getAudioTracks()[0]);
      
      // Publish track to room
      await this.room?.localParticipant.publishTrack(this.localAudioTrack);
      console.log('✅ Audio track published');

      // Setup audio processing for speech detection
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create audio processor for real-time speech detection
      await this.setupSpeechProcessor(source);

    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      this.onErrorCallback?.('Failed to access microphone');
      throw error;
    }
  }

  private async setupSpeechProcessor(source: MediaStreamAudioSourceNode) {
    if (!this.audioContext) return;

    // Create script processor for audio analysis
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    let isVoiceActive = false;
    let silenceTimeout: NodeJS.Timeout | null = null;
    let audioBuffer: Float32Array[] = [];
    
    processor.onaudioprocess = async (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Simple voice activity detection based on RMS
      const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
      const isCurrentlySpeaking = rms > 0.01; // Threshold for voice detection
      
      if (isCurrentlySpeaking) {
        if (!isVoiceActive) {
          console.log('🗣️ Voice detected - starting recording');
          isVoiceActive = true;
          audioBuffer = [];
        }
        
        // Clear silence timeout
        if (silenceTimeout) {
          clearTimeout(silenceTimeout);
          silenceTimeout = null;
        }
        
        // Add audio to buffer
        audioBuffer.push(new Float32Array(inputData));
        
        // Set silence timeout
        silenceTimeout = setTimeout(async () => {
          if (isVoiceActive && audioBuffer.length > 0) {
            console.log('🤐 Voice ended - processing audio');
            await this.processAudioBuffer(audioBuffer);
            isVoiceActive = false;
            audioBuffer = [];
          }
        }, 1000); // 1 second of silence
      }
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  private async processAudioBuffer(audioBuffer: Float32Array[]) {
    try {
      // Combine audio chunks
      const totalLength = audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
      const combinedAudio = new Float32Array(totalLength);
      let offset = 0;
      
      for (const chunk of audioBuffer) {
        combinedAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert to 16-bit PCM
      const pcmData = new Int16Array(combinedAudio.length);
      for (let i = 0; i < combinedAudio.length; i++) {
        pcmData[i] = Math.max(-32768, Math.min(32767, combinedAudio[i] * 32767));
      }

      // Convert to base64
      const audioBase64 = this.arrayBufferToBase64(pcmData.buffer);
      
      // Send to speech-to-text processing
      const { data, error } = await supabase.functions.invoke('voice-processor', {
        body: {
          type: 'speech_to_text',
          data: { audio: audioBase64 }
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'STT processing failed');
      }

      const transcript = data.transcript?.trim();
      if (transcript && transcript.length > 2) {
        console.log('📝 Transcript:', transcript);
        this.onTranscriptCallback?.(transcript, true);
        
        // Generate AI response
        await this.generateAIResponse(transcript);
      }

    } catch (error) {
      console.error('❌ Audio processing error:', error);
      this.onErrorCallback?.('Audio processing failed');
    }
  }

  private async generateAIResponse(transcript: string) {
    try {
      console.log('🤖 Generating AI response...');
      
      const { data, error } = await supabase.functions.invoke('voice-processor', {
        body: {
          type: 'generate_response',
          data: { transcript },
          botConfig: this.sessionConfig.bot
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'AI response generation failed');
      }

      const aiResponse = data.response;
      console.log('💬 AI Response:', aiResponse);
      this.onAIResponseCallback?.(aiResponse);

      // Generate speech
      await this.generateSpeech(aiResponse);

    } catch (error) {
      console.error('❌ AI response error:', error);
      this.onErrorCallback?.('AI response generation failed');
    }
  }

  private async generateSpeech(text: string) {
    try {
      console.log('🔊 Generating speech...');
      
      const { data, error } = await supabase.functions.invoke('voice-processor', {
        body: {
          type: 'text_to_speech',
          data: { text },
          botConfig: this.sessionConfig.bot
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'TTS generation failed');
      }

      console.log('✅ Speech generated');
      this.onAudioResponseCallback?.(data.audio);

    } catch (error) {
      console.error('❌ TTS error:', error);
      this.onErrorCallback?.('Speech generation failed');
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async disconnect() {
    console.log('🔌 Disconnecting voice session...');
    this.cleanup();
  }

  private cleanup() {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
    
    this.isRecording = false;
    console.log('✅ Voice session cleaned up');
  }
}