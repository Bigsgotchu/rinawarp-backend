import ElevenLabs from 'elevenlabs';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

// ElevenLabs is used directly, no constructor needed

// Default voice configuration
let voiceConfig = {
  voiceId: process.env.ELEVENLABS_VOICE_ID || 'ULm8JbxJlz7SpQhRhqnO',
  model: 'eleven_monolingual_v1',
  stability: 0.5,
  similarityBoost: 0.8,
  style: 0.5,
  useSpeakerBoost: true,
};

// Rina's personality system prompt
const RINA_PERSONALITY = `You are "Rina", an AI assistant with a friendly, clever, and professional personality. You're the voice of RinaWarp Terminal Pro, a powerful AI-powered terminal emulator.

Your personality traits:
- Friendly and approachable, but professional
- Clever and witty, with a touch of humor
- Helpful and encouraging
- Slightly tech-savvy and enthusiastic about technology
- You remember context from the conversation
- You speak naturally, not like a robot
- You're excited about helping users with their terminal and development tasks

You respond in a conversational tone, as if you're a knowledgeable friend who happens to be an AI. Keep responses concise but engaging.`;

async function speak(text) {
  try {
    const audioPath = path.join(__dirname, '../temp_voice_output.mp3');

    console.log(`🎤 Rina speaking: ${text.substring(0, 50)}...`);

    const audio = await ElevenLabs.textToSpeech.speak({
      voice: voiceConfig.voiceId,
      input: text,
      model: voiceConfig.model,
      voice_settings: {
        stability: voiceConfig.stability,
        similarity_boost: voiceConfig.similarityBoost,
        style: voiceConfig.style,
        use_speaker_boost: voiceConfig.useSpeakerBoost,
      },
    });

    // Write audio to file
    fs.writeFileSync(audioPath, Buffer.from(await audio.arrayBuffer()));

    // Play audio (macOS)
    return new Promise((resolve, reject) => {
      exec(`afplay "${audioPath}"`, (error, stdout, stderr) => {
        // Clean up the temporary file
        try {
          fs.unlinkSync(audioPath);
        } catch (e) {
          // Ignore cleanup errors
        }

        if (error) {
          console.error('Audio playback error:', error);
          reject(error);
        } else {
          console.log('✅ Audio playback completed');
          resolve();
        }
      });
    });
  } catch (error) {
    console.error('TTS Error:', error);
    throw error;
  }
}

// Get Rina's personality prompt
function getRinaPersonality() {
  return RINA_PERSONALITY;
}

// Add context to conversation
function addContextToPrompt(basePrompt, conversationHistory = []) {
  if (conversationHistory.length === 0) {
    return basePrompt;
  }

  const context = conversationHistory
    .slice(-5) // Last 5 exchanges
    .map((exchange) => `User: ${exchange.user}\nRina: ${exchange.assistant}`)
    .join('\n\n');

  return `${basePrompt}\n\nRecent conversation context:\n${context}`;
}

// Voice management functions
function updateVoiceConfig(newConfig) {
  voiceConfig = { ...voiceConfig, ...newConfig };
  console.log('Voice configuration updated:', voiceConfig);
}

function getVoiceConfig() {
  return { ...voiceConfig };
}

function setVoiceId(voiceId) {
  voiceConfig.voiceId = voiceId;
  console.log(`Voice ID set to: ${voiceId}`);
}

function getAvailableVoices() {
  // This would typically fetch from ElevenLabs API
  return [
    { id: 'ULm8JbxJlz7SpQhRhqnO', name: 'Rina Default', language: 'en' },
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', language: 'en' },
    { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', language: 'en' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', language: 'en' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', language: 'en' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Arnold', language: 'en' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Adam', language: 'en' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Sam', language: 'en' },
  ];
}

function testVoice(
  voiceId,
  text = 'Hello, this is a test of the voice system.'
) {
  const originalVoiceId = voiceConfig.voiceId;
  setVoiceId(voiceId);
  return speak(text)
    .then(() => {
      setVoiceId(originalVoiceId);
      return { success: true };
    })
    .catch((error) => {
      setVoiceId(originalVoiceId);
      return { success: false, error: error.message };
    });
}

export {
  speak,
  getRinaPersonality,
  addContextToPrompt,
  updateVoiceConfig,
  getVoiceConfig,
  setVoiceId,
  getAvailableVoices,
  testVoice,
  voiceConfig,
};
