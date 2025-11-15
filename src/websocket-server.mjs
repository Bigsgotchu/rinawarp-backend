import { WebSocketServer } from 'ws';
import aiProviderManager from './ai-providers.js';
import memoryManager from './memory.js';
import voiceSynthesisManager from './voice-synthesis.mjs';

/**
 * Enhanced WebSocket server for real-time streaming
 */
class RinaWarpWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/stream' });
    this.clients = new Map();
    this.heartbeatInterval = null;

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      connectedAt: new Date().toISOString(),
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      isAlive: true,
    };

    this.clients.set(clientId, clientInfo);

    console.log(`WebSocket client ${clientId} connected from ${clientInfo.ip}`);

    // Send welcome message
    this.sendToClient(ws, {
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
      message: 'Connected to RinaWarp Terminal Pro',
    });

    // Set up client-specific handlers
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });

    ws.on('pong', () => {
      clientInfo.isAlive = true;
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      this.handleError(clientId, error);
    });
  }

  /**
   * Handle messages from clients
   */
  async handleClientMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      console.log(`Message from ${clientId}:`, message.type);

      switch (message.type) {
      case 'ai_stream_request':
        await this.handleAIStreamRequest(client, message);
        break;
      case 'voice_stream_request':
        await this.handleVoiceStreamRequest(client, message);
        break;
      case 'command_stream_request':
        await this.handleCommandStreamRequest(client, message);
        break;
      case 'heartbeat':
        this.sendToClient(client.ws, { type: 'heartbeat_ack' });
        break;
      case 'subscribe':
        this.handleSubscription(client, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(client, message);
        break;
      default:
        this.sendToClient(client.ws, {
          type: 'error',
          message: `Unknown message type: ${message.type}`,
        });
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      const client = this.clients.get(clientId);
      if (client) {
        this.sendToClient(client.ws, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    }
  }

  /**
   * Handle AI streaming requests
   */
  async handleAIStreamRequest(client, message) {
    const { prompt, provider = 'groq', options = {} } = message;

    if (!prompt) {
      this.sendToClient(client.ws, {
        type: 'error',
        message: 'Prompt is required for AI streaming',
      });
      return;
    }

    try {
      // Send streaming start confirmation
      this.sendToClient(client.ws, {
        type: 'ai_stream_start',
        requestId: message.requestId,
        provider,
        timestamp: new Date().toISOString(),
      });

      // Get conversation context
      const conversationHistory = memoryManager.getConversationHistory(5);
      const contextMessages = conversationHistory
        .map((conv) => [
          { role: 'user', content: conv.summary },
          { role: 'assistant', content: 'Previous conversation context' },
        ])
        .flat();

      const messages = [...contextMessages, { role: 'user', content: prompt }];

      // Stream AI response
      let response = '';
      await aiProviderManager.generateCompletion(provider, {
        messages,
        stream: true,
        onToken: (token, finished) => {
          response += token;
          this.sendToClient(client.ws, {
            type: 'ai_token',
            requestId: message.requestId,
            token,
            finished,
            response: finished ? response : null,
          });
        },
      });

      // Store in memory after completion
      memoryManager.addMessage(prompt, response, provider, {
        streaming: true,
        requestId: message.requestId,
      });
    } catch (error) {
      console.error(`AI streaming error for ${client.id}:`, error);
      this.sendToClient(client.ws, {
        type: 'ai_stream_error',
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  /**
   * Handle voice streaming requests
   */
  async handleVoiceStreamRequest(client, message) {
    const { text, voice, options = {} } = message;

    if (!text) {
      this.sendToClient(client.ws, {
        type: 'error',
        message: 'Text is required for voice streaming',
      });
      return;
    }

    try {
      // Send streaming start confirmation
      this.sendToClient(client.ws, {
        type: 'voice_stream_start',
        requestId: message.requestId,
        timestamp: new Date().toISOString(),
      });

      // Generate speech with streaming
      const speechResult = await voiceSynthesisManager.streamSpeech(text, {
        voiceId: voice,
        ...options,
        onChunk: (audioBuffer, finished) => {
          this.sendToClient(client.ws, {
            type: 'voice_chunk',
            requestId: message.requestId,
            finished,
            size: audioBuffer.length,
          });

          if (finished) {
            this.sendToClient(client.ws, {
              type: 'voice_complete',
              requestId: message.requestId,
              timestamp: new Date().toISOString(),
            });
          }
        },
      });
    } catch (error) {
      console.error(`Voice streaming error for ${client.id}:`, error);
      this.sendToClient(client.ws, {
        type: 'voice_stream_error',
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  /**
   * Handle command streaming requests
   */
  async handleCommandStreamRequest(client, message) {
    const { command, args = [], workingDirectory = process.cwd() } = message;

    if (!command) {
      this.sendToClient(client.ws, {
        type: 'error',
        message: 'Command is required',
      });
      return;
    }

    try {
      // Send execution start confirmation
      this.sendToClient(client.ws, {
        type: 'command_start',
        requestId: message.requestId,
        command,
        args,
        timestamp: new Date().toISOString(),
      });

      // Execute command with streaming output
      const { spawn } = await import('child_process');
      const child = spawn(command, args, {
        cwd: workingDirectory,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Stream stdout
      child.stdout.on('data', (data) => {
        this.sendToClient(client.ws, {
          type: 'command_output',
          requestId: message.requestId,
          output: data.toString(),
          stream: 'stdout',
        });
      });

      // Stream stderr
      child.stderr.on('data', (data) => {
        this.sendToClient(client.ws, {
          type: 'command_output',
          requestId: message.requestId,
          output: data.toString(),
          stream: 'stderr',
        });
      });

      // Handle process completion
      child.on('close', (code) => {
        this.sendToClient(client.ws, {
          type: 'command_complete',
          requestId: message.requestId,
          exitCode: code,
          timestamp: new Date().toISOString(),
        });
      });

      child.on('error', (error) => {
        this.sendToClient(client.ws, {
          type: 'command_error',
          requestId: message.requestId,
          error: error.message,
        });
      });
    } catch (error) {
      console.error(`Command execution error for ${client.id}:`, error);
      this.sendToClient(client.ws, {
        type: 'command_error',
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  /**
   * Handle subscription requests
   */
  handleSubscription(client, message) {
    const { events = [] } = message;

    if (!client.subscriptions) {
      client.subscriptions = [];
    }

    client.subscriptions.push(...events);

    this.sendToClient(client.ws, {
      type: 'subscription_confirmed',
      events,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle unsubscription requests
   */
  handleUnsubscription(client, message) {
    const { events = [] } = message;

    if (client.subscriptions) {
      client.subscriptions = client.subscriptions.filter(
        (sub) => !events.includes(sub)
      );
    }

    this.sendToClient(client.ws, {
      type: 'unsubscription_confirmed',
      events,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId, code, reason) {
    console.log(
      `WebSocket client ${clientId} disconnected: ${code} - ${reason}`
    );
    this.clients.delete(clientId);
  }

  /**
   * Handle WebSocket errors
   */
  handleError(clientId, error) {
    console.error(`WebSocket error for client ${clientId}:`, error);
    this.clients.delete(clientId);
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message) {
    const data = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        try {
          client.ws.send(data);
        } catch (error) {
          console.error(`Error broadcasting to ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      } else {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Broadcast to clients subscribed to specific events
   */
  broadcastToSubscribers(eventType, message) {
    const data = JSON.stringify({ type: eventType, ...message });

    for (const [clientId, client] of this.clients) {
      if (
        client.ws.readyState === client.ws.OPEN &&
        (!client.subscriptions || client.subscriptions.includes(eventType))
      ) {
        try {
          client.ws.send(data);
        } catch (error) {
          console.error(`Error broadcasting to ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      } else {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Start heartbeat to detect dead connections
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of this.clients) {
        if (!client.isAlive) {
          client.ws.terminate();
          this.clients.delete(clientId);
          console.log(`Terminated dead connection: ${clientId}`);
          continue;
        }

        client.isAlive = false;
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Error sending ping to ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const now = Date.now();
    const activeConnections = [];

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === client.ws.OPEN) {
        activeConnections.push({
          clientId,
          connectedAt: client.connectedAt,
          uptime: now - new Date(client.connectedAt).getTime(),
          ip: client.ip,
          subscriptions: client.subscriptions || [],
        });
      }
    }

    return {
      totalConnections: this.clients.size,
      activeConnections: activeConnections.length,
      connections: activeConnections,
      uptime: now - (this.startTime || now),
    };
  }

  /**
   * Graceful shutdown
   */
  shutdown() {
    this.stopHeartbeat();

    // Close all connections
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutting down');
      } catch (error) {
        console.error(`Error closing connection ${clientId}:`, error);
      }
    }

    this.clients.clear();
  }
}

export default RinaWarpWebSocketServer;
