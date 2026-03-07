import mongoose, { Schema, Document } from 'mongoose';
import { RawEmail } from '@/types/emails/emails.type';

export interface IRawEmailsDoc extends Document, Omit<RawEmail, '_id'> {}

const RawEmailsSchema = new Schema<IRawEmailsDoc>(
    {
        userId: String,
        gmailMessageId: String,
        gmailThreadId: String,
        gmailLabels: [String],
        fromAddress: String,
        fromName: String,
        toAddress: String,
        subject: String,
        receivedAt: String,
        fetchedAt: String,
        bodyHtml: String,
        bodyText: String,
        bodyTextLength: Number,
        attachments: [
            {
                _id: false,
                filename: String,
                mimeType: String,
                gmailAttachmentId: String,
                downloaded: { type: Boolean, default: false },
                s3Key: String,
            },
        ],
        hasEncryptedExcel: Boolean,
        hasEncryptedPdf: Boolean,
        hasExcel: Boolean,
        hasPdf: Boolean,
        status: String,
        statusUpdatedAt: String,
        marchedParserId: String,
        matchedParserVersion: Number,
        parsedData: Schema.Types.Mixed,
        insertionResult: Schema.Types.Mixed,
        parseAttempts: Number,
        lastInsertError: String,
        lastParseError: String,
        insertAttempts: Number,
    },
    { timestamps: true, versionKey: false }
);

export const RawEmailsModel = mongoose.model<IRawEmailsDoc>('raw-data.emails-v2', RawEmailsSchema);
