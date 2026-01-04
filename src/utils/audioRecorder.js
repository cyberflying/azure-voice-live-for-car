/**
 * Audio Recorder Utility
 * Collects PCM16 audio data from user and assistant, exports as a single WAV file
 */

export class AudioRecorder {
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.audioChunks = [];  // 按时间顺序存储所有音频块
    this.isRecording = false;
    this.startTime = null;  // 录音开始时间
    this.sessionId = null;  // 会话 UUID
    this.lastBlob = null;   // 最后生成的音频 Blob
    this.lastFilename = null; // 最后生成的文件名
    this.pendingByte = null;  // 存储未配对的字节
  }

  // 生成 UUID
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 格式化日期时间为 yyyy-mm-dd HH_MM_SS
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
    this.audioChunks = [];
    this.isRecording = true;
    this.startTime = new Date();
    this.sessionId = this.generateUUID();
    this.lastBlob = null;
    this.lastFilename = null;
    this.pendingByte = null;  // 重置
  }

  stop() {
    this.isRecording = false;
    // 自动生成 WAV 文件（但不下载）
    if (this.audioChunks.length > 0) {
      this.prepareWavFile();
    }
  }

  // 添加用户音频 (PCM16 Int16Array)
  addUserAudio(pcm16Data) {
    if (this.isRecording && pcm16Data) {
      this.audioChunks.push({
        type: 'user',
        data: new Int16Array(pcm16Data),
        timestamp: Date.now()
      });
    }
  }

  // 添加助手音频 (从 base64 解码)
  addAssistantAudio(base64Audio) {
    if (this.isRecording && base64Audio) {
      const binaryString = atob(base64Audio);
      let bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 处理上次遗留的未配对字节
      if (this.pendingByte !== null) {
        const newBytes = new Uint8Array(1 + bytes.length);
        newBytes[0] = this.pendingByte;
        newBytes.set(bytes, 1);
        bytes = newBytes;
        this.pendingByte = null;
      }

      // 如果字节数是奇数，保存最后一个字节到下次
      if (bytes.length % 2 !== 0) {
        this.pendingByte = bytes[bytes.length - 1];
        bytes = bytes.slice(0, bytes.length - 1);
      }

      if (bytes.length > 0) {
        const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
        this.audioChunks.push({
          type: 'assistant',
          data: new Int16Array(pcm16),  // 复制一份
          timestamp: Date.now()
        });
      }
    }
  }

  // 合并所有音频块（按时间顺序）
  mergeAllChunks() {
    // 按时间戳排序
    const sortedChunks = [...this.audioChunks].sort((a, b) => a.timestamp - b.timestamp);
    
    // 计算总长度
    const totalLength = sortedChunks.reduce((acc, chunk) => acc + chunk.data.length, 0);
    const merged = new Int16Array(totalLength);
    
    let offset = 0;
    for (const chunk of sortedChunks) {
      merged.set(chunk.data, offset);
      offset += chunk.data.length;
    }
    return merged;
  }

  // 创建 WAV 文件头
  createWavHeader(dataLength, sampleRate, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);           // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true);  // SampleRate
    view.setUint32(28, byteRate, true);    // ByteRate
    view.setUint16(32, blockAlign, true);  // BlockAlign
    view.setUint16(34, bitsPerSample, true); // BitsPerSample

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    return buffer;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // 准备 WAV 文件（不下载，只生成 Blob）
  prepareWavFile() {
    if (this.audioChunks.length === 0) {
      console.warn('No audio data to prepare');
      return null;
    }

    const merged = this.mergeAllChunks();
    const dataLength = merged.length * 2; // 16-bit = 2 bytes per sample
    const header = this.createWavHeader(dataLength, this.sampleRate);

    // Combine header and data
    const wavBuffer = new Uint8Array(44 + dataLength);
    wavBuffer.set(new Uint8Array(header), 0);
    wavBuffer.set(new Uint8Array(merged.buffer), 44);

    // Create blob
    this.lastBlob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    // Generate filename: convo_<uuid>_yyyy-mm-dd HH_MM_SS.wav
    const formattedTime = this.formatDateTime(this.startTime || new Date());
    this.lastFilename = `convo_${this.sessionId}_${formattedTime}.wav`;

    return { blob: this.lastBlob, filename: this.lastFilename };
  }

  // 下载已准备好的 WAV 文件
  downloadWavFile() {
    if (!this.lastBlob || !this.lastFilename) {
      // 如果没有准备好，先准备
      if (!this.prepareWavFile()) {
        console.warn('No audio data to download');
        return null;
      }
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

  // 导出合并的对话音频为 WAV（兼容旧接口）
  exportConversationAudio() {
    return this.downloadWavFile();
  }

  // 获取已准备的文件信息
  getPreparedFile() {
    return {
      blob: this.lastBlob,
      filename: this.lastFilename,
      hasFile: this.lastBlob !== null
    };
  }

  // 获取录音统计
  getStats() {
    const userChunks = this.audioChunks.filter(c => c.type === 'user');
    const assistantChunks = this.audioChunks.filter(c => c.type === 'assistant');
    
    const userSamples = userChunks.reduce((acc, chunk) => acc + chunk.data.length, 0);
    const assistantSamples = assistantChunks.reduce((acc, chunk) => acc + chunk.data.length, 0);
    const totalSamples = userSamples + assistantSamples;
    
    return {
      totalDuration: (totalSamples / this.sampleRate).toFixed(2),
      userDuration: (userSamples / this.sampleRate).toFixed(2),
      assistantDuration: (assistantSamples / this.sampleRate).toFixed(2),
      totalChunks: this.audioChunks.length,
      userChunks: userChunks.length,
      assistantChunks: assistantChunks.length
    };
  }

  clear() {
    this.audioChunks = [];
    this.lastBlob = null;
    this.lastFilename = null;
    this.startTime = null;
    this.sessionId = null;
    this.pendingByte = null;  // 重置
  }

  hasData() {
    return this.audioChunks.length > 0;
  }

  hasReadyFile() {
    return this.lastBlob !== null && this.lastFilename !== null;
  }
}
