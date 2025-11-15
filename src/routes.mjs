import aiProviderManager from './ai-providers.js';
import memoryManager from './memory.js';
import projectAnalyzer from './project-analyzer.mjs';
import voiceSynthesisManager from './voice-synthesis.mjs';
import commandExecutor from './command-executor.mjs';
import {
  updateVoiceConfig,
  getVoiceConfig,
  getAvailableVoices,
  testVoice,
} from './aiVoice.js';

/**
 * API Route handlers for RinaWarp Terminal Pro
 */

// Intent parsing and execution endpoint
export async function handleIntent(req, res) {
  try {
    const { prompt, context, provider = 'groq' } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: 'Prompt is required',
        usage: 'POST /api/intent with body: { "prompt": "your intent here" }',
      });
    }

    console.log(`Processing intent: ${prompt.substring(0, 100)}...`);

    // Analyze the intent using AI
    const intentAnalysis = await analyzeIntent(prompt, provider);

    // Execute the intent
    const result = await executeIntent(intentAnalysis, context);

    // Store in memory
    memoryManager.addMessage(prompt, result.response, provider, {
      intent: intentAnalysis,
      execution: result,
    });

    res.json({
      type: 'intent_response',
      response: result.response,
      intent: intentAnalysis,
      execution: result,
      provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Intent processing error:', error);
    res.status(500).json({
      error: 'Failed to process intent',
      message: error.message,
    });
  }
}

// Deployment endpoint
export async function handleDeploy(req, res) {
  try {
    const { project, environment = 'development', options = {} } = req.body;

    if (!project) {
      return res.status(400).json({
        error: 'Project is required',
        usage: 'POST /api/deploy with body: { "project": "project-name" }',
      });
    }

    console.log(`Initiating deployment: ${project} to ${environment}`);

    // Analyze project for deployment readiness
    const projectInfo = await projectAnalyzer.analyzeProject(
      join(process.cwd(), project)
    );

    if (!projectInfo) {
      return res.status(404).json({
        error: 'Project not found',
        project,
      });
    }

    // Execute deployment
    const deploymentResult = await executeDeployment(
      project,
      environment,
      options
    );

    res.json({
      type: 'deployment_response',
      response: `Successfully deployed ${project} to ${environment}`,
      project: projectInfo,
      deployment: deploymentResult,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Deployment error:', error);
    res.status(500).json({
      error: 'Deployment failed',
      message: error.message,
    });
  }
}

// Context and project graph endpoint
export async function handleContext(req, res) {
  try {
    const {
      path,
      includeFiles = false,
      includeDependencies = false,
    } = req.query;

    const scanPath = path ? join(process.cwd(), path) : process.cwd();

    console.log(`Generating context for: ${scanPath}`);

    // Scan workspace
    const scanResults = await projectAnalyzer.scanWorkspace(scanPath);

    // Get project graph
    const projectGraph = projectAnalyzer.getProjectGraph();

    // Include file details if requested
    let fileDetails = null;
    if (includeFiles === 'true') {
      fileDetails = scanResults.files;
    }

    // Include dependency details if requested
    let dependencyDetails = null;
    if (includeDependencies === 'true') {
      dependencyDetails = scanResults.dependencies;
    }

    res.json({
      type: 'context_response',
      workspace: {
        path: scanPath,
        projects: projectGraph.projects,
        dependencies: dependencyDetails,
        metadata: scanResults.metadata,
      },
      files: fileDetails,
      recommendations: scanResults.recommendations,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Context generation error:', error);
    res.status(500).json({
      error: 'Failed to generate context',
      message: error.message,
    });
  }
}

// Text-to-speech endpoint
export async function handleSpeak(req, res) {
  try {
    const { text, voice, options = {} } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Text is required',
        usage: 'POST /api/speak with body: { "text": "text to speak" }',
      });
    }

    // Validate text
    const validation = voiceSynthesisManager.validateText(text);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
        validation,
      });
    }

    console.log(`Generating speech for: "${text.substring(0, 50)}..."`);

    // Generate speech
    const speechResult = await voiceSynthesisManager.generateSpeech(text, {
      voiceId: voice,
      ...options,
    });

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': speechResult.audioBuffer.length,
      'Cache-Control': 'public, max-age=3600',
    });

    res.send(speechResult.audioBuffer);
  } catch (error) {
    console.error('Speech generation error:', error);
    res.status(500).json({
      error: 'Speech generation failed',
      message: error.message,
    });
  }
}

