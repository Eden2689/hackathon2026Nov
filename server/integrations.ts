import type { Integration } from './types.js';

export const APPROVED_TOOLS = ['slack', 'whatsapp', 'gmail', 'teams', 'calendar'] as const;
export type ApprovedTool = typeof APPROVED_TOOLS[number];

export function isApprovedTool(tool: string): tool is ApprovedTool {
  return (APPROVED_TOOLS as readonly string[]).includes(tool);
}

export function executeApprovedTool(tool: string, input: Record<string, unknown>, integrations: Integration[]) {
  if (!isApprovedTool(tool)) throw new Error('Tool is not on the approved integration allow-list');
  const integration = integrations.find((item) => item.id === tool);
  if (!integration || integration.status === 'available') throw new Error(`Integration ${tool} is not connected`);
  return {
    tool,
    accepted: true,
    requestId: `tool_${Date.now().toString(36)}`,
    summary: `${integration.name} action queued for approval-safe delivery`,
    inputKeys: Object.keys(input),
  };
}
