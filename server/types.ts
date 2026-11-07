export type Role = 'admin' | 'estimator' | 'reviewer' | 'client';
export type TaskStatus = 'queued' | 'running' | 'pending_review' | 'completed' | 'paused' | 'stopped' | 'escalated';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  specialty: string;
  status: 'online' | 'paused' | 'offline';
  model: string;
  temperature: number;
  tools: string[];
  runs: number;
  successRate: number;
  lastActive: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  project: string;
  requester: string;
  agentId: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  materials: Array<{ name: string; quantity: number; unit: string; confidence: number }>;
  estimatedValue: number;
  review?: { reviewerId?: string; requestedAt: string; note: string; reviewedAt?: string };
  source: string;
}

export interface Activity {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  detail: string;
  actor: string;
  timestamp: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  category: 'messaging' | 'productivity';
  status: 'connected' | 'available' | 'needs_review';
  scopes: string[];
  lastSync?: string;
}

export interface AppState {
  users: User[];
  agents: Agent[];
  tasks: Task[];
  activity: Activity[];
  messages: ConversationMessage[];
  integrations: Integration[];
  sessions: Record<string, string>;
}
