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
const configPath = join(openclawDir, 'openclaw.json');
const paymeSkillSource = join(repoRoot, 'skills', 'payme');
const paymePluginSource = join(repoRoot, 'openclaw-payme');

if (!existsSync(paymeSkillSource)) {
  console.error('PayMe skill not found at', paymeSkillSource);
  process.exit(1);
}

// 1. Copy skills/payme to ~/.openclaw/skills/payme
mkdirSync(skillsDir, { recursive: true });
cpSync(paymeSkillSource, paymeSkillDest, { recursive: true });
console.log('Installed PayMe skill to', paymeSkillDest);

// 2. Copy openclaw-payme plugin to ~/.openclaw/extensions/payme
if (existsSync(paymePluginSource)) {
  mkdirSync(extensionsDir, { recursive: true });
  cpSync(paymePluginSource, paymePluginDest, { recursive: true });
  console.log('Installed PayMe plugin to', paymePluginDest);
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

// Allow PayMe tools for the main agent (so the LLM can call them)
const paymeTools = ['payme_create_link', 'payme_pay_link'];
config.agents = config.agents || {};
config.agents.list = config.agents.list || [{ id: 'main' }];
for (const agent of config.agents.list) {
  agent.tools = agent.tools || {};
  const allow = agent.tools.allow || [];
  for (const t of paymeTools) {
    if (!allow.includes(t)) allow.push(t);
  }
  agent.tools.allow = allow;
}

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('Updated', configPath, '→ PayMe skill + plugin enabled, tools allowed');
console.log('Done. Restart the OpenClaw gateway so the plugin and tools load.');
