import { Router } from "express";
import { TerminalManager } from "../services/TerminalManager.js";

const router = Router();

/**
 * Create a new terminal session
 * POST /api/terminal/session
 */
router.post("/session", (req, res) => {
  try {
    const { cwd, env, shell } = req.body || {};
    
    const session = TerminalManager.createSession({
      cwd,
      env,
      shell
    });

    res.json({
      success: true,
      session: {
        id: session.id,
        platform: process.platform,
        cwd: session.process.cwd?.() || process.cwd(),
        isActive: session.isActive()
      }
    });
  } catch (error) {
    console.error("Error creating terminal session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create terminal session",
      message: error.message
    });
  }
});

/**
 * Get session information
 * GET /api/terminal/session/:id
 */
router.get("/session/:id", (req, res) => {
  try {
    const { id } = req.params;
    const session = TerminalManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or inactive"
      });
    }

    res.json({
      success: true,
      session: session.getInfo()
    });
  } catch (error) {
    console.error(`Error getting session ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to get session information",
      message: error.message
    });
  }
});

/**
 * Close/destroy a terminal session
 * DELETE /api/terminal/session/:id
 */
router.delete("/session/:id", (req, res) => {
  try {
    const { id } = req.params;
    const session = TerminalManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or already closed"
      });
    }

    TerminalManager.destroySession(id);

    res.json({
      success: true,
      message: "Session closed successfully",
      sessionId: id
    });
  } catch (error) {
    console.error(`Error destroying session ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to close session",
      message: error.message
    });
  }
});

/**
 * List all active sessions
 * GET /api/terminal/sessions
 */
router.get("/sessions", (req, res) => {
  try {
    const sessions = TerminalManager.getAllSessions();
    
    res.json({
      success: true,
      sessions,
      total: sessions.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Error getting all sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sessions list",
      message: error.message
    });
  }
});

/**
 * Get terminal manager statistics
 * GET /api/terminal/stats
 */
router.get("/stats", (req, res) => {
  try {
    const stats = TerminalManager.getStats();
    
    res.json({
      success: true,
      stats,
      server: {
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    console.error("Error getting terminal stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get statistics",
      message: error.message
    });
  }
});

/**
 * Execute a command in a specific session
 * POST /api/terminal/session/:id/execute
 */
router.post("/session/:id/execute", (req, res) => {
  try {
    const { id } = req.params;
    const { command } = req.body;
    
    if (!command || typeof command !== "string") {
      return res.status(400).json({
        success: false,
        error: "Command is required and must be a string"
      });
    }

    const session = TerminalManager.getSession(id);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found or inactive"
      });
    }

    // Execute the command
    session.write(command);

    res.json({
      success: true,
      message: "Command sent to session",
      sessionId: id,
      command
    });
  } catch (error) {
    console.error(`Error executing command in session ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: "Failed to execute command",
      message: error.message
    });
  }
});

/**
 * Clean up inactive sessions
 * POST /api/terminal/cleanup
 */
router.post("/cleanup", (req, res) => {
  try {
    const cleaned = TerminalManager.cleanupInactiveSessions();
    
    res.json({
      success: true,
      message: "Cleanup completed",
      cleanedSessions: cleaned
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clean up sessions",
      message: error.message
    });
  }
});

/**
 * Destroy all sessions
 * DELETE /api/terminal/sessions
 */
router.delete("/sessions", (req, res) => {
  try {
    const count = TerminalManager.getSessionCount();
    TerminalManager.destroyAllSessions();
    
    res.json({
      success: true,
      message: "All sessions destroyed",
      destroyedSessions: count
    });
  } catch (error) {
    console.error("Error destroying all sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to destroy all sessions",
      message: error.message
    });
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

export default router;