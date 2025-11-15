const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const { ElevenLabs } = require('elevenlabs');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

require('dotenv').config();

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// Simple memory for learning
let sessionMemory = [];

async function generateAIResponse(prompt) {
  const messages = [
    {
      role: 'system',
      content: `
You are Rina, a professional AI assistant inside a terminal. 
Friendly, clever, helpful, and always consistent. 
You learn from user input during the session. 
Session memory: ${sessionMemory.join('\n')}
      `,
    },
    { role: 'user', content: prompt },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
  });

  const reply = completion.choices[0].message.content;
  sessionMemory.push(`User: ${prompt}`);
  sessionMemory.push(`Rina: ${reply}`);
  return reply;
}

// ElevenLabs TTS
async function speak(text) {
  const audioPath = path.join(__dirname, 'voice_output.mp3');

  try {
    const audio = await ElevenLabs.textToSpeech.speak({
      voice: VOICE_ID,
      input: text,
      model: 'eleven_monolingual_v1',
    });

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
    console.error('ElevenLabs TTS error:', error);
    throw error;
  }
}

// AI endpoint
app.post('/api/ai', async (req, res) => {
  const { prompt, enableVoice = false } = req.body;

  try {
    const reply = await generateAIResponse(prompt);

    if (enableVoice && process.env.ELEVENLABS_API_KEY) {
      try {
        // Don't await - let it run in background
        speak(reply).catch((err) => console.error('Voice error:', err));
      } catch (voiceError) {
        console.error('Voice generation error:', voiceError);
      }
    }

    res.json({ type: 'ai', response: reply, voiceEnabled: enableVoice });
  } catch (err) {
    console.error('AI Error:', err);
    res.status(500).json({ type: 'error', response: 'AI error' });
  }
});

// Voice endpoint
app.post('/api/voice', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    await speak(text);
    res.json({ success: true, message: 'Voice generated successfully' });
  } catch (error) {
    console.error('Voice generation error:', error);
    res.status(500).json({ error: 'Voice generation failed' });
  }
});

// Get conversation history
app.get('/api/conversation/history', (req, res) => {
  res.json({ history: sessionMemory });
});

// Clear conversation
app.post('/api/conversation/clear', (req, res) => {
  sessionMemory = [];
  res.json({ success: true, message: 'Conversation cleared' });
});

app.listen(3003, () =>
  console.log('🧜‍♀️ RinaWarp Agent backend running on port 3003')
);
