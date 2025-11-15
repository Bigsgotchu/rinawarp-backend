/**
 * =====================================================
 *  AI Monitoring Integration Examples
 * =====================================================
 * Examples of how to integrate Sentry AI monitoring
 * into your RinaWarp AI routes and services
 * =====================================================
 */

import {
  initSentry,
  trackLLMCall,
  trackAgentConversation,
  trackToolCall,
  trackPromptPerformance,
  setAIUserContext,
  clearAIUserContext,
} from '../monitoring.js';

// Initialize monitoring
await initSentry();

// =====================================================
//  Example 1: Track Ollama LLM Calls
// =====================================================

async function exampleOllamaCall(userPrompt, userId) {
  const startTime = Date.now();
  
  try {
    // Set user context for this AI interaction
    setAIUserContext({
      id: userId,
      email: 'user@example.com',
      tier: 'pro',
      metadata: { source: 'terminal' }
    });

    // Make the Ollama API call
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:70b',
        prompt: userPrompt,
        stream: false,
      }),
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Track the LLM call in Sentry
    trackLLMCall({
      model: 'llama3.1:70b',
      provider: 'ollama',
      tokens: data.eval_count || 0,
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: (data.eval_count || 0) - (data.prompt_eval_count || 0),
      latency,
      cost: 0, // Ollama is free/local
      userId,
      conversationId: 'conv-123',
      success: true,
    });

    return data.response;

  } catch (error) {
    const latency = Date.now() - startTime;

    // Track failed LLM call
    trackLLMCall({
      model: 'llama3.1:70b',
      provider: 'ollama',
      tokens: 0,
      latency,
      cost: 0,
      userId,
      success: false,
      error: error.message,
    });

    throw error;
  } finally {
    clearAIUserContext();
  }
}

// =====================================================
//  Example 2: Track OpenAI/Anthropic Calls
// =====================================================

async function exampleOpenAICall(messages, userId) {
  const startTime = Date.now();
  
  try {
    setAIUserContext({ id: userId, tier: 'enterprise' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
      }),
    });

    const data = await response.json();
    const latency = Date.now() - startTime;

    // Calculate cost (example rates)
    const promptCost = (data.usage.prompt_tokens / 1000) * 0.03;
    const completionCost = (data.usage.completion_tokens / 1000) * 0.06;
    const totalCost = promptCost + completionCost;

    trackLLMCall({
      model: 'gpt-4',
      provider: 'openai',
      tokens: data.usage.total_tokens,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      latency,
      cost: totalCost,
      userId,
      conversationId: 'conv-456',
      success: true,
    });

    return data.choices[0].message.content;

  } catch (error) {
    trackLLMCall({
      model: 'gpt-4',
      provider: 'openai',
      latency: Date.now() - startTime,
      userId,
      success: false,
      error: error.message,
    });
    throw error;
  } finally {
    clearAIUserContext();
  }
}

// =====================================================
//  Example 3: Track Agent Conversations
// =====================================================

async function exampleAgentConversation(userId) {
  const conversationId = `conv-${Date.now()}`;
  const startTime = Date.now();
  const toolsUsed = [];
  let totalTokens = 0;
  let totalCost = 0;
  let messageCount = 0;

  try {
    setAIUserContext({ id: userId, tier: 'pro' });

    // Simulate agent conversation with multiple turns
    for (let i = 0; i < 3; i++) {
      messageCount++;
      
      // Track tool usage
      const toolResult = await exampleToolCall('search_files', 'RinaAgent');
      toolsUsed.push('search_files');
      
      // Make LLM call
      const llmResult = await exampleOllamaCall('Continue conversation', userId);
      totalTokens += 150; // Example
      totalCost += 0; // Ollama is free
    }

    const duration = Date.now() - startTime;

    // Track the complete conversation
    trackAgentConversation({
      agentName: 'RinaAgent',
      conversationId,
      userId,
      messageCount,
      toolsUsed,
      totalTokens,
      totalCost,
      duration,
      outcome: 'success',
    });

    return { success: true, conversationId };

  } catch (error) {
    trackAgentConversation({
      agentName: 'RinaAgent',
      conversationId,
      userId,
      messageCount,
      toolsUsed,
      totalTokens,
      totalCost,
      duration: Date.now() - startTime,
      outcome: 'failure',
    });
    throw error;
  } finally {
    clearAIUserContext();
  }
}

// =====================================================
//  Example 4: Track Tool/Function Calls
// =====================================================

async function exampleToolCall(toolName, agentName) {
  const startTime = Date.now();
  const input = { query: 'search term', path: '/workspace' };

  try {
    // Simulate tool execution
    const output = await executeToolLogic(input);
    const latency = Date.now() - startTime;

    trackToolCall({
      toolName,
      agentName,
      input,
      output,
      latency,
      success: true,
    });

    return output;

  } catch (error) {
    trackToolCall({
      toolName,
      agentName,
      input,
      output: {},
      latency: Date.now() - startTime,
      success: false,
      error: error.message,
    });
    throw error;
  }
}

async function executeToolLogic(input) {
  // Simulate tool execution
  await new Promise(resolve => setTimeout(resolve, 100));
  return { results: ['file1.js', 'file2.js'] };
}

// =====================================================
//  Example 5: Track Prompt Performance
// =====================================================

async function examplePromptTracking(promptId, userInput) {
  const startTime = Date.now();

  try {
    const response = await exampleOllamaCall(userInput, 'user-123');
    const latency = Date.now() - startTime;

    // Track prompt performance with custom metrics
    trackPromptPerformance({
      promptId,
      promptVersion: 'v2.1',
      model: 'llama3.1:70b',
      tokens: 150,
      latency,
      cost: 0,
      metrics: {
        accuracy: 0.95,
        relevance: 0.92,
        coherence: 0.88,
        userSatisfaction: 4.5,
      },
    });

    return response;
  } catch (error) {
    console.error('Prompt execution failed:', error);
    throw error;
  }
}

// =====================================================
//  Example 6: Integration in Express Route
// =====================================================

export function setupAIMonitoringRoute(app) {
  app.post('/api/ai/chat', async (req, res) => {
    const { message, userId, conversationId } = req.body;
    const startTime = Date.now();

    try {
      // Set user context
      setAIUserContext({
        id: userId,
        email: req.user?.email,
        tier: req.user?.tier || 'free',
      });

      // Make LLM call with monitoring
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.1:70b',
          prompt: message,
          stream: false,
        }),
      });

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Track the call
      trackLLMCall({
        model: 'llama3.1:70b',
        provider: 'ollama',
        tokens: data.eval_count || 0,
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: (data.eval_count || 0) - (data.prompt_eval_count || 0),
        latency,
        cost: 0,
        userId,
        conversationId,
        success: true,
      });

      res.json({
        ok: true,
        response: data.response,
        tokens: data.eval_count,
        latency,
      });

    } catch (error) {
      // Track failed call
      trackLLMCall({
        model: 'llama3.1:70b',
        provider: 'ollama',
        latency: Date.now() - startTime,
        userId,
        conversationId,
        success: false,
        error: error.message,
      });

      res.status(500).json({
        ok: false,
        error: 'AI request failed',
      });
    } finally {
      clearAIUserContext();
    }
  });
}

// =====================================================
//  Export Examples
// =====================================================

export {
  exampleOllamaCall,
  exampleOpenAICall,
  exampleAgentConversation,
  exampleToolCall,
  examplePromptTracking,
};
