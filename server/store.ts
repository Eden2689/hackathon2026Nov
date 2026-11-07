import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AppState } from './types.js';

const file = path.resolve('data/state.json');
const now = new Date();
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

const seed: AppState = {
  users: [
    { id: 'u-admin', name: 'Mia Maimon', email: 'admin@buildflow.dev', role: 'admin', avatar: 'MM' },
    { id: 'u-reviewer', name: 'Jordan Lee', email: 'jordan@buildflow.dev', role: 'reviewer', avatar: 'JL' },
    { id: 'u-client', name: 'Harborview PM', email: 'client@harborview.dev', role: 'client', avatar: 'HP' },
  ],
  agents: [
    { id: 'agent-quantity', name: 'Quantity Surveyor', description: 'Extracts quantities from blueprints and historical project data.', specialty: 'Material takeoffs', status: 'online', model: 'gpt-4.1', temperature: 0.2, tools: ['calendar', 'slack'], runs: 128, successRate: 98.4, lastActive: ago(2), color: '#34d399' },
    { id: 'agent-cost', name: 'Cost Analyst', description: 'Benchmarks supplier pricing and flags budget variance.', specialty: 'Cost intelligence', status: 'online', model: 'gpt-4.1-mini', temperature: 0.1, tools: ['gmail', 'teams'], runs: 94, successRate: 96.8, lastActive: ago(7), color: '#60a5fa' },
    { id: 'agent-review', name: 'Review Orchestrator', description: 'Routes estimates through four-eyes review and escalation policies.', specialty: 'Governance', status: 'online', model: 'claude-3.5-sonnet', temperature: 0, tools: ['slack', 'calendar'], runs: 61, successRate: 100, lastActive: ago(4), color: '#fbbf24' },
    { id: 'agent-client', name: 'Client Concierge', description: 'Turns internal task activity into clear client-facing updates.', specialty: 'Client communications', status: 'paused', model: 'gpt-4.1-mini', temperature: 0.4, tools: ['whatsapp', 'gmail'], runs: 47, successRate: 99.1, lastActive: ago(48), color: '#c084fc' },
  ],
  tasks: [
    { id: 'task-1042', title: 'Riverside Commons — concrete package', project: 'Riverside Commons', requester: 'Harborview PM', agentId: 'agent-quantity', status: 'running', progress: 68, createdAt: ago(21), updatedAt: ago(1), estimatedValue: 284500, source: 'riverside_level-03.pdf', materials: [{ name: 'Ready-mix concrete', quantity: 420, unit: 'yd³', confidence: 97 }, { name: 'Rebar #5', quantity: 18.4, unit: 'tons', confidence: 94 }, { name: 'Vapor barrier', quantity: 16800, unit: 'ft²', confidence: 91 }] },
    { id: 'task-1041', title: 'Northstar Offices — framing update', project: 'Northstar Offices', requester: 'Apex Build Co.', agentId: 'agent-cost', status: 'pending_review', progress: 100, createdAt: ago(137), updatedAt: ago(123), estimatedValue: 176800, source: 'northstar_revision-b.dwg', review: { requestedAt: ago(123), note: 'Variance is 8.6% above historical baseline. Reviewer approval required.' }, materials: [{ name: '2x6 SPF studs', quantity: 2460, unit: 'ea', confidence: 96 }, { name: 'OSB sheathing', quantity: 19200, unit: 'ft²', confidence: 89 }] },
    { id: 'task-1039', title: 'Willow Creek — finish materials', project: 'Willow Creek', requester: 'Greenline Contractors', agentId: 'agent-quantity', status: 'completed', progress: 100, createdAt: ago(310), updatedAt: ago(274), estimatedValue: 92300, source: 'willow_finish_schedule.xlsx', materials: [{ name: 'LVT flooring', quantity: 18400, unit: 'ft²', confidence: 98 }, { name: 'Acoustic ceiling tile', quantity: 8200, unit: 'ft²', confidence: 97 }] },
    { id: 'task-1038', title: 'Elm Street — permit set sync', project: 'Elm Street Lofts', requester: 'Urban Core', agentId: 'agent-review', status: 'queued', progress: 0, createdAt: ago(32), updatedAt: ago(32), estimatedValue: 0, source: 'elm_permit_set.pdf', materials: [] },
  ],
  activity: [
    { id: 'act-1', type: 'success', title: 'Estimate checkpoint completed', detail: 'Riverside Commons extracted 3 material classes', actor: 'Quantity Surveyor', timestamp: ago(1) },
    { id: 'act-2', type: 'warning', title: 'Review waiting for approval', detail: 'Northstar Offices has been idle for 2h 03m', actor: 'Review Orchestrator', timestamp: ago(3) },
    { id: 'act-3', type: 'info', title: 'Historical match found', detail: 'Willow Creek matched 8 comparable projects', actor: 'Cost Analyst', timestamp: ago(12) },
    { id: 'act-4', type: 'success', title: 'Client update delivered', detail: 'Harborview PM notified via WhatsApp', actor: 'Client Concierge', timestamp: ago(29) },
    { id: 'act-5', type: 'error', title: 'Supplier API rate limit', detail: 'Cost Analyst will retry in 4 minutes', actor: 'Cost Analyst', timestamp: ago(41) },
  ],
  messages: [
    { id: 'msg-1', role: 'assistant', content: 'Good morning, Mia. I’m monitoring 4 active workflows. Northstar Offices needs a second set of eyes before the estimate can be shared.', timestamp: ago(35) },
    { id: 'msg-2', role: 'user', content: 'What is driving the Northstar variance?', timestamp: ago(34) },
    { id: 'msg-3', role: 'assistant', content: 'The 8.6% variance is concentrated in structural lumber and sheathing. Three comparable office projects used a lower grade mix, so I recommend confirming the revised structural notes before approval.', timestamp: ago(33) },
  ],
  integrations: [
    { id: 'slack', name: 'Slack', description: 'Send internal alerts and review requests to approved channels.', category: 'messaging', status: 'connected', scopes: ['chat:write', 'channels:read'], lastSync: ago(4) },
    { id: 'whatsapp', name: 'WhatsApp Business', description: 'Deliver client-facing status updates using approved templates.', category: 'messaging', status: 'connected', scopes: ['messages:send'], lastSync: ago(29) },
    { id: 'gmail', name: 'Gmail', description: 'Send estimate summaries and receive supplier correspondence.', category: 'productivity', status: 'needs_review', scopes: ['gmail.send', 'gmail.readonly'] },
    { id: 'teams', name: 'Microsoft Teams', description: 'Post review cards to project collaboration spaces.', category: 'messaging', status: 'available', scopes: ['chat:write'] },
    { id: 'calendar', name: 'Google Calendar', description: 'Schedule review windows and escalation checkpoints.', category: 'productivity', status: 'connected', scopes: ['calendar.events'], lastSync: ago(8) },
  ],
  sessions: {},
};

function ensureStore() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(seed, null, 2));
}

export function readState(): AppState {
  ensureStore();
  return JSON.parse(fs.readFileSync(file, 'utf8')) as AppState;
}

export function writeState(state: AppState) {
  ensureStore();
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

export function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}
