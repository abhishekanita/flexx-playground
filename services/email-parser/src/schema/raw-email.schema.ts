import mongoose, { Document, Schema, Types } from 'mongoose';
import type { RawEmailStatus, EmailAttachment, ParseResult } from '@/types/financial.types';

export interface IRawEmail {
    userId: Types.ObjectId;
    integrationId: Types.ObjectId;
    gmailMessageId: string;
    threadId: string;

    // Headers
    from: string;
    fromEmail: string;
    fromDomain: string;
    subject: string;
    date: Date;
    receivedAt: Date;

    // Content
    bodyHtml: string;
    bodyText: string;
    hasAttachments: boolean;
    attachments: EmailAttachment[];

    // Classification
    category: string;
    subcategory: string;
    senderKey: string;
    templateKey: string;

    // Processing
    status: RawEmailStatus;
    parseResult: ParseResult;
}

export interface IRawEmailDoc extends Document, IRawEmail {}

const AttachmentSchema = new Schema(
    {
        filename: String,
        mimeType: String,
        gmailAttachmentId: String,
        downloaded: { type: Boolean, default: false },
        storagePath: String,
    },
    { _id: false }
);

const ParseResultSchema = new Schema(
    {
        parserConfigId: String,
        method: String,
        extractedData: Schema.Types.Mixed,
        targetCollection: String,
        targetDocId: { type: Schema.Types.ObjectId },
        confidence: Number,
        error: String,
        attempts: { type: Number, default: 0 },
    },
    { _id: false }
);

const RawEmailSchema = new Schema<IRawEmailDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        integrationId: { type: Schema.Types.ObjectId, ref: 'IntegrationGmail', required: true },
        gmailMessageId: { type: String, required: true },
        threadId: String,

        from: String,
        fromEmail: String,
        fromDomain: String,
        subject: String,
        date: Date,
        receivedAt: Date,

        bodyHtml: String,
        bodyText: String,
        hasAttachments: { type: Boolean, default: false },
        attachments: [AttachmentSchema],

        category: String,
        subcategory: String,
        senderKey: String,
        templateKey: String,

        status: {
            type: String,
            enum: ['fetched', 'classified', 'parsed', 'enriched', 'failed', 'skipped'],
            default: 'fetched',
        },
        parseResult: ParseResultSchema,
    },
    { timestamps: true, versionKey: false, collection: 'raw_emails' }
);

RawEmailSchema.index({ userId: 1, gmailMessageId: 1 }, { unique: true });
RawEmailSchema.index({ userId: 1, status: 1 });
RawEmailSchema.index({ senderKey: 1, templateKey: 1, status: 1 });
RawEmailSchema.index({ userId: 1, date: -1 });

export const RawEmail = mongoose.model<IRawEmailDoc>('RawEmail', RawEmailSchema);
