import { Document, Schema, model, Types } from 'mongoose';

export interface IIntegrationGmail {
    userId: Types.ObjectId;
    email: string;
    accessToken: string;
    refreshToken: string;
    scopes: string[];
    isConnected: boolean;
    connectedAt: Date;
}

export interface IIntegrationGmailDoc extends Document, IIntegrationGmail {}

export const IntegrationGmailSchema = new Schema<IIntegrationGmailDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        email: { type: String, required: true },
        accessToken: String,
        refreshToken: String,
        scopes: { type: [String], default: [] },
        isConnected: { type: Boolean, default: true },
        connectedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'integration_gmail',
    }
);

IntegrationGmailSchema.index({ userId: 1, email: 1 }, { unique: true });

export const IntegrationGmailModel = model<IIntegrationGmailDoc>('IntegrationGmail', IntegrationGmailSchema);
