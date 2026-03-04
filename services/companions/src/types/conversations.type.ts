/**
 * Conversation types aligned with Vercel AI SDK's ModelMessage format.
 *
 * The AI SDK uses:
 *   - SystemModelMessage  { role: 'system',    content: string }
 *   - UserModelMessage    { role: 'user',      content: string | (TextPart | ImagePart | FilePart)[] }
 *   - AssistantModelMessage { role: 'assistant', content: string | (TextPart | ToolCallPart | ToolResultPart | ...)[] }
 *   - ToolModelMessage    { role: 'tool',      content: ToolResultPart[] }
 *
 * We store messages in a flattened shape that can be reconstructed into ModelMessage[].
 */

// ── Tool call / result sub-types (mirrors AI SDK parts) ─────────────

export interface ToolCallData {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

export interface ToolResultData {
    toolCallId: string;
    toolName: string;
    output: unknown;
    isError?: boolean;
}

// ── Message roles ───────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// ── Conversation message ────────────────────────────────────────────

export interface ConversationMessage {
    sessionId: string;
    role: MessageRole;
    content: string;
    toolCalls?: ToolCallData[];
    toolResults?: ToolResultData[];
    metadata?: Record<string, unknown>;
}

// ── Conversation session ────────────────────────────────────────────

export interface ConversationSession {
    sessionId: string;
    agentId: string;
    title?: string;
    metadata?: Record<string, unknown>;
}
