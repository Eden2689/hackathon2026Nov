import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { z } from 'zod';
import { id, readState, writeState } from './store.js';
import { executeApprovedTool } from './integrations.js';
import type { Activity, TaskStatus } from './types.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const attempts = new Map<string, { count: number; resetAt: number }>();
app.use('/api', (req, res, next) => {
  const key = req.ip ?? 'unknown';
  const current = attempts.get(key);
  const now = Date.now();
  if (!current || now > current.resetAt) attempts.set(key, { count: 1, resetAt: now + 60_000 });
  else current.count += 1;
  const state = attempts.get(key)!;
  res.setHeader('X-RateLimit-Limit', '120');
  res.setHeader('X-RateLimit-Remaining', Math.max(0, 120 - state.count));
  if (state.count > 120) return res.status(429).json({ error: 'Rate limit exceeded. Try again shortly.' });
  next();
});

const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const state = readState();
  const userId = token ? state.sessions[token] : undefined;
  if (!userId) return res.status(401).json({ error: 'Authentication required' });
  const user = state.users.find((item) => item.id === userId);
  if (!user) return res.status(401).json({ error: 'Session is no longer valid' });
  res.locals.user = user;
  next();
};

const addActivity = (type: Activity['type'], title: string, detail: string, actor: string) => {
  const state = readState();
  state.activity.unshift({ id: id('act'), type, title, detail, actor, timestamp: new Date().toISOString() });
  state.activity = state.activity.slice(0, 40);
  writeState(state);
};

app.post('/api/auth/login', (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(4) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
  const state = readState();
  const user = state.users.find((item) => item.email.toLowerCase() === parsed.data.email.toLowerCase());
  if (!user || parsed.data.password !== 'demo1234') return res.status(401).json({ error: 'Invalid credentials. Use the seeded demo password.' });
  const token = crypto.randomBytes(24).toString('hex');
  state.sessions[token] = user.id;
  writeState(state);
  return res.json({ token, user });
});

