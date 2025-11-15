import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Environment-based configuration manager
 */
class ConfigurationManager {
  constructor() {
    this.config = {};
    this.loadConfiguration();
  }

  /**
   * Load configuration from environment and config files
   */
  loadConfiguration() {
    // Default configuration
    this.config = {
      // Server settings
      server: {
        port: 3001,
        host: 'localhost',
        environment: 'development',
        corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
        rateLimit: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 100,
        },
      },

      // Security settings
      security: {
        helmet: {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ['\'self\''],
              styleSrc: ['\'self\'', '\'unsafe-inline\''],
              scriptSrc: ['\'self\''],
              imgSrc: ['\'self\'', 'data:', 'https:'],
            },
          },
          crossOriginEmbedderPolicy: false,
        },
        sessionSecret:
          process.env.SESSION_SECRET || 'fallback-secret-change-in-production',
      },

      // AI Provider settings
      ai: {
        defaultProvider: 'groq',
        providers: {
          openai: {
            enabled: false,
            apiKey: null,
            baseURL: 'https://api.openai.com/v1',
            models: {
              default: 'gpt-4',
              available: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            },
          },
          groq: {
            enabled: false,
            apiKey: null,
            baseURL: 'https://api.groq.com',
            models: {
              default: 'llama-3.1-70b-versatile',
              available: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant'],
            },
          },
          claude: {
            enabled: false,
            apiKey: null,
            baseURL: 'https://api.anthropic.com',
            models: {
              default: 'claude-3-sonnet',
              available: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            },
          },
          gemini: {
            enabled: false,
            apiKey: null,
            baseURL: 'https://generativelanguage.googleapis.com',
            models: {
              default: 'gemini-pro',
              available: ['gemini-pro', 'gemini-pro-vision'],
            },
          },
          ollama: {
            enabled: true,
            baseURL: 'http://localhost:11434',
            models: {
              default: 'llama2',
              available: ['llama2', 'codellama', 'mistral', 'vicuna'],
            },
          },
        },
        settings: {
          temperature: 0.7,
          maxTokens: 1000,
          timeout: 30000,
        },
      },

      // Voice synthesis settings
      voice: {
        elevenlabs: {
          enabled: false,
          apiKey: null,
          defaultVoice: '21m00Tcm4TlvDq8ikWAM',
          defaultModel: 'eleven_monolingual_v1',
          settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true,
          },
        },
      },

      // Memory settings
      memory: {
        maxConversations: 100,
        maxMessagesPerConversation: 50,
        autoSave: true,
        retentionDays: 30,
        memoryFile: '.rinawarp/memory.json',
      },

      // Command execution settings
      commands: {
        enableAliasExpansion: true,
        maxHistorySize: 1000,
        allowSystemCommands: true,
        timeout: 30000,
        aliasesFile: '.rinawarp/aliases.json',
        historyFile: '.rinawarp/command-history.json',
      },

      // Project analysis settings
      analysis: {
        scanDepth: 3,
        excludePatterns: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '*.log',
          '.DS_Store',
        ],
        includePatterns: [
          '**/*.js',
          '**/*.ts',
          '**/*.py',
          '**/*.java',
          '**/*.json',
          '**/*.md',
          '**/*.html',
          '**/*.css',
        ],
      },

      // Logging settings
      logging: {
        level: 'info',
        file: 'logs/rinawarp-terminal.log',
        maxSize: '10m',
        maxFiles: 5,
      },

      // WebSocket settings
      websocket: {
        heartbeatInterval: 30000,
        maxConnections: 1000,
        messageQueueSize: 100,
      },
    };

    // Override with environment variables
    this.loadFromEnvironment();

    // Override with config file if it exists
    this.loadFromConfigFile();

    // Validate configuration
    this.validateConfiguration();

    // Log security settings for debugging
    console.log(
      `[CONFIG] Session secret loaded: ${this.config.security.sessionSecret.substring(0, 10)}...`
    );
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    // Server settings
    if (process.env.PORT) {
      this.config.server.port = parseInt(process.env.PORT);
    }
    if (process.env.HOST) {
      this.config.server.host = process.env.HOST;
    }
    if (process.env.NODE_ENV) {
      this.config.server.environment = process.env.NODE_ENV;
    }
    if (process.env.CORS_ORIGINS) {
      this.config.server.corsOrigins = process.env.CORS_ORIGINS.split(',');
    }

    // AI Provider API keys and settings
    if (process.env.OPENAI_API_KEY) {
      this.config.ai.providers.openai.enabled = true;
      this.config.ai.providers.openai.apiKey = process.env.OPENAI_API_KEY;
    }
    if (process.env.GROQ_API_KEY) {
      this.config.ai.providers.groq.enabled = true;
      this.config.ai.providers.groq.apiKey = process.env.GROQ_API_KEY;
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.config.ai.providers.claude.enabled = true;
      this.config.ai.providers.claude.apiKey = process.env.ANTHROPIC_API_KEY;
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      this.config.ai.providers.gemini.enabled = true;
      this.config.ai.providers.gemini.apiKey = process.env.GOOGLE_AI_API_KEY;
    }
    if (process.env.OLLAMA_BASE_URL) {
      this.config.ai.providers.ollama.baseURL = process.env.OLLAMA_BASE_URL;
    }

    // Voice synthesis settings
    if (process.env.ELEVENLABS_API_KEY) {
      this.config.voice.elevenlabs.enabled = true;
      this.config.voice.elevenlabs.apiKey = process.env.ELEVENLABS_API_KEY;
    }
    if (process.env.ELEVENLABS_VOICE_ID) {
      this.config.voice.elevenlabs.defaultVoice =
        process.env.ELEVENLABS_VOICE_ID;
    }
    if (process.env.ELEVENLABS_MODEL) {
      this.config.voice.elevenlabs.defaultModel = process.env.ELEVENLABS_MODEL;
    }

    // Memory settings
    if (process.env.MEMORY_MAX_CONVERSATIONS) {
      this.config.memory.maxConversations = parseInt(
        process.env.MEMORY_MAX_CONVERSATIONS
      );
    }
    if (process.env.MEMORY_RETENTION_DAYS) {
      this.config.memory.retentionDays = parseInt(
        process.env.MEMORY_RETENTION_DAYS
      );
    }

    // Command settings
    if (process.env.COMMANDS_ALLOW_SYSTEM) {
      this.config.commands.allowSystemCommands =
        process.env.COMMANDS_ALLOW_SYSTEM === 'true';
    }

    // Logging settings
    if (process.env.LOG_LEVEL) {
      this.config.logging.level = process.env.LOG_LEVEL;
    }
  }

  /**
   * Load configuration from config file
   */
  loadFromConfigFile() {
    const configPaths = [
      join(process.cwd(), 'rinawarp-terminal.config.json'),
      join(process.cwd(), 'config', 'rinawarp-terminal.json'),
      join(dirname(dirname(__dirname)), 'config', 'rinawarp-terminal.json'),
    ];

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const fileContent = readFileSync(configPath, 'utf8');
          const fileConfig = JSON.parse(fileContent);

          // Deep merge configuration
          this.config = this.deepMerge(this.config, fileConfig);
          console.log(`Loaded configuration from: ${configPath}`);
          break;
        } catch (error) {
          console.error(`Error loading config file ${configPath}:`, error);
        }
      }
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const errors = [];

    // Validate server settings
    if (this.config.server.port < 1 || this.config.server.port > 65535) {
      errors.push('Invalid server port');
    }

    // Validate AI providers
    for (const [provider, config] of Object.entries(this.config.ai.providers)) {
      if (config.enabled && !config.apiKey && provider !== 'ollama') {
        console.warn(
          `AI provider ${provider} is enabled but no API key provided`
        );
      }
    }

    // Validate voice settings
    if (
      this.config.voice.elevenlabs.enabled &&
      !this.config.voice.elevenlabs.apiKey
    ) {
      errors.push('ElevenLabs is enabled but no API key provided');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot notation path (e.g., 'server.port')
   * @param {any} defaultValue - Default value if path not found
   */
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  /**
   * Set configuration value by path
   * @param {string} path - Dot notation path
   * @param {any} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    let current = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return this.config.server;
  }

  /**
   * Get AI provider configuration
   */
  getAIConfig() {
    return this.config.ai;
  }

  /**
   * Get voice synthesis configuration
   */
  getVoiceConfig() {
    return this.config.voice;
  }

  /**
   * Get memory configuration
   */
  getMemoryConfig() {
    return this.config.memory;
  }

  /**
   * Get command execution configuration
   */
  getCommandConfig() {
    return this.config.commands;
  }

  /**
   * Get security configuration
   */
  getSecurityConfig() {
    return this.config.security;
  }

  /**
   * Check if AI provider is enabled
   * @param {string} provider - Provider name
   */
  isProviderEnabled(provider) {
    return this.get(`ai.providers.${provider}.enabled`, false);
  }

  /**
   * Get enabled AI providers
   */
  getEnabledProviders() {
    const providers = [];

    for (const [name, config] of Object.entries(this.config.ai.providers)) {
      if (config.enabled) {
        providers.push({
          name,
          ...config,
        });
      }
    }

    return providers;
  }

  /**
   * Get default AI provider
   */
  getDefaultProvider() {
    const defaultProvider = this.config.ai.defaultProvider;

    if (this.isProviderEnabled(defaultProvider)) {
      return defaultProvider;
    }

    // Fallback to first enabled provider
    const enabledProviders = this.getEnabledProviders();
    return enabledProviders.length > 0 ? enabledProviders[0].name : null;
  }

  /**
   * Save current configuration to file
   * @param {string} filePath - Path to save configuration
   */
  async saveToFile(filePath = 'rinawarp-terminal.config.json') {
    try {
      const { writeFileSync } = await import('fs');
      writeFileSync(filePath, JSON.stringify(this.config, null, 2));
      console.log(`Configuration saved to: ${filePath}`);
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error);
      return false;
    }
  }

  /**
   * Load configuration from file
   * @param {string} filePath - Path to load configuration from
   */
  loadFromFile(filePath) {
    try {
      if (existsSync(filePath)) {
        const fileContent = readFileSync(filePath, 'utf8');
        const fileConfig = JSON.parse(fileContent);

        this.config = this.deepMerge(this.config, fileConfig);
        this.validateConfiguration();

        console.log(`Configuration loaded from: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error loading configuration from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   */
  resetToDefaults() {
    this.loadConfiguration();
  }

  /**
   * Get configuration summary for display
   */
  getSummary() {
    const enabledProviders = this.getEnabledProviders();
    const defaultProvider = this.getDefaultProvider();

    return {
      environment: this.config.server.environment,
      server: `${this.config.server.host}:${this.config.server.port}`,
      aiProviders: enabledProviders.map((p) => p.name),
      defaultProvider,
      voiceEnabled: this.config.voice.elevenlabs.enabled,
      memoryEnabled: true,
      commandsEnabled: this.config.commands.enableAliasExpansion,
    };
  }
}

// Create singleton instance
const configManager = new ConfigurationManager();

export default configManager;
export { ConfigurationManager };
