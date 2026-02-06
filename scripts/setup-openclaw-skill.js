#!/usr/bin/env node
/**
 * Install PayMe skill + plugin into OpenClaw and enable them.
 * Run from repo root: node scripts/setup-openclaw-skill.js
 * Requires OpenClaw to be installed; writes to ~/.openclaw/
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const openclawDir = join(process.env.HOME || process.env.USERPROFILE, '.openclaw');
const skillsDir = join(openclawDir, 'skills');
const extensionsDir = join(openclawDir, 'extensions');
const paymeSkillDest = join(skillsDir, 'payme');
const paymePluginDest = join(extensionsDir, 'payme');
const moltbookPluginDest = join(extensionsDir, 'moltbook');
const configPath = join(openclawDir, 'openclaw.json');
const paymeSkillSource = join(repoRoot, 'skills', 'payme');
const paymePluginSource = join(repoRoot, 'openclaw-payme');
const moltbookPluginSource = join(repoRoot, 'openclaw-moltbook');

if (!existsSync(paymeSkillSource)) {
  console.error('PayMe skill not found at', paymeSkillSource);
  process.exit(1);
}

// 1. Copy skills/payme to ~/.openclaw/skills/payme
mkdirSync(skillsDir, { recursive: true });
cpSync(paymeSkillSource, paymeSkillDest, { recursive: true });
console.log('Installed PayMe skill to', paymeSkillDest);

// 2. Copy openclaw-payme and openclaw-moltbook plugins
mkdirSync(extensionsDir, { recursive: true });
if (existsSync(paymePluginSource)) {
  cpSync(paymePluginSource, paymePluginDest, { recursive: true });
  console.log('Installed PayMe plugin to', paymePluginDest);
}
if (existsSync(moltbookPluginSource)) {
  cpSync(moltbookPluginSource, moltbookPluginDest, { recursive: true });
  console.log('Installed Moltbook plugin to', moltbookPluginDest);
}

// 3. Update openclaw.json: skill enabled, plugin enabled, tools allowed
let config = {};
if (existsSync(configPath)) {
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.warn('Could not parse existing openclaw.json:', e.message);
  }
}
config.skills = config.skills || {};
config.skills.entries = config.skills.entries || {};
config.skills.entries.payme = { ...config.skills.entries.payme, enabled: true };

config.plugins = config.plugins || {};
config.plugins.entries = config.plugins.entries || {};
config.plugins.entries.payme = {
  ...config.plugins.entries.payme,
  enabled: true,
  config: { baseUrl: 'https://backend-two-chi-56.vercel.app/api' },
};
config.plugins.entries.moltbook = { ...config.plugins.entries.moltbook, enabled: true };

// Allow PayMe + Moltbook tools for the main agent
const agentTools = ['payme_create_link', 'payme_pay_link', 'moltbook_post'];
config.agents = config.agents || {};
config.agents.list = config.agents.list || [{ id: 'main' }];
for (const agent of config.agents.list) {
  agent.tools = agent.tools || {};
  const allow = agent.tools.allow || [];
  for (const t of agentTools) {
    if (!allow.includes(t)) allow.push(t);
  }
  agent.tools.allow = allow;
}

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Updated', configPath, '→ PayMe + Moltbook plugins enabled, tools allowed');
console.log('Done. Restart the OpenClaw gateway so the plugins load.');
console.log('To post on Moltbook: add MOLTBOOK_API_KEY=your_key to ~/.openclaw/.env');
