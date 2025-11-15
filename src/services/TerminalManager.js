import { ShellSession } from "./ShellSession.js";

export class TerminalManager {
  static sessions = new Map();

  /**
   * Create a new shell session
   * @param {Object} options - ShellSession options
   * @returns {ShellSession}
   */
  static createSession(options = {}) {
    const session = new ShellSession(options);
    this.sessions.set(session.id, session);
    
    // Clean up closed sessions periodically
    session.onStdout(() => {}); // Ensure stdout listeners are set up
    session.onStderr(() => {}); // Ensure stderr listeners are set up
    
    console.log(`Created session ${session.id}, total sessions: ${this.sessions.size}`);
    return session;
  }

  /**
   * Get a shell session by ID
   * @param {string} id
   * @returns {ShellSession|undefined}
   */
  static getSession(id) {
    const session = this.sessions.get(id);
    if (session && session.isActive()) {
      return session;
    } else if (session && !session.isActive()) {
      // Remove inactive sessions
      this.sessions.delete(id);
      console.log(`Removed inactive session ${id}`);
    }
    return undefined;
  }

  /**
   * Destroy a shell session by ID
   * @param {string} id
   */
  static destroySession(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.close();
      this.sessions.delete(id);
      console.log(`Destroyed session ${id}, remaining sessions: ${this.sessions.size}`);
    } else {
      console.warn(`Attempted to destroy non-existent session ${id}`);
    }
  }

  /**
   * Get information about all active sessions
   * @returns {Array<Object>}
   */
  static getAllSessions() {
    const sessionInfo = [];
    for (const [id, session] of this.sessions.entries()) {
      if (session.isActive()) {
        sessionInfo.push(session.getInfo());
      } else {
        // Clean up inactive sessions
        this.sessions.delete(id);
      }
    }
    return sessionInfo;
  }

  /**
   * Get total number of active sessions
   * @returns {number}
   */
  static getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up all inactive sessions
   */
  static cleanupInactiveSessions() {
    let cleaned = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (!session.isActive()) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} inactive sessions`);
    }
    return cleaned;
  }

  /**
   * Destroy all sessions
   */
  static destroyAllSessions() {
    let count = 0;
    for (const [id, session] of this.sessions.entries()) {
      session.close();
      count++;
    }
    this.sessions.clear();
    console.log(`Destroyed all ${count} sessions`);
  }

  /**
   * Check if a session exists and is active
   * @param {string} id
   * @returns {boolean}
   */
  static hasActiveSession(id) {
    return this.getSession(id) !== undefined;
  }

  /**
   * Get session statistics
   * @returns {Object}
   */
  static getStats() {
    const allSessions = this.getAllSessions();
    return {
      total: allSessions.length,
      active: allSessions.filter(s => s.isActive).length,
      inactive: allSessions.filter(s => !s.isActive).length,
      sessions: allSessions
    };
  }
}