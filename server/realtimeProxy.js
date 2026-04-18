import { DefaultAzureCredential } from '@azure/identity';
import { WebSocket, WebSocketServer } from 'ws';
import { verifyClientPrincipal } from './auth.js';

const REALTIME_PROTOCOL = 'realtime';
const FOUNDARY_SCOPE = 'https://ai.azure.com/.default';
const COGNITIVE_SCOPE = 'https://cognitiveservices.azure.com/.default';

function normalizeCloseCode(code) {
  if (typeof code !== 'number') {
    return 1000;
  }

  if (code >= 3000 && code <= 4999) {
    return code;
  }

  const allowedCodes = new Set([1000, 1001, 1002, 1003, 1007, 1008, 1009, 1010, 1011, 1012, 1013, 1014]);
  return allowedCodes.has(code) ? code : 1000;
}

function normalizeCloseReason(reason) {
  if (typeof reason === 'string') {
    return reason;
  }

  if (reason instanceof Buffer) {
    return reason.toString('utf8');
  }

  return '';
}

function normalizeEndpointUrl(endpoint, model, apiVersion) {
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

async function getAccessToken(targetUrl) {
  const credential = new DefaultAzureCredential();
  const scopes = targetUrl.includes('services.ai.azure.com')
    ? [FOUNDARY_SCOPE, COGNITIVE_SCOPE]
    : [COGNITIVE_SCOPE];

  let lastError = null;
  for (const scope of scopes) {
    try {
      const token = await credential.getToken(scope);
      if (token?.token) {
        return token.token;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to acquire Azure access token');
}

export function attachRealtimeProxy(server) {
  const proxyServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    if (requestUrl.pathname !== '/api/realtime') {
      return;
    }

    const authResult = verifyClientPrincipal(request.headers);
    if (!authResult.ok) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    proxyServer.handleUpgrade(request, socket, head, (clientSocket) => {
      clientSocket.clientPrincipal = authResult.principal;
      proxyServer.emit('connection', clientSocket, request);
    });
  });

  proxyServer.on('connection', async (clientSocket, request) => {
    let azureSocket;
    const pendingMessages = [];

    const forwardMessage = (message, isBinary) => {
      if (!azureSocket) {
        pendingMessages.push({ message, isBinary });
        return;
      }

      if (azureSocket.readyState === WebSocket.OPEN) {
        azureSocket.send(message, { binary: isBinary });
        return;
      }

      if (azureSocket.readyState === WebSocket.CONNECTING) {
        pendingMessages.push({ message, isBinary });
      }
    };

    clientSocket.on('message', (message, isBinary) => {
      forwardMessage(message, isBinary);
    });

    clientSocket.on('close', (code, reason) => {
      if (azureSocket && (azureSocket.readyState === WebSocket.OPEN || azureSocket.readyState === WebSocket.CONNECTING)) {
        azureSocket.close(normalizeCloseCode(code), normalizeCloseReason(reason));
      }
    });

    clientSocket.on('error', () => {
      if (azureSocket && (azureSocket.readyState === WebSocket.OPEN || azureSocket.readyState === WebSocket.CONNECTING)) {
        azureSocket.close(1011, 'Client socket error');
      }
    });

    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host}`);
      const endpoint = requestUrl.searchParams.get('endpoint');
      const model = requestUrl.searchParams.get('model');
      const apiVersion = requestUrl.searchParams.get('apiVersion');

      if (!endpoint) {
        clientSocket.close(1008, 'Endpoint is required');
        return;
      }

      const targetUrl = normalizeEndpointUrl(endpoint, model, apiVersion);
      const accessToken = await getAccessToken(targetUrl);

      azureSocket = new WebSocket(targetUrl, REALTIME_PROTOCOL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      azureSocket.on('open', () => {
        while (pendingMessages.length > 0 && azureSocket.readyState === WebSocket.OPEN) {
          const pendingMessage = pendingMessages.shift();
          azureSocket.send(pendingMessage.message, { binary: pendingMessage.isBinary });
        }
      });

      azureSocket.on('message', (message, isBinary) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(message, { binary: isBinary });
        }
      });

      azureSocket.on('close', (code, reason) => {
        if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
          clientSocket.close(normalizeCloseCode(code), normalizeCloseReason(reason));
        }
      });

      azureSocket.on('error', (error) => {
        console.error('Realtime proxy upstream error:', error);
        if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
          clientSocket.close(1011, 'Azure realtime connection failed');
        }
      });
    } catch (error) {
      console.error('Realtime proxy connection error:', error);
      if (clientSocket.readyState === WebSocket.OPEN || clientSocket.readyState === WebSocket.CONNECTING) {
        clientSocket.close(1011, error.message);
      }
      if (azureSocket && (azureSocket.readyState === WebSocket.OPEN || azureSocket.readyState === WebSocket.CONNECTING)) {
        azureSocket.close(1011, 'Proxy initialization failed');
      }
    }
  });

  return proxyServer;
}