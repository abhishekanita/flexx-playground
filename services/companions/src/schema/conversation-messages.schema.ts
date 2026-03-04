import { ConversationMessage } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IConversationMessagesDoc extends Document, Omit<ConversationMessage, '_id'> {}

const ToolCallDataSchema = new Schema(
    {
        toolCallId: { type: String, required: true },
        toolName: { type: String, required: true },
        input: { type: Schema.Types.Mixed },
    },
    { _id: false }
);

const ToolResultDataSchema = new Schema(
    {
        toolCallId: { type: String, required: true },
        toolName: { type: String, required: true },
        output: { type: Schema.Types.Mixed },
        isError: { type: Boolean, default: false },
    },
    { _id: false }
);

export const ConversationMessageSchema = new Schema<IConversationMessagesDoc>(
    {
        sessionId: { type: String, required: true, index: true },
        role: { type: String, required: true, enum: ['system', 'user', 'assistant', 'tool'] },
        content: { type: String, default: '' },
        toolCalls: { type: [ToolCallDataSchema], default: undefined },
        toolResults: { type: [ToolResultDataSchema], default: undefined },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'agent.messages',
    }
);

ConversationMessageSchema.index({ sessionId: 1, createdAt: 1 });

export const ConversationMessageModel = model<IConversationMessagesDoc>('agent.messages', ConversationMessageSchema);