app.post('/api/auth/logout', auth, (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const state = readState();
  if (token) delete state.sessions[token];
  writeState(state);
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => res.json({ user: res.locals.user }));

app.get('/api/dashboard', auth, (req, res) => {
  const state = readState();
  const active = state.tasks.filter((task) => ['running', 'queued', 'pending_review', 'escalated'].includes(task.status));
  res.json({
    summary: {
      activeTasks: active.length,
      completedThisMonth: state.tasks.filter((task) => task.status === 'completed').length + 42,
      accuracy: 97.8,
      hoursSaved: 184.5,
      apiCalls: 1482,
      errors: state.activity.filter((item) => item.type === 'error').length,
    },
    agents: state.agents,
    tasks: state.tasks,
    activity: state.activity,
  });
});

app.get('/api/agents', auth, (req, res) => res.json({ agents: readState().agents }));
app.patch('/api/agents/:id', auth, (req, res) => {
  const parsed = z.object({ status: z.enum(['online', 'paused', 'offline']).optional(), temperature: z.number().min(0).max(1).optional(), tools: z.array(z.string()).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid agent settings.' });
  const state = readState();
  const agent = state.agents.find((item) => item.id === req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  Object.assign(agent, parsed.data);
  writeState(state);
  addActivity('info', 'Agent settings updated', `${agent.name} configuration was changed`, res.locals.user.name);
  res.json({ agent });
});

app.get('/api/tasks', auth, (req, res) => {
  const state = readState();
  res.json({ tasks: state.tasks });
});

app.post('/api/tasks', auth, (req, res) => {
  const parsed = z.object({ title: z.string().min(3).max(120), project: z.string().min(2), source: z.string().min(2), agentId: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Title, project, source, and agent are required.' });
  const state = readState();
  const agent = state.agents.find((item) => item.id === parsed.data.agentId);
  if (!agent || agent.status !== 'online') return res.status(400).json({ error: 'Selected agent is not online.' });
  const task = { id: id('task'), ...parsed.data, requester: res.locals.user.name, status: 'queued' as const, progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), estimatedValue: 0, materials: [] };
  state.tasks.unshift(task);
  writeState(state);
  addActivity('info', 'New estimation task queued', `${task.title} assigned to ${agent.name}`, res.locals.user.name);
  res.status(201).json({ task });
});

app.post('/api/tasks/:id/action', auth, (req, res) => {
  const parsed = z.object({ action: z.enum(['start', 'pause', 'stop', 'retry', 'approve', 'reject']), confirm: z.boolean().optional(), note: z.string().max(300).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid task action.' });
  const { action, confirm } = parsed.data;
  if (['stop', 'reject'].includes(action) && !confirm) return res.status(400).json({ error: 'This sensitive action requires explicit confirmation.' });
  const state = readState();
  const task = state.tasks.find((item) => item.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const map: Partial<Record<typeof action, TaskStatus>> = { start: 'running', pause: 'paused', stop: 'stopped', retry: 'running', approve: 'completed', reject: 'stopped' };
  task.status = map[action]!;
  task.updatedAt = new Date().toISOString();
  if (action === 'approve' || action === 'reject') task.review = { ...task.review, requestedAt: task.review?.requestedAt ?? task.updatedAt, reviewedAt: task.updatedAt, reviewerId: res.locals.user.id, note: parsed.data.note ?? task.review?.note ?? '' };
  if (action === 'start' && task.progress === 0) task.progress = 12;
  if (action === 'retry') task.progress = Math.max(10, task.progress);
  writeState(state);
  addActivity(action === 'reject' || action === 'stop' ? 'warning' : 'success', `Task ${action}ed`, `${task.title} is now ${task.status.replace('_', ' ')}`, res.locals.user.name);
  res.json({ task });
});

app.get('/api/conversations', auth, (req, res) => res.json({ messages: readState().messages }));
app.post('/api/conversations', auth, (req, res) => {
  const parsed = z.object({ content: z.string().min(1).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Message cannot be empty.' });
  const state = readState();
  state.messages.push({ id: id('msg'), role: 'user', content: parsed.data.content, timestamp: new Date().toISOString() });
  const lower = parsed.data.content.toLowerCase();
  const reply = lower.includes('variance') ? 'The highest variance is in Northstar Offices: structural lumber and sheathing are 8.6% above the historical baseline. The workflow is paused at the four-eyes gate until a reviewer confirms the revised structural notes.' : lower.includes('status') ? `There are ${state.tasks.filter((task) => ['running', 'queued'].includes(task.status)).length} execution tasks in flight and ${state.tasks.filter((task) => task.status === 'pending_review').length} awaiting review.` : 'I can investigate task status, material variances, historical matches, and review queues. Try asking about a project or workflow.';
  state.messages.push({ id: id('msg'), role: 'assistant', content: reply, timestamp: new Date().toISOString() });
  writeState(state);
  res.json({ messages: state.messages });
});

app.get('/api/integrations', auth, (req, res) => res.json({ integrations: readState().integrations }));
app.post('/api/integrations/:id/test', auth, (req, res) => {
  const state = readState();
  try {
    const result = executeApprovedTool(String(req.params.id), { purpose: 'connection_test', requestedBy: res.locals.user.id }, state.integrations);
    addActivity('success', 'Integration test queued', `${req.params.id} passed the approved-tool guard`, res.locals.user.name);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Integration test failed' });
  }
});

app.get('/api/settings', auth, (req, res) => res.json({ settings: { reviewTimeoutHours: 2, requireConfirmationFor: ['stop', 'reject', 'external_message'], retentionDays: 90, dailyApiBudget: 5000 } }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'buildflow-api', time: new Date().toISOString() }));

app.listen(port, () => console.log(`Buildflow API listening on http://localhost:${port}`));
