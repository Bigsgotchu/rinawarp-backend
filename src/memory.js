import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, '../data/memory.json');

// Ensure data directory exists
const dataDir = path.dirname(MEMORY_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load user memory
export function loadMemory(userId) {
  if (!fs.existsSync(MEMORY_FILE)) {
    return {
      history: [],
      personality: {
        chatty: true,
        funny: true,
        flirty: false,
        professional: true,
        teaching: true,
        helpful: true,
      },
      preferences: {},
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    return (
      data[userId] || {
        history: [],
        personality: {
          chatty: true,
          funny: true,
          flirty: false,
          professional: true,
          teaching: true,
          helpful: true,
        },
        preferences: {},
        createdAt: Date.now(),
        lastActive: Date.now(),
      }
    );
  } catch (error) {
    console.error('Error loading memory:', error);
    return {
      history: [],
      personality: {
        chatty: true,
        funny: true,
        flirty: false,
        professional: true,
        teaching: true,
        helpful: true,
      },
      preferences: {},
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
  }
}

// Save memory
export function saveMemory(userId, memory) {
  try {
    let data = {};
    if (fs.existsSync(MEMORY_FILE)) {
      data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    }

    memory.lastActive = Date.now();
    data[userId] = memory;
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving memory:', error);
    return false;
  }
}

// Add message to memory
export function addToMemory(userId, role, text) {
  const memory = loadMemory(userId);

  // Add new message
  memory.history.push({
    role,
    text,
    timestamp: Date.now(),
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  });

  // Keep last 50 messages to prevent memory bloat
  if (memory.history.length > 50) {
    memory.history = memory.history.slice(-50);
  }

  saveMemory(userId, memory);
  return memory;
}

// Update personality trait
export function updatePersonality(userId, trait, value) {
  const memory = loadMemory(userId);
  memory.personality[trait] = value;
  saveMemory(userId, memory);
  return memory;
}

// Update user preferences
export function updatePreferences(userId, key, value) {
  const memory = loadMemory(userId);
  memory.preferences[key] = value;
  saveMemory(userId, memory);
  return memory;
}

// Get conversation context (last N messages)
export function getConversationContext(userId, maxMessages = 10) {
  const memory = loadMemory(userId);
  return memory.history.slice(-maxMessages);
}

// Get personality description for GPT
export function getPersonalityPrompt(userId) {
  const memory = loadMemory(userId);
  const { personality } = memory;

  const traits = [];
  if (personality.chatty) traits.push('chatty and conversational');
  if (personality.funny) traits.push('witty and humorous');
  if (personality.flirty) traits.push('playfully flirty');
  if (personality.professional) traits.push('professional and helpful');
  if (personality.teaching) traits.push('educational and explanatory');
  if (personality.helpful) traits.push('supportive and encouraging');

  const traitString = traits.join(', ');

  return `You are RinaWarp, a ${traitString} AI assistant. You remember past conversations and adapt to user preferences. You're knowledgeable about technology, coding, and general topics. Keep responses engaging and personalized.`;
}

// Clear conversation history
export function clearHistory(userId) {
  const memory = loadMemory(userId);
  memory.history = [];
  saveMemory(userId, memory);
  return memory;
}

// Get memory summary
export function getMemorySummary(userId) {
  const memory = loadMemory(userId);
  return {
    totalMessages: memory.history.length,
    personality: memory.personality,
    preferences: memory.preferences,
    lastActive: memory.lastActive,
    createdAt: memory.createdAt,
  };
}

// Search memory for specific topics
export function searchMemory(userId, query) {
  const memory = loadMemory(userId);
  const results = memory.history.filter((msg) =>
    msg.text.toLowerCase().includes(query.toLowerCase())
  );
  return results;
}
