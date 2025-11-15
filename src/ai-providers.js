import OpenAI from 'openai';
import { Groq } from 'groq-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ollama from 'ollama';
import contextCache from '../../scripts/context-hash-cache.mjs';

/**
 * Unified AI Provider Manager
 * Handles all AI provider integrations with consistent interface
 */
class AIProviderManager {
  constructor(options = {}) {
    this.providers = new Map();
    this.context = options.systemContext || this.loadProjectContext();
    this.initializeProviders();
  }

  /**
   * Load project context using hash cache for efficiency
   */
  loadProjectContext() {
    const context = contextCache.getContext();
    console.log(`🧠 AIProviderManager loaded context (${context.split('\n').length} lines)`);
    return context;
  }

  /**
   * Initialize all available AI providers
   */
  initializeProviders() {
    console.log('DEBUG: Starting provider initialization...');
    // OpenAI
    if (
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY !== 'your_api_key_here'
    ) {
      try {
        this.providers.set(
          'openai',
          new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          })
        );
        console.log('DEBUG: OpenAI provider initialized successfully');
      } catch (error) {
        console.error('DEBUG: Failed to initialize OpenAI:', error.message);
      }
    } else {
      console.log('DEBUG: OpenAI API key not set or invalid');
    }

    // Groq
    if (
      process.env.GROQ_API_KEY &&
      process.env.GROQ_API_KEY !== 'your_api_key_here'
    ) {
      try {
        this.providers.set(
          'groq',
          new Groq({
            apiKey: process.env.GROQ_API_KEY,
          })
        );
        console.log('Groq provider initialized');
      } catch (error) {
        console.error('Failed to initialize Groq:', error.message);
      }
    }

    // Anthropic (Claude)
    if (
      process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_API_KEY !== 'your_api_key_here'
    ) {
      try {
        this.providers.set(
          'claude',
          new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          })
        );
        console.log('Claude provider initialized');
      } catch (error) {
        console.error('Failed to initialize Claude:', error.message);
      }
    }

    // Google Gemini
    if (
      process.env.GOOGLE_AI_API_KEY &&
      process.env.GOOGLE_AI_API_KEY !== 'your_api_key_here'
    ) {
      try {
        this.providers.set(
          'gemini',
          new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
        );
        console.log('Gemini provider initialized');
      } catch (error) {
        console.error('Failed to initialize Gemini:', error.message);
      }
    }

    // Ollama (always available for local models)
    try {
      this.providers.set('ollama', { client: null, available: true });
      console.log('DEBUG: Ollama provider initialized (local)');
    } catch (error) {
      console.error('DEBUG: Failed to initialize Ollama:', error.message);
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    const providers = [];

    if (this.providers.has('openai')) {
      providers.push({
        id: 'openai',
        name: 'OpenAI GPT-4',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        status: 'available',
      });
    }

    if (this.providers.has('groq')) {
      providers.push({
        id: 'groq',
        name: 'Groq Llama 3.1',
        models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
        status: 'available',
      });
    }

    if (this.providers.has('claude')) {
      providers.push({
        id: 'claude',
        name: 'Anthropic Claude',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        status: 'available',
      });
    }

    if (this.providers.has('gemini')) {
      providers.push({
        id: 'gemini',
        name: 'Google Gemini',
        models: ['gemini-pro', 'gemini-pro-vision'],
        status: 'available',
      });
    }

    if (this.providers.has('ollama')) {
      providers.push({
        id: 'ollama',
        name: 'Ollama Local',
        models: ['llama2', 'codellama', 'mistral', 'vicuna'],
        status: 'available',
      });
    }

    return providers;
  }

  /**
   * Generate completion using specified provider
   * @param {string} provider - Provider ID
   * @param {object} options - Generation options
   */
  async generateCompletion(provider, options = {}) {
    const {
      messages,
      model,
      temperature = 0.7,
      maxTokens = 1000,
      stream = false,
      onToken,
    } = options;

    if (!this.providers.has(provider)) {
      throw new Error(`Provider ${provider} not available`);
    }

    const providerInstance = this.providers.get(provider);

    try {
      switch (provider) {
      case 'openai':
        return await this.generateOpenAI(providerInstance, {
          messages,
          model,
          temperature,
          maxTokens,
          stream,
          onToken,
        });

      case 'groq':
        return await this.generateGroq(providerInstance, {
          messages,
          model,
          temperature,
          maxTokens,
          stream,
          onToken,
        });

      case 'claude':
        return await this.generateClaude(providerInstance, {
          messages,
          model,
          temperature,
          maxTokens,
          stream,
          onToken,
        });

      case 'gemini':
        return await this.generateGemini(providerInstance, {
          messages,
          model,
          temperature,
          maxTokens,
          stream,
          onToken,
        });

      case 'ollama':
        return await this.generateOllama(providerInstance, {
          messages,
          model,
          temperature,
          maxTokens,
          stream,
          onToken,
        });

      default:
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error generating completion with ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Generate completion using OpenAI
   */
  async generateOpenAI(client, options) {
    const {
      messages,
      model = 'gpt-4',
      temperature,
      maxTokens,
      stream,
      onToken,
    } = options;

    // Inject project context into system message
    const contextInjectedMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return {
          ...msg,
          content: `[CONTEXT START]\n${this.context}\n[CONTEXT END]\n\n${msg.content}`
        };
      }
      return msg;
    });

    if (stream) {
      const completion = await client.chat.completions.create({
        model,
        messages: contextInjectedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let response = '';
      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content || '';
        response += token;
        onToken && onToken(token, false);
      }
      onToken && onToken('', true);
      return response;
    } else {
      const completion = await client.chat.completions.create({
        model,
        messages: contextInjectedMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    }
  }

  /**
   * Generate completion using Groq
   */
  async generateGroq(client, options) {
    const {
      messages,
      model = 'llama-3.1-70b-versatile',
      temperature,
      maxTokens,
      stream,
      onToken,
    } = options;

    // Inject project context into system message
    const contextInjectedMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return {
          ...msg,
          content: `[CONTEXT START]\n${this.context}\n[CONTEXT END]\n\n${msg.content}`
        };
      }
      return msg;
    });

    if (stream) {
      const completion = await client.chat.completions.create({
        messages: contextInjectedMessages,
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let response = '';
      for await (const chunk of completion) {
        const token = chunk.choices[0]?.delta?.content || '';
        response += token;
        onToken && onToken(token, false);
      }
      onToken && onToken('', true);
      return response;
    } else {
      const completion = await client.chat.completions.create({
        messages: contextInjectedMessages,
        model,
        temperature,
        max_tokens: maxTokens,
      });

      return completion.choices[0]?.message?.content || '';
    }
  }

  /**
   * Generate completion using Claude
   */
  async generateClaude(client, options) {
    const {
      messages,
      model = 'claude-3-sonnet',
      temperature,
      maxTokens,
      stream,
      onToken,
    } = options;

    // Convert messages to Claude format with context injection
    const systemMessage =
      `[CONTEXT START]\n${this.context}\n[CONTEXT END]\n\n${messages.find((m) => m.role === 'system')?.content || ''}`;
    const userMessages = messages.filter((m) => m.role !== 'system');

    if (stream) {
      const stream = await client.messages.stream({
        model,
        system: systemMessage,
        messages: userMessages,
        temperature,
        max_tokens: maxTokens,
      });

      let response = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          const token = chunk.delta.text;
          response += token;
          onToken && onToken(token, false);
        }
      }
      onToken && onToken('', true);
      return response;
    } else {
      const message = await client.messages.create({
        model,
        system: systemMessage,
        messages: userMessages,
        temperature,
        max_tokens: maxTokens,
      });

      return message.content[0]?.text || '';
    }
  }

  /**
   * Generate completion using Gemini
   */
  async generateGemini(client, options) {
    const {
      messages,
      model = 'gemini-pro',
      temperature,
      maxTokens,
      stream,
      onToken,
    } = options;

    const geminiModel = client.getGenerativeModel({ model });

    // Convert messages to Gemini format with context injection
    const contextInjectedMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.role === 'system' ?
        `[CONTEXT START]\n${this.context}\n[CONTEXT END]\n\n${msg.content}` :
        msg.content
      }],
    }));

    const history = contextInjectedMessages.slice(0, -1);
    const chat = geminiModel.startChat({ history });

    if (stream) {
      const result = await chat.sendMessageStream(
        contextInjectedMessages[contextInjectedMessages.length - 1].parts[0].text
      );

      let response = '';
      for await (const chunk of result.stream) {
        const token = chunk.text();
        response += token;
        onToken && onToken(token, false);
      }
      onToken && onToken('', true);
      return response;
    } else {
      const result = await chat.sendMessage(
        contextInjectedMessages[contextInjectedMessages.length - 1].parts[0].text
      );
      return result.response.text();
    }
  }

  /**
   * Generate completion using Ollama
   */
  async generateOllama(provider, options) {
    const {
      messages,
      model = 'llama2',
      temperature,
      maxTokens,
      stream,
      onToken,
    } = options;

    // Combine messages into single prompt for Ollama with context injection
    const prompt = `[CONTEXT START]\n${this.context}\n[CONTEXT END]\n\n${messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n')}`;

    if (stream) {
      const response = await ollama.generate({
        model,
        prompt,
        temperature,
        stream: true,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        const token = chunk.response || '';
        fullResponse += token;
        onToken && onToken(token, false);
      }
      onToken && onToken('', true);
      return fullResponse;
    } else {
      const response = await ollama.generate({
        model,
        prompt,
        temperature,
        options: { num_predict: maxTokens },
      });

      return response.response || '';
    }
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(provider) {
    return this.providers.has(provider);
  }

  /**
   * Get provider instance
   */
  getProvider(provider) {
    return this.providers.get(provider);
  }

  /**
   * Add a new provider dynamically
   */
  addProvider(providerId, providerConfig) {
    try {
      let providerInstance;
      switch (providerId) {
      case 'openai':
        providerInstance = new OpenAI({ apiKey: providerConfig.apiKey });
        break;
      case 'groq':
        providerInstance = new Groq({ apiKey: providerConfig.apiKey });
        break;
      case 'claude':
        providerInstance = new Anthropic({ apiKey: providerConfig.apiKey });
        break;
      case 'gemini':
        providerInstance = new GoogleGenerativeAI(providerConfig.apiKey);
        break;
      case 'ollama':
        providerInstance = { client: null, available: true };
        break;
      default:
        throw new Error(`Unsupported provider: ${providerId}`);
      }
      this.providers.set(providerId, providerInstance);
      console.log(`Provider ${providerId} added dynamically`);
      return true;
    } catch (error) {
      console.error(`Failed to add provider ${providerId}:`, error.message);
      return false;
    }
  }

  /**
   * Remove a provider dynamically
   */
  removeProvider(providerId) {
    if (this.providers.has(providerId)) {
      this.providers.delete(providerId);
      console.log(`Provider ${providerId} removed`);
      return true;
    }
    return false;
  }

  /**
   * Update provider configuration
   */
  updateProvider(providerId, providerConfig) {
    if (this.providers.has(providerId)) {
      this.removeProvider(providerId);
      return this.addProvider(providerId, providerConfig);
    }
    return false;
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    const status = {};
    for (const [id, provider] of this.providers) {
      status[id] = {
        available: true,
        models: this.getProviderModels(id),
        status: 'active',
      };
    }
    return status;
  }

  /**
   * Get models for a provider
   */
  getProviderModels(providerId) {
    const models = {
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      groq: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
      claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      gemini: ['gemini-pro', 'gemini-pro-vision'],
      ollama: ['llama2', 'codellama', 'mistral', 'vicuna'],
    };
    return models[providerId] || [];
  }

  /**
   * Test provider connectivity
   */
  async testProvider(providerId) {
    if (!this.providers.has(providerId)) {
      return { success: false, error: 'Provider not available' };
    }

    try {
      const testPrompt = 'Hello, this is a test message.';
      const response = await this.generateCompletion(providerId, {
        messages: [{ role: 'user', content: testPrompt }],
        model: this.getProviderModels(providerId)[0],
        maxTokens: 10,
      });
      return { success: true, response: response.substring(0, 50) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const aiProviderManager = new AIProviderManager();

export default aiProviderManager;
export { AIProviderManager };
