/**
 * =====================================================
 *  Terminal WebSocket Server — Real-time Communication
 * =====================================================
 * WebSocket bridge for real shell session communication
 * =====================================================
 */

import { WebSocketServer } from "ws";
import { terminalManager } from "./TerminalManager.js";

/**
 * Attach terminal WebSocket functionality to HTTP server
 */
export function attachTerminalSocket(server) {
  const wss = new WebSocketServer({ 
    server, 
    path: "/ws/terminal",
    perMessageDeflate: false,
    maxPayload: 1024 * 1024 // 1MB
  });

  console.log("🧩 Terminal WebSocket server attached at /ws/terminal");

  wss.on("connection", (ws, request) => {
    console.log("New terminal WebSocket connection");
    
    let currentSession = null;
    let currentSessionId = null;

    try {
      // Create new shell session for this WebSocket
      const { session, sessionId } = terminalManager.createSession();
      currentSession = session;
      currentSessionId = sessionId;

      console.log(`Created shell session ${sessionId} for WebSocket`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: "welcome",
        sessionId,
        message: "🧜‍♀️ RinaWarp Terminal Pro - Real Shell Ready!",
        platform: process.platform,
        timestamp: Date.now()
      }));

      // Pipe shell output to WebSocket client
      session.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: "output",
              data,
              sessionId,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error("Error sending output to client:", error);
          }
        }
      });

      // Handle client messages (commands)
      ws.on("message", (msg) => {
        if (ws.readyState !== ws.OPEN) {
          return;
        }

        try {
          const message = msg.toString();
          console.log(`Session ${sessionId} received: ${message}`);

          // Send command to shell
          session.write(message);

          // Send acknowledgment
          ws.send(JSON.stringify({
            type: "ack",
            command: message,
            sessionId,
            timestamp: Date.now()
          }));

        } catch (error) {
          console.error(`Error processing message for session ${sessionId}:`, error);
          
          ws.send(JSON.stringify({
            type: "error",
            message: "Failed to process command",
            error: error.message,
            timestamp: Date.now()
          }));
        }
      });

      // Handle WebSocket close
      ws.on("close", (code, reason) => {
        console.log(`WebSocket closed for session ${sessionId} (code: ${code})`);
        
        if (currentSession) {
          terminalManager.closeSession(currentSessionId);
          currentSession = null;
        }
      });

      // Handle WebSocket errors
      ws.on("error", (error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
        
        if (currentSession) {
          terminalManager.closeSession(currentSessionId);
          currentSession = null;
        }
      });

      // Keepalive ping
      ws.on("pong", () => {
        ws.isAlive = true;
      });

    } catch (error) {
      console.error("Error creating terminal session:", error);
      
      try {
        ws.send(JSON.stringify({
          type: "error",
          message: "Failed to create terminal session",
          error: error.message,
          timestamp: Date.now()
        }));
      } catch (sendError) {
        console.error("Error sending creation error:", sendError);
      }
      
      try {
        ws.close();
      } catch (closeError) {
        console.error("Error closing WebSocket:", closeError);
      }
    }
  });

  // Connection error handling
  wss.on("error", (error) => {
    console.error("Terminal WebSocket server error:", error);
  });

  // Handle server close
  wss.on("close", () => {
    console.log("Terminal WebSocket server closed");
  });

  // Setup keepalive ping
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log("Terminating inactive WebSocket connection");
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // Cleanup ping interval when server closes
  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  return wss;
}