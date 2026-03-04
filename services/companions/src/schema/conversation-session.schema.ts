import { ConversationSession } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IConversationSessionsDoc extends Document, Omit<ConversationSession, '_id'> {}

export const ConversationSessionSchema = new Schema<IConversationSessionsDoc>(
    {
        sessionId: { type: String, required: true, unique: true, index: true },
        agentId: { type: String, required: true, index: true },
        title: { type: String },
        metadata: { type: Schema.Types.Mixed },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'agent.sessions',
    }
);

export const ConversationSessionModel = model<IConversationSessionsDoc>('agent.sessions', ConversationSessionSchema);
