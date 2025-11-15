/**
 * =====================================================
 *  Terminal Manager — Session Lifecycle
 * =====================================================
 * Manages multiple shell sessions with cleanup
 * =====================================================
 */

import { ShellSession } from "./ShellSession.js";

/**
 * Terminal Manager - handles multiple shell sessions
 */
export class TerminalManager {
  constructor() {
    this.sessions = new Map();
    this.nextSessionId = 1;
  }
  
  /**
   * Create a new shell session
   */
  createSession(options = {}) {
    const sessionId = `session-${this.nextSessionId++}`;
    const session = new ShellSession({ ...options, id: sessionId });
    
    this.sessions.set(sessionId, session);
    console.log(`Created session ${sessionId}, total: ${this.sessions.size}`);
    
    // Auto-cleanup when session ends
    session.shell.on("exit", () => {
      this.sessions.delete(sessionId);
      console.log(`Auto-cleaned session ${sessionId}`);
    });
    
    return { session, sessionId };
  }
  
  /**
   * Get a session by ID
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session && session.isActive() ? session : null;
  }
  
  /**
   * Close a specific session
   */
  closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.kill();
      this.sessions.delete(sessionId);
      console.log(`Closed session ${sessionId}`);
      return true;
    }
    return false;
  }
  
  /**
   * Get info about all active sessions
   */
  getAllSessions() {
    const activeSessions = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.isActive()) {
        activeSessions.push({
          id,
          info: session.getInfo()
        });
      } else {
        // Clean up inactive sessions
        this.sessions.delete(id);
      }
    }
    return activeSessions;
  }
  
  /**
   * Get total number of sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }
  
  /**
   * Close all sessions
   */
  closeAllSessions() {
    const count = this.sessions.size;
    for (const [id, session] of this.sessions.entries()) {
      session.kill();
    }
    this.sessions.clear();
    console.log(`Closed all ${count} sessions`);
    return count;
  }
  
  /**
   * Get session statistics
   */
  getStats() {
    const active = [];
    const inactive = [];
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.isActive()) {
        active.push(id);
      } else {
        inactive.push(id);
      }
    }
    
    return {
      total: this.sessions.size,
      active: active.length,
      inactive: inactive.length,
      activeIds: active,
      inactiveIds: inactive
    };
  }
}

// Export singleton instance
export const terminalManager = new TerminalManager();