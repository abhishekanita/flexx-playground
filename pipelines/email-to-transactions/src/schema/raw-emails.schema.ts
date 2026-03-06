import mongoose, { Schema, Document } from 'mongoose';
import { RawEmail } from '@/types/emails.type';

export interface IRawEmailsDoc extends Document, Omit<RawEmail, '_id'> {}

const RawEmailsSchema = new Schema<IRawEmailsDoc>(
    {
        userId: String,
        gmailMessageId: String,
        gmailThreadId: String,
        gmailLabs: [String],
        fromAddress: String,
        fromName: String,
        toAddress: String,
        subject: String,
        receivedAt: String,
        fetchedAt: String,
        bodyHtml: String,
        bodyText: String,
        bodyTextLength: Number,
        attachments: Schema.Types.Mixed,
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
    { timestamps: true, versionKey: false, collection: 'raw-data.emails' }
);

export const RawEmailsModel = mongoose.model<IRawEmailsDoc>('raw-data.emails', RawEmailsSchema);
