import { WebSocketServer } from "ws";
import { TerminalManager } from "../services/TerminalManager.js";

/**
 * Attach terminal WebSocket functionality to an HTTP server
 * @param {import('http').Server} server - The HTTP server to attach WebSocket to
 * @param {Object} options - Configuration options
 */
export function attachTerminalSocket(server, options = {}) {
  const wss = new WebSocketServer({ 
    server, 
    path: options.path || "/ws/terminal",
    perMessageDeflate: false,
    maxPayload: 1024 * 1024 // 1MB max payload
  });

  console.log(`Terminal WebSocket server attached on path: ${wss.options.path}`);

  wss.on("connection", (ws, request) => {
    console.log("New WebSocket connection to terminal endpoint");
    
    let session = null;
    let sessionId = null;

    try {
      // Create a new shell session for this WebSocket connection
      session = TerminalManager.createSession({
        cwd: options.cwd,
        env: options.env
      });
      sessionId = session.id;

      console.log(`Created shell session ${sessionId} for WebSocket connection`);

      // Send session info to client
      ws.send(JSON.stringify({ 
        type: "session", 
        id: sessionId,
        platform: process.platform,
        timestamp: Date.now()
      }));

      // Setup stdout listener
      session.onStdout((data) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({ 
              type: "stdout", 
              data,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error(`Error sending stdout to client ${sessionId}:`, error);
          }
        }
      });

      // Setup stderr listener
      session.onStderr((data) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({ 
              type: "stderr", 
              data,
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error(`Error sending stderr to client ${sessionId}:`, error);
          }
        }
      });

      // Handle client messages
      ws.on("message", (msg) => {
        if (ws.readyState !== ws.OPEN) {
          console.warn(`Received message from closed connection for session ${sessionId}`);
          return;
        }

        try {
          const message = msg.toString();
          console.log(`Received command for session ${sessionId}:`, message);

          // Send the command to the shell
          session.write(message);

          // Send acknowledgment
          ws.send(JSON.stringify({ 
            type: "ack", 
            command: message,
            timestamp: Date.now()
          }));

        } catch (error) {
          console.error(`Error processing message for session ${sessionId}:`, error);
          
          try {
            ws.send(JSON.stringify({ 
              type: "error", 
              message: "Failed to process command",
              error: error.message,
              timestamp: Date.now()
            }));
          } catch (sendError) {
            console.error(`Error sending error message:`, sendError);
          }
        }
      });

      // Handle WebSocket close
      ws.on("close", (code, reason) => {
        console.log(`WebSocket connection closed for session ${sessionId} (code: ${code}, reason: ${reason})`);
        
        if (session) {
          TerminalManager.destroySession(sessionId);
          session = null;
        }
      });

      // Handle WebSocket errors
      ws.on("error", (error) => {
        console.error(`WebSocket error for session ${sessionId}:`, error);
        
        if (session) {
          TerminalManager.destroySession(sessionId);
          session = null;
        }
      });

      // Handle pong messages for keepalive
      ws.on("pong", () => {
        ws.isAlive = true;
      });

      console.log(`Terminal WebSocket session ${sessionId} established successfully`);

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
        console.error("Error closing WebSocket after creation failure:", closeError);
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
        console.log(`Terminating inactive WebSocket connection for session ${sessionId}`);
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