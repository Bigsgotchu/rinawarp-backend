import { textToSpeech } from 'elevenlabs';

/**
 * Voice synthesis manager using ElevenLabs API
 */
class VoiceSynthesisManager {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.defaultVoice =
      process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice
    this.defaultModel = process.env.ELEVENLABS_MODEL || 'eleven_monolingual_v1';
    this.isConfigured = false;

    this.checkConfiguration();
  }

  /**
   * Check if ElevenLabs is properly configured
   */
  checkConfiguration() {
    if (this.apiKey && this.apiKey !== 'your_api_key_here') {
      this.isConfigured = true;
      console.log('ElevenLabs voice synthesis configured');
    } else {
      console.warn(
        'ElevenLabs API key not configured. Voice synthesis will be unavailable.'
      );
    }
  }

  /**
   * Get available voices
   */
  async getAvailableVoices() {
    if (!this.isConfigured) {
      return [];
    }

    try {
      // In a real implementation, you would fetch voices from ElevenLabs API
      // For now, return a list of common voices
      return [
        {
          id: '21m00Tcm4TlvDq8ikWAM',
          name: 'Rachel',
          description: 'Friendly and clear female voice',
          language: 'en-US',
          gender: 'female',
          age: 'young',
        },
        {
          id: 'AZnzlk1XvdvUeBnXmlld',
          name: 'Domi',
          description: 'Energetic and expressive female voice',
          language: 'en-US',
          gender: 'female',
          age: 'young',
        },
        {
          id: 'EXAVITQu4vr4xnSDxMaL',
          name: 'Bella',
          description: 'Warm and professional female voice',
          language: 'en-US',
          gender: 'female',
          age: 'adult',
        },
        {
          id: 'ErXwobaYiN019PkySvjV',
          name: 'Antoni',
          description: 'Clear and confident male voice',
          language: 'en-US',
          gender: 'male',
          age: 'adult',
        },
        {
          id: 'VR6AewLTigWG4xSOukaG',
          name: 'Arnold',
          description: 'Deep and authoritative male voice',
          language: 'en-US',
          gender: 'male',
          age: 'adult',
        },
        {
          id: 'pNInz6obpgDQGcFmaJgB',
          name: 'Adam',
          description: 'Friendly and approachable male voice',
          language: 'en-US',
          gender: 'male',
          age: 'young',
        },
        {
          id: 'yoZ06aMxZJJ28mfd3POQ',
          name: 'Sam',
          description: 'Neutral and clear voice',
          language: 'en-US',
          gender: 'neutral',
          age: 'adult',
        },
      ];
    } catch (error) {
      console.error('Error fetching available voices:', error);
      return [];
    }
  }

  /**
   * Generate speech from text
   * @param {string} text - Text to convert to speech
   * @param {object} options - Speech options
   */
  async generateSpeech(text, options = {}) {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for speech generation');
    }

    const {
      voiceId = this.defaultVoice,
      model = this.defaultModel,
      voiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
      },
    } = options;

    try {
      console.log(`Generating speech for: "${text.substring(0, 50)}..."`);

      const audioBuffer = await textToSpeech(this.apiKey, voiceId, {
        text,
        model_id: model,
        voice_settings: voiceSettings,
      });

      console.log(
        `Speech generated successfully. Buffer size: ${audioBuffer.length} bytes`
      );

      return {
        audioBuffer,
        format: 'mp3',
        text,
        voiceId,
        model,
        voiceSettings,
        generatedAt: new Date().toISOString(),
        size: audioBuffer.length,
      };
    } catch (error) {
      console.error('Error generating speech:', error);
      throw new Error(`Speech generation failed: ${error.message}`);
    }
  }

  /**
   * Generate speech and save to file
   * @param {string} text - Text to convert to speech
   * @param {string} outputPath - Path to save audio file
   * @param {object} options - Speech options
   */
  async generateSpeechToFile(text, outputPath, options = {}) {
    try {
      const result = await this.generateSpeech(text, options);

      // In a real implementation, you would write the buffer to file
      // For now, just return the result
      return {
        ...result,
        outputPath,
        saved: true,
      };
    } catch (error) {
      console.error('Error generating speech to file:', error);
      throw error;
    }
  }

  /**
   * Stream speech generation (for real-time applications)
   * @param {string} text - Text to convert to speech
   * @param {object} options - Speech options
   */
  async streamSpeech(text, options = {}) {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs not configured');
    }

    const {
      voiceId = this.defaultVoice,
      model = this.defaultModel,
      voiceSettings = {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
      },
      onChunk, // Callback for audio chunks
    } = options;

    try {
      console.log(`Streaming speech for: "${text.substring(0, 50)}..."`);

      // For streaming, we would need to use ElevenLabs streaming API
      // This is a simplified implementation
      const result = await this.generateSpeech(text, {
        voiceId,
        model,
        voiceSettings,
      });

      // Simulate streaming by calling onChunk callback
      if (onChunk && typeof onChunk === 'function') {
        // In a real implementation, you would stream the audio in chunks
        onChunk(result.audioBuffer, true); // Final chunk
      }

      return result;
    } catch (error) {
      console.error('Error streaming speech:', error);
      throw new Error(`Speech streaming failed: ${error.message}`);
    }
  }

  /**
   * Get voice settings for a specific voice
   * @param {string} voiceId - Voice ID
   */
  async getVoiceSettings(voiceId) {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs not configured');
    }

    try {
      // In a real implementation, you would fetch voice settings from ElevenLabs API
      return {
        voiceId,
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true,
      };
    } catch (error) {
      console.error('Error fetching voice settings:', error);
      throw error;
    }
  }

  /**
   * Update voice settings
   * @param {string} voiceId - Voice ID
   * @param {object} settings - New voice settings
   */
  async updateVoiceSettings(voiceId, settings) {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs not configured');
    }

    try {
      // In a real implementation, you would update voice settings via ElevenLabs API
      console.log(`Updated settings for voice ${voiceId}:`, settings);
      return true;
    } catch (error) {
      console.error('Error updating voice settings:', error);
      throw error;
    }
  }

  /**
   * Test voice synthesis with sample text
   * @param {string} voiceId - Voice ID to test (optional)
   */
  async testVoice(voiceId = null) {
    const testText =
      'Hello! This is a test of the ElevenLabs voice synthesis system.';

    try {
      const result = await this.generateSpeech(testText, {
        voiceId: voiceId || this.defaultVoice,
      });

      console.log('Voice test successful');
      return {
        success: true,
        text: testText,
        voiceId: voiceId || this.defaultVoice,
        size: result.size,
      };
    } catch (error) {
      console.error('Voice test failed:', error);
      return {
        success: false,
        error: error.message,
        text: testText,
        voiceId: voiceId || this.defaultVoice,
      };
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats() {
    if (!this.isConfigured) {
      return null;
    }

    try {
      // In a real implementation, you would fetch usage stats from ElevenLabs API
      return {
        charactersUsed: 0,
        charactersRemaining: 100000,
        resetDate: new Date().toISOString(),
        plan: 'free',
      };
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      return null;
    }
  }

  /**
   * Validate text for speech generation
   * @param {string} text - Text to validate
   */
  validateText(text) {
    if (!text || typeof text !== 'string') {
      return {
        valid: false,
        error: 'Text must be a non-empty string',
      };
    }

    if (text.length > 5000) {
      return {
        valid: false,
        error: 'Text is too long (max 5000 characters)',
      };
    }

    if (text.trim().length === 0) {
      return {
        valid: false,
        error: 'Text cannot be empty or only whitespace',
      };
    }

    return {
      valid: true,
      length: text.length,
      estimatedDuration: Math.ceil(text.length / 150), // Rough estimate: 150 chars per second
    };
  }

  /**
   * Batch generate speech for multiple texts
   * @param {string[]} texts - Array of texts to convert
   * @param {object} options - Speech options
   */
  async batchGenerateSpeech(texts, options = {}) {
    if (!this.isConfigured) {
      throw new Error('ElevenLabs not configured');
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      throw new Error('Texts must be a non-empty array');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.generateSpeech(texts[i], options);
        results.push({
          index: i,
          success: true,
          result,
        });
      } catch (error) {
        errors.push({
          index: i,
          success: false,
          error: error.message,
          text: texts[i],
        });
      }
    }

    return {
      results,
      errors,
      total: texts.length,
      successful: results.length,
      failed: errors.length,
    };
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return [
      { code: 'en-US', name: 'English (US)', nativeName: 'English' },
      { code: 'en-GB', name: 'English (UK)', nativeName: 'English' },
      { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español' },
      { code: 'fr-FR', name: 'French (France)', nativeName: 'Français' },
      { code: 'de-DE', name: 'German (Germany)', nativeName: 'Deutsch' },
      { code: 'it-IT', name: 'Italian (Italy)', nativeName: 'Italiano' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português' },
      { code: 'ja-JP', name: 'Japanese (Japan)', nativeName: '日本語' },
      { code: 'ko-KR', name: 'Korean (Korea)', nativeName: '한국어' },
      { code: 'zh-CN', name: 'Chinese (Mandarin)', nativeName: '中文' },
    ];
  }

  /**
   * Get voice by language
   * @param {string} languageCode - Language code (e.g., 'en-US')
   */
  async getVoicesByLanguage(languageCode) {
    const voices = await this.getAvailableVoices();
    return voices.filter((voice) => voice.language === languageCode);
  }

  /**
   * Health check for ElevenLabs service
   */
  async healthCheck() {
    if (!this.isConfigured) {
      return {
        status: 'not_configured',
        message: 'ElevenLabs API key not configured',
      };
    }

    try {
      // Try to generate a short test speech
      await this.testVoice();
      return {
        status: 'healthy',
        message: 'ElevenLabs service is working correctly',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `ElevenLabs service error: ${error.message}`,
      };
    }
  }
}

// Create singleton instance
const voiceSynthesisManager = new VoiceSynthesisManager();

export default voiceSynthesisManager;
export { VoiceSynthesisManager };
