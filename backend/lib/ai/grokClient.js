/**
 * Grok 4 Fast Thinking Client
 *
 * Uses the openai npm package with xAI's compatible API endpoint.
 */
const OpenAI = require('openai');

let client = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is not set. Get your key from https://console.x.ai');
  }

  client = new OpenAI({
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });

  return client;
}

/**
 * Chat with Grok 4 Fast Thinking
 *
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @returns {Promise<string>} AI response content
 */
async function chatWithAgent(messages) {
  const openai = getClient();

  const completion = await openai.chat.completions.create({
    model: 'grok-3-fast',
    messages,
    temperature: 0.3,
    max_tokens: 1024,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI');
  }

  return content;
}

module.exports = { chatWithAgent };
