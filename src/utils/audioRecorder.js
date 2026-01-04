/**
 * Audio Recorder Utility
 * Collects PCM16 audio data from user and assistant, exports as a single WAV file
 * Audio is recorded in chronological order to preserve conversation flow
 */

export class AudioRecorder {
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.isRecording = false;
    this.startTime = null;
    this.sessionId = null;
    this.lastBlob = null;
    this.lastFilename = null;
    
    // 按时间顺序存储的音频数据
    this.audioTimeline = [];  // { type: 'user'|'assistant', bytes: Uint8Array, timestamp: number }
    
    // 用于统计的计数器
    this.userBytesCount = 0;
    this.assistantBytesCount = 0;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  formatDateTime(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}_${minutes}_${seconds}`;
  }

  start() {
    this.audioTimeline = [];
    this.userBytesCount = 0;
    this.assistantBytesCount = 0;
    this.isRecording = true;
    this.startTime = new Date();
    this.sessionId = this.generateUUID();
    this.lastBlob = null;
    this.lastFilename = null;
  }

  stop() {
    this.isRecording = false;
    if (this.hasData()) {
      this.prepareWavFile();
    }
  }

  // 添加用户音频 - 按时间顺序记录
  addUserAudio(pcm16Data) {
    if (this.isRecording && pcm16Data) {
      const int16 = new Int16Array(pcm16Data);
      const bytes = new Uint8Array(int16.buffer.slice(int16.byteOffset, int16.byteOffset + int16.byteLength));
      
      this.audioTimeline.push({
        type: 'user',
        bytes: bytes,
        timestamp: Date.now()
      });
      
      this.userBytesCount += bytes.length;
    }
  }

  // 添加助手音频 - 按时间顺序记录
  addAssistantAudio(base64Audio) {
    if (this.isRecording && base64Audio) {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      this.audioTimeline.push({
        type: 'assistant',
        bytes: bytes,
        timestamp: Date.now()
      });
      
      this.assistantBytesCount += bytes.length;
    }
  }

  // 创建 WAV 文件头
  createWavHeader(dataLength, sampleRate, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    return buffer;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // 按时间顺序合并音频数据
  mergeAudioByTimeline(filterType = null) {
    // 按时间戳排序（虽然理论上已经是按顺序添加的，但确保一下）
    const sortedTimeline = [...this.audioTimeline].sort((a, b) => a.timestamp - b.timestamp);
    
    // 根据过滤类型筛选
    const filtered = filterType 
      ? sortedTimeline.filter(item => item.type === filterType)
      : sortedTimeline;
    
    // 计算总字节数
    const totalBytes = filtered.reduce((sum, item) => sum + item.bytes.length, 0);
    
    // 合并所有字节
    const mergedBytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const item of filtered) {
      mergedBytes.set(item.bytes, offset);
      offset += item.bytes.length;
    }
    
    return mergedBytes;
  }

  // 准备 WAV 文件
  prepareWavFile(type = 'all') {
    let audioBytes;
    
    if (type === 'assistant') {
      audioBytes = this.mergeAudioByTimeline('assistant');
    } else if (type === 'user') {
      audioBytes = this.mergeAudioByTimeline('user');
    } else {
      // 'all' - 按时间顺序合并所有音频
      audioBytes = this.mergeAudioByTimeline(null);
    }

    if (audioBytes.length === 0) {
      console.warn('No audio data to prepare');
      return null;
    }

    // 确保字节数是偶数
    const dataLength = audioBytes.length % 2 === 0 ? audioBytes.length : audioBytes.length - 1;
    const header = this.createWavHeader(dataLength, this.sampleRate);

    const wavBuffer = new Uint8Array(44 + dataLength);
    wavBuffer.set(new Uint8Array(header), 0);
    wavBuffer.set(audioBytes.slice(0, dataLength), 44);

    this.lastBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    const formattedTime = this.formatDateTime(this.startTime || new Date());
    const typeStr = type === 'all' ? '' : `_${type}`;
    this.lastFilename = `convo_${this.sessionId}${typeStr}_${formattedTime}.wav`;

    return { blob: this.lastBlob, filename: this.lastFilename };
  }

  downloadWavFile(type = 'all') {
    // 重新准备指定类型的文件
    if (!this.prepareWavFile(type)) {
      console.warn('No audio data to download');
      return null;
    }

    const url = URL.createObjectURL(this.lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.lastFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { blob: this.lastBlob, filename: this.lastFilename };
  }

  // 导出完整对话音频（按时间顺序）
  exportConversationAudio() {
    return this.downloadWavFile('all');
  }

  // 只导出助手音频
  exportAssistantAudio() {
    return this.downloadWavFile('assistant');
  }

  // 只导出用户音频
  exportUserAudio() {
    return this.downloadWavFile('user');
  }

  getPreparedFile() {
    return {
      blob: this.lastBlob,
      filename: this.lastFilename,
      hasFile: this.lastBlob !== null
    };
  }

  getStats() {
    const userBytes = this.userBytesCount;
    const assistantBytes = this.assistantBytesCount;
    
    return {
      totalDuration: ((userBytes + assistantBytes) / 2 / this.sampleRate).toFixed(2),
      userDuration: (userBytes / 2 / this.sampleRate).toFixed(2),
      assistantDuration: (assistantBytes / 2 / this.sampleRate).toFixed(2),
      totalBytes: userBytes + assistantBytes,
      userBytes: userBytes,
      assistantBytes: assistantBytes,
      segmentCount: this.audioTimeline.length
    };
  }

  clear() {
    this.audioTimeline = [];
    this.userBytesCount = 0;
    this.assistantBytesCount = 0;
    this.lastBlob = null;
    this.lastFilename = null;
    this.startTime = null;
    this.sessionId = null;
  }

  hasData() {
    return this.audioTimeline.length > 0;
  }

  hasReadyFile() {
    return this.lastBlob !== null && this.lastFilename !== null;
  }
}
