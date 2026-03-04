import { generateText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { nanoid } from 'nanoid';
import { config } from '@/config';
import { agentProfiles, AgentProfile } from './prompts';
import { toolMap } from './tools';
import conversationService from '@/services/conversations/conversations.service';
import logger from '@/utils/logger';

const openai = createOpenAI({ apiKey: config.openai.apiKey });

const DEFAULT_MODEL = 'gpt-4.1-mini';

class Agent {
    private log = logger.createServiceLogger('Agent');

    // ── Session management ──────────────────────────────────────────

    async createSession(agentId: string, title?: string) {
        const agent = this.getAgent(agentId);
        if (!agent) throw new Error(`Agent "${agentId}" not found`);

        const sessionId = nanoid();
        await conversationService.createSession({ sessionId, agentId, title });
        this.log.green(`Session created: ${sessionId} (agent: ${agentId})`);
        return sessionId;
    }

    // ── Send a message and get a response ───────────────────────────

    async sendMessage(userMessage: string, sessionId: string) {
        const session = await conversationService.getSession(sessionId);
        if (!session) throw new Error(`Session "${sessionId}" not found`);

        const agent = this.getAgent(session.agentId);
        if (!agent) throw new Error(`Agent "${session.agentId}" not found`);

        // Save user message
        await conversationService.addMessage({
            sessionId,
            role: 'user',
            content: userMessage,
        });

        // Build messages array for AI SDK
        const messages = await conversationService.getMessagesForAI(sessionId);

        // Resolve tools
        const tools: Record<string, any> = {};
        for (const name of agent.allowedTools) {
            if (toolMap[name]) tools[name] = toolMap[name];
        }

        const { text, toolCalls, toolResults, usage, response } = await generateText({
            model: openai(agent.model ?? DEFAULT_MODEL),
            system: agent.prompt,
            messages,
            tools: Object.keys(tools).length > 0 ? tools : undefined,
            stopWhen: stepCountIs(5),
        });

        // Persist all response messages from the AI SDK (handles multi-step tool calls)
        for (const msg of response.messages) {
            if (msg.role === 'assistant') {
                const content = typeof msg.content === 'string' ? msg.content : '';
                const tcParts = Array.isArray(msg.content)
                    ? (msg.content as any[]).filter((p: any) => p.type === 'tool-call')
                    : [];

                await conversationService.addMessage({
                    sessionId,
                    role: 'assistant',
                    content,
                    toolCalls: tcParts.length
                        ? tcParts.map((tc: any) => ({
                              toolCallId: tc.toolCallId,
                              toolName: tc.toolName,
                              input: tc.input,
                          }))
                        : undefined,
                });
            } else if (msg.role === 'tool') {
                const trParts = Array.isArray(msg.content) ? msg.content : [];
                await conversationService.addMessage({
                    sessionId,
                    role: 'tool',
                    content: '',
                    toolResults: trParts.map((tr: any) => ({
                        toolCallId: tr.toolCallId,
                        toolName: tr.toolName,
                        output: tr.output,
                    })),
                });
            }
        }

        this.log.info(`Response generated (${usage.inputTokens}in/${usage.outputTokens}out)`);

        return { text, toolCalls, toolResults, usage };
    }

    // ── Get conversation history ────────────────────────────────────

    async getMessages(sessionId: string) {
        return conversationService.getMessages(sessionId);
    }

    // ── List sessions ───────────────────────────────────────────────

    async listSessions(agentId?: string) {
        return conversationService.listSessions(agentId);
    }

    // ── Delete session (new session = empty messages) ───────────────

    async deleteSession(sessionId: string) {
        await conversationService.deleteSession(sessionId);
        this.log.warn(`Session deleted: ${sessionId}`);
    }

    // ── Lookup agent profile ────────────────────────────────────────

    private getAgent(agentId: string): AgentProfile | undefined {
        return agentProfiles.find(a => a.agentId === agentId);
    }
}

export default new Agent();
