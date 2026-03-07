import { GmailPlugin, GmailFullMessage } from '@/plugins/gmail';
import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { userService } from '@/services/users/user.service';
import { uploadToS3 } from '@/utils/aws';
import { config } from '@/config';
import { EmailProcessingStatus } from '@/types/emails/emails.type';
import { createHash } from 'crypto';
import { GMAIL_SEARCH_QUERIES_V2, GmailSearchQuery } from './helpers/search-queries';

export interface EmailSyncResult {
    fetched: number;
    newEmails: number;
    skippedDuplicates: number;
    errors: number;
}

interface SyncEmailConfig {
    downloadAttachments: boolean;
    lookbackWindowDays: number;
    windowSize: number;
}

const defaultConfig: SyncEmailConfig = {
    downloadAttachments: true,
    lookbackWindowDays: 12 * 30,
    windowSize: 30,
};

export class SyncEmailStage {
    private config: SyncEmailConfig;

    constructor(config = defaultConfig) {
        this.config = config;
    }

    async syncEmailBulk(userId: string, queryIds?: string[]): Promise<EmailSyncResult> {
        const creds = await gmailConnectionService.getCredentials(userId);
        if (!creds) throw new Error(`No Gmail credentials found for user ${userId}`);
        const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

        const processedIds = new Set<string>();
        const queries = queryIds ? GMAIL_SEARCH_QUERIES_V2.filter(q => queryIds.includes(q.id)) : GMAIL_SEARCH_QUERIES_V2;
        const result: EmailSyncResult = { fetched: 0, newEmails: 0, skippedDuplicates: 0, errors: 0 };

        const syncCursor = await userService.getGmailSyncCursor(userId);
        const lookbackMs = this.config.lookbackWindowDays * 86400000;
        const startDate = syncCursor && syncCursor.getTime() > Date.now() - lookbackMs ? syncCursor : new Date(Date.now() - lookbackMs);

        const brackets = this.generateDateBrackets(startDate, this.config.windowSize);

        for (const bracket of brackets) {
            for (const searchQuery of queries) {
                try {
                    const query = this.buildQuery(searchQuery, bracket.start, bracket.end);
                    logger.info(`[EmailSync] Query=${searchQuery.id} Window=${bracket.start.toISOString()} → ${bracket.end.toISOString()}`);

                    const messages = await gmail.searchAllMessages(query, searchQuery.maxResults || 500);

                    result.fetched += messages.length;
                    const unseen = messages.filter(m => !processedIds.has(m.messageId));
                    for (const m of unseen) processedIds.add(m.messageId);
                    if (unseen.length === 0) {
                        logger.info(`[EmailSync] Query "${searchQuery.id}": ${messages.length} fetched, all duplicates`);
                        result.skippedDuplicates += messages.length;
                        continue;
                    }
                    // Batch-check DB for existing messageIds
                    const unseenIds = unseen.map(m => m.messageId);
                    const existingDocs = await rawEmailsService.find({
                        userId,
                        gmailMessageId: { $in: unseenIds },
                    } as any);
                    const existingIds = new Set(existingDocs.map((d: any) => d.gmailMessageId));
                    const newMessages = unseen.filter(m => !existingIds.has(m.messageId));
                    const skipped = messages.length - newMessages.length;
                    result.skippedDuplicates += skipped;

                    if (newMessages.length === 0) {
                        logger.info(`[EmailSync] Query "${searchQuery.id}": ${messages.length} fetched, ${skipped} duplicates`);
                        continue;
                    }
                    // Bulk insert this query's new messages
                    const now = new Date().toISOString();
                    const ops = newMessages.map(msg => ({
                        insertOne: { document: this.toRawEmailDoc(userId, msg, now) },
                    }));
                    try {
                        const writeResult = await rawEmailsService.bulkWrite(ops, { ordered: false });
                        const inserted = writeResult.insertedCount || newMessages.length;
                        result.newEmails += inserted;
                    } catch (err: any) {
                        const inserted = err.result?.nInserted || 0;
                        result.newEmails += inserted;
                        result.errors++;
                    }

                    if (this.config.downloadAttachments) {
                        const jobs = newMessages
                            .filter(m => m.hasAttachments && m.attachments.length > 0)
                            .flatMap(msg => msg.attachments.map(att => ({ msg, att })));
                        await this.uploadAttachmentsConcurrently(gmail, userId, jobs, 5);
                    }
                } catch (err: any) {
                    logger.error(`[EmailSync] Query "${searchQuery.id}" failed: ${err.message}`);
                    result.errors++;
                }
            }

            await userService.updateGmailSyncCursor(userId, bracket.end);
        }

        logger.info(
            `[EmailSync] Done for user ${userId}: ${result.fetched} fetched, ${result.newEmails} new, ${result.skippedDuplicates} duplicates, ${result.errors} errors`
        );
        return result;
    }

