import { Document, Schema, model } from 'mongoose';

export interface IMandateProviderConfig {
    providerName: string;
    gmailQuery: string;
    confidence: 'high' | 'low';
    extractionHints?: string;
}

export interface IMandateProviderConfigDoc extends Document, IMandateProviderConfig {}

export const MandateProviderConfigSchema = new Schema<IMandateProviderConfigDoc>(
    {
        providerName: { type: String, required: true },
        gmailQuery: { type: String, required: true },
        confidence: { type: String, enum: ['high', 'low'], required: true },
        extractionHints: { type: String },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mandate_provider_configs',
    }
);

MandateProviderConfigSchema.index({ providerName: 1 }, { unique: true });

export const MandateProviderConfigModel = model<IMandateProviderConfigDoc>(
    'MandateProviderConfig',
    MandateProviderConfigSchema
);
