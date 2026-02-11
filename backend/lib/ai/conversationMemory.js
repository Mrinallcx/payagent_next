/**
 * Conversation Memory
 *
 * Stores and retrieves chat history per agent for context in AI conversations.
 */
const crypto = require('crypto');
const { supabase } = require('../supabase');

// In-memory fallback
const memoryConversations = {};

/**
 * Save a chat message
 *
 * @param {string} agentId - Agent ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 */
async function saveMessage(agentId, role, content) {
  const id = 'msg_' + crypto.randomBytes(12).toString('hex');

  if (supabase) {
    try {
      await supabase.from('conversations').insert({
        id,
        agent_id: agentId,
        role,
        content
      });
    } catch (err) {
      console.error('Save message error:', err);
    }
    return;
  }

  // Memory fallback
  if (!memoryConversations[agentId]) {
    memoryConversations[agentId] = [];
  }
  memoryConversations[agentId].push({
    id,
    agent_id: agentId,
    role,
    content,
    created_at: new Date().toISOString()
  });

  // Keep only last 50 messages in memory
  if (memoryConversations[agentId].length > 50) {
    memoryConversations[agentId] = memoryConversations[agentId].slice(-50);
  }
}

/**
 * Get conversation history for an agent
 *
 * @param {string} agentId - Agent ID
 * @param {number} limit - Max messages to return (default 10)
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
async function getHistory(agentId, limit = 10) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('role, content, created_at')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Reverse to get chronological order
      return (data || []).reverse();
    } catch (err) {
      console.error('Get history error:', err);
      return [];
    }
  }

  // Memory fallback
  const messages = memoryConversations[agentId] || [];
  return messages.slice(-limit).map(m => ({
    role: m.role,
    content: m.content,
    created_at: m.created_at
  }));
}

/**
 * Clear conversation history for an agent
 *
 * @param {string} agentId - Agent ID
 */
async function clearHistory(agentId) {
  if (supabase) {
    try {
      await supabase
        .from('conversations')
        .delete()
        .eq('agent_id', agentId);
    } catch (err) {
      console.error('Clear history error:', err);
    }
    return;
  }

  delete memoryConversations[agentId];
}

module.exports = { saveMessage, getHistory, clearHistory };