    private buildQuery(q: GmailSearchQuery, start: Date, end: Date): string {
        const after = start.toISOString().slice(0, 10).replace(/-/g, '/');
        const before = end.toISOString().slice(0, 10).replace(/-/g, '/');

        return `${q.query} after:${after} before:${before}`;
    }

    private generateDateBrackets(startDate: Date, windowSize: number) {
        const brackets: { start: Date; end: Date }[] = [];

        const end = new Date();
        let cursor = new Date(startDate);

        while (cursor < end) {
            const next = new Date(cursor.getTime() + windowSize * 86400000);

            brackets.push({
                start: new Date(cursor),
                end: next < end ? next : end,
            });

            cursor = next;
        }

        return brackets;
    }

    private getExtension(mimeType: string, filename?: string): string {
        if (filename) {
            const ext = filename.split('.').pop()?.toLowerCase();
            if (ext) return ext;
        }
        const mimeMap: Record<string, string> = {
            'application/pdf': 'pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
            'application/vnd.ms-excel': 'xls',
            'text/csv': 'csv',
            'image/png': 'png',
            'image/jpeg': 'jpg',
        };
        return mimeMap[mimeType] || 'bin';
    }

    private async uploadAttachmentsConcurrently(
        gmail: GmailPlugin,
        userId: string,
        jobs: { msg: GmailFullMessage; att: GmailFullMessage['attachments'][number] }[],
        concurrency: number
    ): Promise<void> {
        if (jobs.length === 0) return;

        let idx = 0;
        const run = async () => {
            while (idx < jobs.length) {
                const i = idx++;
                const { msg, att } = jobs[i];
                try {
                    const buffer = await gmail.downloadAttachment(msg.messageId, att.gmailAttachmentId);
                    const ext = this.getExtension(att.mimeType, att.filename);
                    const s3Key = `gmail-sync/${userId}/${msg.messageId}.${att.gmailAttachmentId}.${ext}`;

                    await uploadToS3(config.aws.privateBucketName, s3Key, buffer, att.mimeType, buffer.length);

                    await rawEmailsService.updateOne(
                        { gmailMessageId: msg.messageId, 'attachments.gmailAttachmentId': att.gmailAttachmentId } as any,
                        { $set: { 'attachments.$.downloaded': true, 'attachments.$.s3Key': s3Key } }
                    );

                    logger.info(`[EmailSync] Uploaded attachment ${att.filename} → s3://${s3Key}`);
                } catch (err: any) {
                    logger.error(
                        `[EmailSync] Failed to download/upload attachment ${att.filename} for msg ${msg.messageId}: ${err.message}`
                    );
                }
            }
        };

        const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, () => run());
        await Promise.all(workers);
    }

    private toRawEmailDoc(userId: string, msg: GmailFullMessage, now: string) {
        const attachments = msg.attachments.map(a => ({
            filename: a.filename,
            mimeType: a.mimeType,
            gmailAttachmentId: a.gmailAttachmentId,
            downloaded: false,
        }));

        const hasPdf = attachments.some(a => a.mimeType === 'application/pdf');
        const hasExcel = attachments.some(
            a =>
                a.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                a.mimeType === 'application/vnd.ms-excel'
        );

        return {
            userId,
            gmailMessageId: msg.messageId,
            gmailThreadId: msg.threadId,
            gmailLabels: msg.labels,

            fromAddress: msg.fromEmail,
            fromName: msg.fromName,
            toAddress: '',
            subject: msg.subject,
            receivedAt: new Date(msg.receivedAt).toISOString(),
            fetchedAt: now,

            bodyHtml: msg.bodyHtml,
            bodyText: msg.bodyText,

            attachments,
            hasAttachments: msg.hasAttachments,
            hasPdf,
            hasEncryptedPdf: false,
            hasExcel,
            hasEncryptedExcel: false,

            status: EmailProcessingStatus.Fetched,
            statusUpdatedAt: now,
            contenthash: createHash('sha256').update(`${msg.fromEmail}|${msg.subject}|${msg.bodyText}`).digest('hex'),
        };
    }
}
