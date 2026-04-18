export class RealtimeClient {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.listeners = {};
  }

  buildAzureRealtimeUrl(endpoint, model, apiVersion) {
    let url = endpoint;

    if (url.includes('services.ai.azure.com/api/projects/')) {
      const resourceNameMatch = url.match(/https?:\/\/([^.]+)\.services\.ai\.azure\.com/);
      if (resourceNameMatch) {
        const resourceName = resourceNameMatch[1];
        url = `https://${resourceName}.cognitiveservices.azure.com`;
      }
    }

    if (url.startsWith('http://')) {
      url = url.replace('http://', 'ws://');
    } else if (url.startsWith('https://')) {
      url = url.replace('https://', 'wss://');
    } else if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      url = `wss://${url}`;
    }

    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    if (url.includes('openai.azure.com')) {
      const usesGaPath = url.includes('/openai/v1/realtime');

      if (!usesGaPath && !url.includes('/openai/realtime')) {
        url = `${url}/openai/realtime`;
      }

      const params = new URLSearchParams();
      if (usesGaPath) {
        if (!url.includes('model=') && model) {
          params.append('model', model);
        }
      } else {
        if (!url.includes('api-version=')) {
          params.append('api-version', apiVersion || '2024-10-01-preview');
        }
        if (!url.includes('deployment=') && model) {
          params.append('deployment', model);
        }
      }

      if (params.toString()) {
        url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
      }
    } else if (url.includes('services.ai.azure.com') || url.includes('cognitiveservices.azure.com')) {
      if (!url.includes('/voice-live/realtime')) {
        url = `${url}/voice-live/realtime`;
      }

      const params = new URLSearchParams();
      if (!url.includes('api-version=')) {
        params.append('api-version', apiVersion || '2025-10-01');
      }
      if (!url.includes('model=') && model) {
        params.append('model', model);
      }

      if (params.toString()) {
        url = `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
      }
    }

    return url;
  }

  buildProxyUrl(endpoint, model, apiVersion) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const proxyUrl = new URL(`${protocol}//${window.location.host}/api/realtime`);
    proxyUrl.searchParams.set('endpoint', endpoint);

    if (model) {
      proxyUrl.searchParams.set('model', model);
    }

    if (apiVersion) {
      proxyUrl.searchParams.set('apiVersion', apiVersion);
    }

    return proxyUrl.toString();
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  async connect() {
    const { endpoint, apiKey, model, apiVersion, sessionConfig } = this.config;
    let url;

    if (apiKey) {
      url = this.buildAzureRealtimeUrl(endpoint, model, apiVersion);
      if (!url.includes('api-key=')) {
        url = `${url}${url.includes('?') ? '&' : '?'}api-key=${encodeURIComponent(apiKey)}`;
      }
    } else {
      url = this.buildProxyUrl(endpoint, model, apiVersion);
    }

    console.log('Connecting to:', url); // Debug log (remove in production if sensitive)

    this.ws = new WebSocket(url, "realtime");

    this.ws.onopen = () => {
      this.emit('open');
      
      // Format voice configuration based on voice type
      const openAIVoices = ['alloy', 'echo', 'fable', 'nova', 'shimmer'];
      const voiceValue = sessionConfig.voice;
      let formattedVoice;
      
      if (openAIVoices.includes(voiceValue)) {
        // OpenAI voice - use object format with type
        formattedVoice = {
          name: voiceValue,
          type: "openai"
        };
      } else {
        // Azure voice - use object format with type azure
        formattedVoice = {
          name: voiceValue,
          type: "azure-standard"
        };
      }
      
      // Send initial configuration
      this.send({
        type: "session.update",
        session: {
          ...sessionConfig,
          model,
          voice: formattedVoice,
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
        }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit('message', data);
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    };

    this.ws.onerror = () => {
      this.emit('error', new Error('WebSocket connection error'));
    };

    this.ws.onclose = (event) => {
      this.emit('close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  setTools(tools) {
    // Send tools configuration
    // This should be done in session.update or similar
    this.send({
        type: "session.update",
        session: {
            tools: tools,
            tool_choice: "auto"
        }
    });
  }

  sendToolOutput(callId, output) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output)
      }
    });
    this.send({
        type: "response.create"
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
