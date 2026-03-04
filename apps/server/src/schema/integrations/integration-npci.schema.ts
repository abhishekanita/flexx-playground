import { Document, Schema, model, Types } from 'mongoose';

export interface IIntegrationNpci {
    userId: Types.ObjectId;
    phoneNumber: string;
    accessToken: string;
    csrfToken: string;
    sessionId: string;
    isConnected: boolean;
    connectedAt: Date;
    tokenExpiresAt: Date;
}

export interface IIntegrationNpciDoc extends Document, IIntegrationNpci {}

export const IntegrationNpciSchema = new Schema<IIntegrationNpciDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        phoneNumber: { type: String, required: true },
        accessToken: String,
        csrfToken: String,
        sessionId: String,
        isConnected: { type: Boolean, default: true },
        connectedAt: { type: Date, default: Date.now },
        tokenExpiresAt: Date,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'integration_npci',
    }
);

IntegrationNpciSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });

export const IntegrationNpciModel = model<IIntegrationNpciDoc>('IntegrationNpci', IntegrationNpciSchema);
