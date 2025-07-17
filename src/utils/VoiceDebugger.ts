// Comprehensive voice system debugger and performance monitor
export class VoiceDebugger {
  private static instance: VoiceDebugger;
  private logs: Array<{ timestamp: number; level: string; message: string; data?: any }> = [];
  private metrics: {
    latencySTT: number[];
    latencyAI: number[];
    latencyTTS: number[];
    latencyTotal: number[];
    audioChunks: number;
    transcriptUpdates: number;
    errors: number;
  } = {
    latencySTT: [],
    latencyAI: [],
    latencyTTS: [],
    latencyTotal: [],
    audioChunks: 0,
    transcriptUpdates: 0,
    errors: 0
  };

  private constructor() {}

  static getInstance(): VoiceDebugger {
    if (!VoiceDebugger.instance) {
      VoiceDebugger.instance = new VoiceDebugger();
    }
    return VoiceDebugger.instance;
  }

  log(level: 'info' | 'warning' | 'error' | 'debug', message: string, data?: any) {
    const timestamp = Date.now();
    this.logs.push({ timestamp, level, message, data });
    
    // Also log to console with styling
    const style = {
      info: 'color: #2196F3; font-weight: bold',
      warning: 'color: #FF9800; font-weight: bold',
      error: 'color: #F44336; font-weight: bold',
      debug: 'color: #4CAF50; font-weight: bold'
    };
    
    console.log(`%c[VOICE ${level.toUpperCase()}] ${message}`, style[level], data || '');
    
    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  trackLatency(type: 'STT' | 'AI' | 'TTS' | 'Total', latency: number) {
    switch (type) {
      case 'STT':
        this.metrics.latencySTT.push(latency);
        break;
      case 'AI':
        this.metrics.latencyAI.push(latency);
        break;
      case 'TTS':
        this.metrics.latencyTTS.push(latency);
        break;
      case 'Total':
        this.metrics.latencyTotal.push(latency);
        break;
    }
    
    // Keep only last 100 measurements
    Object.keys(this.metrics).forEach(key => {
      if (Array.isArray(this.metrics[key as keyof typeof this.metrics])) {
        const arr = this.metrics[key as keyof typeof this.metrics] as number[];
        if (arr.length > 100) {
          this.metrics[key as keyof typeof this.metrics] = arr.slice(-100) as any;
        }
      }
    });

    this.log('debug', `${type} Latency: ${latency}ms`);
  }

  incrementCounter(type: 'audioChunks' | 'transcriptUpdates' | 'errors') {
    this.metrics[type]++;
  }

  getAverageLatency(type: 'STT' | 'AI' | 'TTS' | 'Total'): number {
    const key = `latency${type}` as keyof typeof this.metrics;
    const latencies = this.metrics[key] as number[];
    if (latencies.length === 0) return 0;
    return latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
  }

  getPerformanceReport(): string {
    const avgSTT = this.getAverageLatency('STT');
    const avgAI = this.getAverageLatency('AI');
    const avgTTS = this.getAverageLatency('TTS');
    const avgTotal = this.getAverageLatency('Total');

    return `
🎯 VOICE SYSTEM PERFORMANCE REPORT
===============================
📊 Average Latencies:
  • STT (Speech-to-Text): ${avgSTT.toFixed(2)}ms
  • AI (LLM Response): ${avgAI.toFixed(2)}ms  
  • TTS (Text-to-Speech): ${avgTTS.toFixed(2)}ms
  • Total Pipeline: ${avgTotal.toFixed(2)}ms

📈 Processing Metrics:
  • Audio Chunks Processed: ${this.metrics.audioChunks}
  • Transcript Updates: ${this.metrics.transcriptUpdates}
  • Errors Encountered: ${this.metrics.errors}

🎯 Performance Grade: ${this.getPerformanceGrade(avgTotal)}

Recent Activity:
${this.logs.slice(-10).map(log => 
  `  ${new Date(log.timestamp).toLocaleTimeString()} [${log.level.toUpperCase()}] ${log.message}`
).join('\n')}
    `;
  }

  private getPerformanceGrade(avgLatency: number): string {
    if (avgLatency < 300) return '🟢 EXCELLENT (11.ai level)';
    if (avgLatency < 500) return '🟡 GOOD (Acceptable)';
    if (avgLatency < 1000) return '🟠 FAIR (Needs optimization)';
    return '🔴 POOR (Major issues)';
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  reset() {
    this.logs = [];
    this.metrics = {
      latencySTT: [],
      latencyAI: [],
      latencyTTS: [],
      latencyTotal: [],
      audioChunks: 0,
      transcriptUpdates: 0,
      errors: 0
    };
    this.log('info', 'Voice debugger reset');
  }
}

// Global instance
export const voiceDebugger = VoiceDebugger.getInstance();