// Memory management endpoints
export async function handleGetMemory(req, res) {
  try {
    const { conversationId, limit = 20 } = req.query;

    if (conversationId) {
      const messages = memoryManager.getConversationMessages(
        conversationId,
        parseInt(limit)
      );
      res.json({
        type: 'memory_response',
        conversationId,
        messages,
        timestamp: new Date().toISOString(),
      });
    } else {
      const history = memoryManager.getConversationHistory(parseInt(limit));
      res.json({
        type: 'memory_response',
        history,
        summary: memoryManager.getContextSummary(),
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Memory retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve memory',
      message: error.message,
    });
  }
}

export async function handlePostMemory(req, res) {
  try {
    const { content, type = 'conversation', metadata = {} } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required',
      });
    }

    memoryManager.setContext(`custom_${Date.now()}`, {
      content,
      type,
      metadata,
      timestamp: new Date().toISOString(),
    });

    res.json({
      type: 'memory_stored',
      id: `custom_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Memory storage error:', error);
    res.status(500).json({
      error: 'Failed to store memory',
      message: error.message,
    });
  }
}

// Command execution endpoint
export async function handleExecute(req, res) {
  try {
    const {
      command,
      args = [],
      workingDirectory = process.cwd(),
      useAlias = true,
    } = req.body;

    if (!command) {
      return res.status(400).json({
        error: 'Command is required',
        usage: 'POST /api/execute with body: { "command": "ls -la" }',
      });
    }

    console.log(`Executing command: ${command} ${args.join(' ')}`);

    // Expand aliases if enabled
    let finalCommand = command;
    if (useAlias) {
      finalCommand = commandExecutor.expandAlias(command) || command;
    }

    // Execute command
    const result = await commandExecutor.executeCommand(
      finalCommand,
      args,
      workingDirectory
    );

    // Store in history
    commandExecutor.addToHistory(command, args, result.success);

    res.json({
      type: 'execution_response',
      command: finalCommand,
      args,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Command execution error:', error);
    res.status(500).json({
      error: 'Command execution failed',
      message: error.message,
    });
  }
}

// AI chat endpoint with streaming support
export async function handleAIChat(req, res) {
  try {
    const { message, provider = 'groq', stream = false } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
      });
    }

    if (stream) {
      // Handle streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      try {
        await aiProviderManager.generateCompletion(provider, {
          messages: [{ role: 'user', content: message }],
          stream: true,
          onToken: (token, finished) => {
            res.write(JSON.stringify({ token, finished }) + '\n');
            if (finished) {
              res.end();
            }
          },
        });
      } catch (error) {
        res.write(
          JSON.stringify({ error: error.message, finished: true }) + '\n'
        );
        res.end();
      }
    } else {
      // Handle regular response
      const response = await aiProviderManager.generateCompletion(provider, {
        messages: [{ role: 'user', content: message }],
      });

      // Store in memory
      memoryManager.addMessage(message, response, provider);

      res.json({
        type: 'ai_response',
        response,
        provider,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({
      error: 'AI chat failed',
      message: error.message,
    });
  }
}

// Helper functions
async function analyzeIntent(prompt, provider) {
  // Use AI to analyze the intent
  const analysisPrompt = `
    Analyze the following user intent and categorize it:

    User prompt: "${prompt}"

    Please respond with a JSON object containing:
    {
      "category": "one of: code, deploy, analyze, search, system, general",
      "action": "specific action to take",
      "parameters": { "key": "value" pairs for the action },
      "confidence": 0-100,
      "requiresExecution": true/false
    }

    Respond only with valid JSON.
  `;

  try {
    const response = await aiProviderManager.generateCompletion(provider, {
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
    });

    return JSON.parse(response);
  } catch (error) {
    console.error('Intent analysis error:', error);
    return {
      category: 'general',
      action: 'respond',
      parameters: {},
      confidence: 50,
      requiresExecution: false,
    };
  }
}

async function executeIntent(intentAnalysis, context) {
  const { category, action, parameters } = intentAnalysis;

  switch (category) {
  case 'code':
    return await executeCodeAction(action, parameters, context);
  case 'deploy':
    return await executeDeployAction(action, parameters, context);
  case 'analyze':
    return await executeAnalyzeAction(action, parameters, context);
  case 'search':
    return await executeSearchAction(action, parameters, context);
  case 'system':
    return await executeSystemAction(action, parameters, context);
  default:
    return await executeGeneralAction(action, parameters, context);
  }
}

async function executeCodeAction(action, parameters, context) {
  // Implement code-related actions
  return {
    success: true,
    response: `Code action "${action}" executed`,
    details: parameters,
  };
}

async function executeDeployAction(action, parameters, context) {
  // Implement deployment actions
  return {
    success: true,
    response: `Deployment action "${action}" executed`,
    details: parameters,
  };
}

async function executeAnalyzeAction(action, parameters, context) {
  // Implement analysis actions
  const scanResults = await projectAnalyzer.scanWorkspace();
  return {
    success: true,
    response: `Analysis complete. Found ${scanResults.projects.length} projects.`,
    details: scanResults,
  };
}

async function executeSearchAction(action, parameters, context) {
  // Implement search actions
  const query = parameters.query || '';
  const results = memoryManager.searchMemory(query);
  return {
    success: true,
    response: `Search found ${results.length} results`,
    details: results,
  };
}

async function executeSystemAction(action, parameters, context) {
  // Implement system actions
  return {
    success: true,
    response: `System action "${action}" executed`,
    details: parameters,
  };
}

async function executeGeneralAction(action, parameters, context) {
  // Implement general actions
  return {
    success: true,
    response: `General action "${action}" executed`,
    details: parameters,
  };
}

async function executeDeployment(project, environment, options) {
  // Implement actual deployment logic
  return {
    success: true,
    environment,
    deployedAt: new Date().toISOString(),
    options,
  };
}

// AI Provider Management Endpoints
export async function handleGetProviders(req, res) {
  try {
    const providers = aiProviderManager.getAvailableProviders();
    res.json({
      type: 'providers_response',
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({
      error: 'Failed to get providers',
      message: error.message,
    });
  }
}

export async function handleAddProvider(req, res) {
  try {
    const { id, apiKey } = req.body;

    if (!id || !apiKey) {
      return res.status(400).json({
        error: 'Provider ID and API key are required',
      });
    }

    const success = aiProviderManager.addProvider(id, { apiKey });

    if (success) {
      res.json({
        type: 'provider_added',
        id,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        error: 'Failed to add provider',
      });
    }
  } catch (error) {
    console.error('Add provider error:', error);
    res.status(500).json({
      error: 'Failed to add provider',
      message: error.message,
    });
  }
}

export async function handleRemoveProvider(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Provider ID is required',
      });
    }

    const success = aiProviderManager.removeProvider(id);

    if (success) {
      res.json({
        type: 'provider_removed',
        id,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(400).json({
        error: 'Failed to remove provider',
      });
    }
  } catch (error) {
    console.error('Remove provider error:', error);
    res.status(500).json({
      error: 'Failed to remove provider',
      message: error.message,
    });
  }
}

export async function handleTestProvider(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Provider ID is required',
      });
    }

    const result = await aiProviderManager.testProvider(id);

    res.json({
      type: 'provider_test',
      id,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test provider error:', error);
    res.status(500).json({
      error: 'Failed to test provider',
      message: error.message,
    });
  }
}

// Voice Management Endpoints
export async function handleGetVoiceConfig(req, res) {
  try {
    const config = getVoiceConfig();
    res.json({
      type: 'voice_config',
      config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get voice config error:', error);
    res.status(500).json({
      error: 'Failed to get voice config',
      message: error.message,
    });
  }
}

export async function handleUpdateVoiceConfig(req, res) {
  try {
    const newConfig = req.body;

    if (!newConfig) {
      return res.status(400).json({
        error: 'Voice config is required',
      });
    }

    updateVoiceConfig(newConfig);

    res.json({
      type: 'voice_config_updated',
      config: getVoiceConfig(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Update voice config error:', error);
    res.status(500).json({
      error: 'Failed to update voice config',
      message: error.message,
    });
  }
}

export async function handleGetVoices(req, res) {
  try {
    const voices = getAvailableVoices();
    res.json({
      type: 'available_voices',
      voices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({
      error: 'Failed to get voices',
      message: error.message,
    });
  }
}

export async function handleTestVoice(req, res) {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId) {
      return res.status(400).json({
        error: 'Voice ID is required',
      });
    }

    const result = await testVoice(voiceId, text);

    res.json({
      type: 'voice_test',
      voiceId,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Test voice error:', error);
    res.status(500).json({
      error: 'Failed to test voice',
      message: error.message,
    });
  }
}
