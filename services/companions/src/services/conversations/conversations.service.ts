import { ConversationMessageModel, ConversationSessionModel } from '@/schema';
import { ConversationMessage, ConversationSession } from '@/types';
import type { ModelMessage } from '@ai-sdk/provider-utils';

class ConversationService {
    // ── Session CRUD ────────────────────────────────────────────────

    async createSession(params: ConversationSession) {
        return ConversationSessionModel.create(params);
    }

    async getSession(sessionId: string) {
        return ConversationSessionModel.findOne({ sessionId });
    }

    async deleteSession(sessionId: string): Promise<void> {
        await ConversationMessageModel.deleteMany({ sessionId });
        await ConversationSessionModel.deleteOne({ sessionId });
    }

    async listSessions(agentId?: string) {
        const filter = agentId ? { agentId } : {};
        return ConversationSessionModel.find(filter).sort({ createdAt: -1 });
    }

    // ── Message CRUD ────────────────────────────────────────────────

    async addMessage(message: ConversationMessage) {
        return ConversationMessageModel.create(message);
    }

    async addMessages(messages: ConversationMessage[]) {
        return ConversationMessageModel.insertMany(messages);
    }

    async getMessages(sessionId: string) {
        return ConversationMessageModel.find({ sessionId }).sort({ createdAt: 1 });
    }

    async clearMessages(sessionId: string): Promise<void> {
        await ConversationMessageModel.deleteMany({ sessionId });
    }

    // ── AI SDK helpers ──────────────────────────────────────────────

    /**
     * Load messages for a session and convert to Vercel AI SDK ModelMessage[].
     * Ready to pass into generateText({ messages }) or streamText({ messages }).
     */
    async getMessagesForAI(sessionId: string): Promise<ModelMessage[]> {
        const docs = await this.getMessages(sessionId);
        return docs.map((doc): ModelMessage => {
            switch (doc.role) {
                case 'system':
                    return { role: 'system', content: doc.content };

                case 'user':
                    return { role: 'user', content: doc.content };

                case 'assistant': {
                    if (doc.toolCalls?.length) {
                        return {
                            role: 'assistant',
                            content: doc.toolCalls.map(tc => ({
                                type: 'tool-call' as const,
                                toolCallId: tc.toolCallId,
                                toolName: tc.toolName,
                                input: tc.input,
                            })),
                        };
                    }
                    return { role: 'assistant', content: doc.content };
                }

                case 'tool': {
                    return {
                        role: 'tool' as const,
                        content: (doc.toolResults ?? []).map(tr => ({
                            type: 'tool-result' as const,
                            toolCallId: tr.toolCallId,
                            toolName: tr.toolName,
                            output: tr.isError
                                ? { type: 'text' as const, value: String(tr.output) }
                                : { type: 'json' as const, value: tr.output as any },
                        })),
                    } as ModelMessage;
                }

                default:
                    return { role: 'user', content: doc.content };
            }
        });
    }
}

export default new ConversationService();
