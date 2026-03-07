import { GmailPlugin, GmailFullMessage } from '@/plugins/gmail.plugin';
import { rawEmailsService } from '@/services/emails/emails.service';
import { gmailConnectionService } from '@/services/users/gmail-connection.service';
import { EmailProcessingStatus } from '@/types/emails.type';
import { GMAIL_SEARCH_QUERIES, buildQuery } from './queries';
import { createHash } from 'crypto';

export interface EmailSyncResult {
    fetched: number;
    newEmails: number;
    skippedDuplicates: number;
    errors: number;
}

export class SyncEmailStage {
    constructor() {
        //
    }

    async syncEmailsForUser(userId: string, queryIds?: string[], lookbackMonths = 3): Promise<EmailSyncResult> {
        const creds = await gmailConnectionService.getCredentials(userId);
        if (!creds) throw new Error(`No Gmail credentials found for user ${userId}`);

        const gmail = new GmailPlugin(creds.accessToken, creds.refreshToken);

        // Use a lookback window. DB dedup handles overlap cheaply.
        const afterDate = lookbackMonths > 0
            ? new Date(Date.now() - lookbackMonths * 30 * 24 * 60 * 60 * 1000)
            : undefined;

        const result: EmailSyncResult = { fetched: 0, newEmails: 0, skippedDuplicates: 0, errors: 0 };

        // Track messageIds we've already written this run to skip cross-query duplicates
        // Only stores IDs (small), not full message bodies
        const processedIds = new Set<string>();

        const queries = queryIds
            ? GMAIL_SEARCH_QUERIES.filter(q => queryIds.includes(q.id))
            : GMAIL_SEARCH_QUERIES;

        for (const searchQuery of queries) {
            try {
                const query = buildQuery(searchQuery, afterDate);
                const maxResults = searchQuery.maxResults || 500;

                logger.info(`[EmailSync] Searching: "${searchQuery.id}" (max: ${maxResults})`);

                const messages = await gmail.searchAllMessages(query, maxResults);
                result.fetched += messages.length;

                // Skip messages already processed in a previous query this run
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
                    logger.info(
                        `[EmailSync] Query "${searchQuery.id}": ${messages.length} fetched, ${inserted} inserted, ${skipped} duplicates`
                    );
                } catch (err: any) {
                    const inserted = err.result?.nInserted || 0;
                    result.newEmails += inserted;
                    result.errors++;
                    logger.error(
                        `[EmailSync] Query "${searchQuery.id}" bulk insert partial failure: ${err.message} (${inserted} inserted)`
                    );
                }
            } catch (err: any) {
                logger.error(`[EmailSync] Query "${searchQuery.id}" failed: ${err.message}`);
                result.errors++;
            }
        }

        logger.info(
            `[EmailSync] Done for user ${userId}: ${result.fetched} fetched, ${result.newEmails} new, ${result.skippedDuplicates} duplicates, ${result.errors} errors`
        );
        return result;
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
