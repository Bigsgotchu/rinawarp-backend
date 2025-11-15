import fetch from 'node-fetch';
import { addToMemory } from './memory.js';

const VOICE_ID = 'ULm8JbxJlz7SpQhRhqnO';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

export async function streamTTS(ws, text, userId = 'guest') {
  try {
    if (!ELEVENLABS_API_KEY) {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'TTS not configured - missing ELEVENLABS_API_KEY',
        })
      );
      return;
    }

    // Add RinaWarp's response to memory
    addToMemory(userId, 'assistant', text);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.85,
            style: 0.5,
            use_speaker_boost: true,
          },
          model_id: 'eleven_monolingual_v1',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `TTS streaming failed: ${response.status}`,
        })
      );
      return;
    }

    // Send text response first
    ws.send(
      JSON.stringify({
        type: 'text',
        message: text,
        timestamp: Date.now(),
      })
    );

    // Stream audio chunks
    const reader = response.body.getReader();
    let audioChunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Send audio chunk as binary data
      ws.send(value);
      audioChunkCount++;
    }

    console.log(`TTS streaming complete: ${audioChunkCount} chunks sent`);

    // Send completion signal
    ws.send(
      JSON.stringify({
        type: 'audio_complete',
        chunks: audioChunkCount,
        timestamp: Date.now(),
      })
    );
  } catch (error) {
    console.error('TTS streaming error:', error);
    ws.send(
      JSON.stringify({
        type: 'error',
        message: `TTS error: ${error.message}`,
      })
    );
  }
}

export async function generateTTS(text, voiceId = VOICE_ID) {
  try {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('TTS not configured - missing ELEVENLABS_API_KEY');
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.7,
            similarity_boost: 0.85,
            style: 0.5,
            use_speaker_boost: true,
          },
          model_id: 'eleven_monolingual_v1',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`TTS generation failed: ${response.status} ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error('TTS generation error:', error);
    throw error;
  }
}
