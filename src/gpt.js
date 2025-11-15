import fetch from 'node-fetch';
import {
  loadMemory,
  addToMemory,
  getPersonalityPrompt,
  getConversationContext,
} from './memory.js';

export async function generateGPTResponse(userId, prompt, provider = 'openai') {
  try {
    const memory = loadMemory(userId);
    const personalityPrompt = getPersonalityPrompt(userId);
    const context = getConversationContext(userId, 10);

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: personalityPrompt,
      },
      ...context,
      { role: 'user', content: prompt },
    ];

    // Choose API endpoint and model
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GROQ_API_KEY;
    const apiUrl =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';

    const model =
      provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-70b-versatile';

    if (!apiKey) {
      throw new Error(`${provider} API key not configured`);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorData}`
      );
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    // Add to memory
    addToMemory(userId, 'assistant', text);

    return {
      text,
      provider,
      model,
      tokens: data.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('GPT generation error:', error);
    throw error;
  }
}

export async function generateStreamingResponse(
  userId,
  prompt,
  provider = 'openai'
) {
  try {
    const memory = loadMemory(userId);
    const personalityPrompt = getPersonalityPrompt(userId);
    const context = getConversationContext(userId, 10);

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: personalityPrompt,
      },
      ...context,
      { role: 'user', content: prompt },
    ];

    // Choose API endpoint and model
    const apiKey =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.GROQ_API_KEY;
    const apiUrl =
      provider === 'openai'
        ? 'https://api.openai.com/v1/chat/completions'
        : 'https://api.groq.com/openai/v1/chat/completions';

    const model =
      provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.1-70b-versatile';

    if (!apiKey) {
      throw new Error(`${provider} API key not configured`);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorData}`
      );
    }

    return response.body;
  } catch (error) {
    console.error('GPT streaming error:', error);
    throw error;
  }
}
