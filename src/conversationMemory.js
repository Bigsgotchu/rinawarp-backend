import lowdb from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
const adapter = new FileSync(
  path.join(__dirname, '../data/conversations.json')
);
const db = lowdb(adapter);

// Initialize with empty conversations
db.defaults({ conversations: [] }).write();

class ConversationMemory {
  constructor() {
    this.currentSession = null;
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  startNewSession() {
    this.sessionId = this.generateSessionId();
    this.currentSession = {
      id: this.sessionId,
      startTime: new Date().toISOString(),
      messages: [],
      userPreferences: {},
      learnedFacts: [],
    };
    return this.sessionId;
  }

  addMessage(userMessage, aiResponse, provider = 'unknown') {
    if (!this.currentSession) {
      this.startNewSession();
    }

    const message = {
      timestamp: new Date().toISOString(),
      user: userMessage,
      assistant: aiResponse,
      provider: provider,
    };

    this.currentSession.messages.push(message);

    // Keep only last 20 messages in memory for performance
    if (this.currentSession.messages.length > 20) {
      this.currentSession.messages = this.currentSession.messages.slice(-20);
    }

    return message;
  }

  getConversationHistory(limit = 10) {
    if (!this.currentSession) return [];
    return this.currentSession.messages.slice(-limit);
  }

  saveSession() {
    if (!this.currentSession) return;

    this.currentSession.endTime = new Date().toISOString();
    this.currentSession.messageCount = this.currentSession.messages.length;

    db.get('conversations').push(this.currentSession).write();

    console.log(`💾 Saved conversation session: ${this.sessionId}`);
  }

  loadRecentSessions(limit = 5) {
    return db
      .get('conversations')
      .orderBy('startTime', 'desc')
      .take(limit)
      .value();
  }

  getUserPreferences() {
    if (!this.currentSession) return {};
    return this.currentSession.userPreferences;
  }

  updateUserPreference(key, value) {
    if (!this.currentSession) {
      this.startNewSession();
    }
    this.currentSession.userPreferences[key] = value;
  }

  addLearnedFact(fact) {
    if (!this.currentSession) {
      this.startNewSession();
    }
    this.currentSession.learnedFacts.push({
      fact: fact,
      timestamp: new Date().toISOString(),
    });
  }

  getLearnedFacts() {
    if (!this.currentSession) return [];
    return this.currentSession.learnedFacts;
  }

  // Get conversation summary for context
  getContextSummary() {
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      return 'This is the start of our conversation.';
    }

    const recentMessages = this.getConversationHistory(5);
    const topics = this.extractTopics(recentMessages);

    return {
      messageCount: this.currentSession.messages.length,
      recentTopics: topics,
      userPreferences: this.getUserPreferences(),
      sessionDuration: this.getSessionDuration(),
    };
  }

  extractTopics(messages) {
    const topics = new Set();
    messages.forEach((msg) => {
      // Simple topic extraction based on keywords
      const text = (msg.user + ' ' + msg.assistant).toLowerCase();
      if (text.includes('code') || text.includes('programming'))
        topics.add('programming');
      if (text.includes('terminal') || text.includes('command'))
        topics.add('terminal');
      if (
        text.includes('system') ||
        text.includes('cpu') ||
        text.includes('ram')
      )
        topics.add('system monitoring');
      if (text.includes('theme') || text.includes('color'))
        topics.add('theming');
      if (text.includes('help') || text.includes('how')) topics.add('help');
    });
    return Array.from(topics);
  }

  getSessionDuration() {
    if (!this.currentSession) return 0;
    const start = new Date(this.currentSession.startTime);
    const now = new Date();
    return Math.round((now - start) / 1000 / 60); // minutes
  }
}

export default ConversationMemory;
