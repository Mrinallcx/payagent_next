const crypto = require('crypto');
const { supabase } = require('./supabase');
const { isSafeUrl } = require('./urlSafety');
const { encryptSecret } = require('./crypto');

// In-memory fallback store
const memoryWebhooks = {};

/**
 * Register a new webhook for an agent
 * Security H1: Validates URL against SSRF before storing
 * Security H5: Stores AES-256-GCM encrypted secret in DB, returns raw secret only once
 */
async function registerWebhook(agentId, url, events) {
  // Security H1: Validate webhook URL before registration
  if (!await isSafeUrl(url)) {
    throw new Error('Invalid webhook URL. Must be HTTPS and resolve to a public IP address.');
  }

  const id = 'wh_' + crypto.randomBytes(12).toString('hex');
  const rawSecret = 'whsec_' + crypto.randomBytes(32).toString('hex');

  // Security H5/H3: Encrypt secret at rest (reversible for HMAC signing)
  const encryptedSecret = encryptSecret(rawSecret);

  const webhook = {
    id,
    agent_id: agentId,
    url,
    secret: encryptedSecret,
    events: events || ['payment.paid', 'payment.created'],
    active: true,
    failure_count: 0
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('webhooks')
      .insert(webhook)
      .select()
      .single();
    if (error) throw error;
    // Return raw secret only on creation (the only time the agent sees it)
    return { ...data, secret: rawSecret };
  }

  memoryWebhooks[id] = { ...webhook, created_at: new Date().toISOString() };
  // Return raw secret only on creation
  return { ...memoryWebhooks[id], secret: rawSecret };
}

/**
 * Get all webhooks for an agent
 */
async function getWebhooks(agentId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  return Object.values(memoryWebhooks).filter(w => w.agent_id === agentId);
}

/**
 * Get all active webhooks for a list of agent IDs subscribed to an event
 */
async function getWebhooksForEvent(agentIds, eventType) {
  if (supabase) {
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .in('agent_id', agentIds)
      .eq('active', true)
      .contains('events', [eventType]);
    if (error) throw error;
    return data || [];
  }

  return Object.values(memoryWebhooks).filter(
    w => agentIds.includes(w.agent_id) && w.active && w.events.includes(eventType)
  );
}

/**
 * Update a webhook
 */
async function updateWebhook(webhookId, agentId, updates) {
  const allowedFields = ['url', 'events', 'active'];
  const filtered = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  }

  // Security H1: Validate new URL if being updated
  if (filtered.url && !await isSafeUrl(filtered.url)) {
    throw new Error('Invalid webhook URL. Must be HTTPS and resolve to a public IP address.');
  }

  if (supabase) {
    const { data, error } = await supabase
      .from('webhooks')
      .update(filtered)
      .eq('id', webhookId)
      .eq('agent_id', agentId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error('Webhook not found');
    return data;
  }

  const webhook = memoryWebhooks[webhookId];
  if (!webhook || webhook.agent_id !== agentId) throw new Error('Webhook not found');
  Object.assign(webhook, filtered);
  return webhook;
}

/**
 * Delete a webhook
 */
async function deleteWebhook(webhookId, agentId) {
  if (supabase) {
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', webhookId)
      .eq('agent_id', agentId);
    if (error) throw error;
    return;
  }

  const webhook = memoryWebhooks[webhookId];
  if (!webhook || webhook.agent_id !== agentId) throw new Error('Webhook not found');
  delete memoryWebhooks[webhookId];
}

/**
 * Record webhook delivery success
 */
async function markWebhookSuccess(webhookId) {
  if (supabase) {
    await supabase
      .from('webhooks')
      .update({ last_success_at: new Date().toISOString(), failure_count: 0 })
      .eq('id', webhookId);
  } else if (memoryWebhooks[webhookId]) {
    memoryWebhooks[webhookId].last_success_at = new Date().toISOString();
    memoryWebhooks[webhookId].failure_count = 0;
  }
}

/**
 * Record webhook delivery failure
 */
async function markWebhookFailure(webhookId) {
  if (supabase) {
    const { data } = await supabase
      .from('webhooks')
      .select('failure_count')
      .eq('id', webhookId)
      .single();

    const newCount = (data?.failure_count || 0) + 1;
    const updates = {
      failure_count: newCount,
      last_failure_at: new Date().toISOString()
    };

    // Deactivate after 5 consecutive failures
    if (newCount >= 5) {
      updates.active = false;
    }

    await supabase.from('webhooks').update(updates).eq('id', webhookId);
  } else if (memoryWebhooks[webhookId]) {
    memoryWebhooks[webhookId].failure_count = (memoryWebhooks[webhookId].failure_count || 0) + 1;
    memoryWebhooks[webhookId].last_failure_at = new Date().toISOString();
    if (memoryWebhooks[webhookId].failure_count >= 5) {
      memoryWebhooks[webhookId].active = false;
    }
  }
}

module.exports = {
  registerWebhook,
  getWebhooks,
  getWebhooksForEvent,
  updateWebhook,
  deleteWebhook,
  markWebhookSuccess,
  markWebhookFailure
};
