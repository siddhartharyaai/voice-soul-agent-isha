"""
Voice client for real-time audio processing
Handles LiveKit room connections and audio streaming
"""

import asyncio
import logging
from typing import Callable, Optional
from livekit import rtc, api
import numpy as np
import webrtcvad
import librosa

logger = logging.getLogger(__name__)

class VoiceClient:
    def __init__(
        self,
        livekit_url: str,
        api_key: str,
        api_secret: str,
        on_speech_detected: Optional[Callable] = None,
        on_audio_frame: Optional[Callable] = None
    ):
        self.livekit_url = livekit_url
        self.api_key = api_key  
        self.api_secret = api_secret
        self.on_speech_detected = on_speech_detected
        self.on_audio_frame = on_audio_frame
        
        self.room: Optional[rtc.Room] = None
        self.audio_source: Optional[rtc.AudioSource] = None
        self.is_connected = False
        
        # VAD (Voice Activity Detection) setup
        self.vad = webrtcvad.Vad()
        self.vad.set_mode(2)  # 0-3, 3 is most aggressive
        
        # Audio buffer for processing
        self.audio_buffer = []
        self.sample_rate = 16000
        self.frame_duration = 30  # ms
        self.frame_size = int(self.sample_rate * self.frame_duration / 1000)
        
    async def connect(self, room_name: str, participant_name: str) -> bool:
        """Connect to LiveKit room"""
        try:
            # Generate access token
            token = api.AccessToken(self.api_key, self.api_secret)
            token.with_identity(participant_name)
            token.with_name(participant_name)
            token.with_grants(api.VideoGrants(
                room_join=True,
                room=room_name,
                can_publish=True,
                can_subscribe=True
            ))
            
            # Create room and connect
            self.room = rtc.Room()
            self.room.on("participant_connected", self._on_participant_connected)
            self.room.on("track_subscribed", self._on_track_subscribed)
            self.room.on("track_unsubscribed", self._on_track_unsubscribed)
            
            await self.room.connect(self.livekit_url, token.to_jwt())
            
            # Create audio source for publishing
            self.audio_source = rtc.AudioSource(self.sample_rate, 1)
            track = rtc.LocalAudioTrack.create_audio_track("microphone", self.audio_source)
            options = rtc.TrackPublishOptions()
            options.source = rtc.TrackSource.SOURCE_MICROPHONE
            
            await self.room.local_participant.publish_track(track, options)
            
            self.is_connected = True
            logger.info(f"Connected to room: {room_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to room: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect from LiveKit room"""
        if self.room:
            await self.room.disconnect()
            self.is_connected = False
            logger.info("Disconnected from room")
    
    async def publish_audio(self, audio_data: np.ndarray):
        """Publish audio data to the room"""
        if not self.is_connected or not self.audio_source:
            return
            
        try:
            # Convert to the format expected by LiveKit
            audio_frame = rtc.AudioFrame.create(
                sample_rate=self.sample_rate,
                num_channels=1,
                samples_per_channel=len(audio_data)
            )
            
            # Copy audio data
            audio_frame.data[:] = audio_data.astype(np.int16).tobytes()
            
            await self.audio_source.capture_frame(audio_frame)
            
        except Exception as e:
            logger.error(f"Error publishing audio: {e}")
    
    def process_audio_frame(self, audio_data: bytes):
        """Process incoming audio frame for VAD and speech detection"""
        try:
            # Convert bytes to numpy array
            audio_np = np.frombuffer(audio_data, dtype=np.int16)
            
            # Add to buffer
            self.audio_buffer.extend(audio_np)
            
            # Process in chunks
            while len(self.audio_buffer) >= self.frame_size:
                frame = self.audio_buffer[:self.frame_size]
                self.audio_buffer = self.audio_buffer[self.frame_size:]
                
                # Apply VAD
                frame_bytes = np.array(frame, dtype=np.int16).tobytes()
                is_speech = self.vad.is_speech(frame_bytes, self.sample_rate)
                
                if is_speech and self.on_speech_detected:
                    asyncio.create_task(self.on_speech_detected(frame))
                
                if self.on_audio_frame:
                    asyncio.create_task(self.on_audio_frame(frame, is_speech))
                    
        except Exception as e:
            logger.error(f"Error processing audio frame: {e}")
    
    def _on_participant_connected(self, participant: rtc.RemoteParticipant):
        """Handle participant connection"""
        logger.info(f"Participant connected: {participant.identity}")
    
    def _on_track_subscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant
    ):
        """Handle track subscription"""
        logger.info(f"Track subscribed: {track.kind} from {participant.identity}")
        
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            audio_track = track
            audio_track.on("frame_received", self._on_audio_frame_received)
    
    def _on_track_unsubscribed(
        self,
        track: rtc.Track,
        publication: rtc.RemoteTrackPublication,
        participant: rtc.RemoteParticipant
    ):
        """Handle track unsubscription"""
        logger.info(f"Track unsubscribed: {track.kind} from {participant.identity}")
    
    def _on_audio_frame_received(self, frame: rtc.AudioFrame):
        """Handle received audio frame"""
        try:
            # Extract audio data
            audio_data = frame.data
            self.process_audio_frame(audio_data)
            
        except Exception as e:
            logger.error(f"Error handling audio frame: {e}")

class AudioProcessor:
    """Audio processing utilities"""
    
    @staticmethod
    def resample_audio(audio: np.ndarray, original_sr: int, target_sr: int) -> np.ndarray:
        """Resample audio to target sample rate"""
        if original_sr == target_sr:
            return audio
        return librosa.resample(audio, orig_sr=original_sr, target_sr=target_sr)
    
    @staticmethod
    def normalize_audio(audio: np.ndarray) -> np.ndarray:
        """Normalize audio to [-1, 1] range"""
        max_val = np.max(np.abs(audio))
        if max_val > 0:
            return audio / max_val
        return audio
    
    @staticmethod
    def apply_noise_gate(audio: np.ndarray, threshold: float = 0.01) -> np.ndarray:
        """Apply noise gate to remove low-level noise"""
        mask = np.abs(audio) > threshold
        return audio * mask
    
    @staticmethod
    def detect_speech_segments(
        audio: np.ndarray,
        sr: int,
        frame_length: int = 2048,
        hop_length: int = 512
    ) -> list:
        """Detect speech segments using energy-based method"""
        # Calculate RMS energy
        rms = librosa.feature.rms(
            y=audio,
            frame_length=frame_length,
            hop_length=hop_length
        )[0]
        
        # Find segments above threshold
        threshold = np.mean(rms) * 1.5
        speech_frames = rms > threshold
        
        # Convert frame indices to time segments
        segments = []
        in_speech = False
        start_time = 0
        
        for i, is_speech in enumerate(speech_frames):
            time = i * hop_length / sr
            
            if is_speech and not in_speech:
                start_time = time
                in_speech = True
            elif not is_speech and in_speech:
                segments.append((start_time, time))
                in_speech = False
        
        if in_speech:
            segments.append((start_time, len(audio) / sr))
        
        return segments