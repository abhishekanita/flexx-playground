import { Types } from 'mongoose';
import { RawEmail } from '@/schema/raw-email.schema';
import { gmailPlugin, GmailFullMessage } from '@/plugins/gmail.plugin';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';

export interface SyncResult {
    fetched: number;
    newEmails: number;
    skippedDuplicates: number;
}

export class EmailSyncService {
    /**
     * Stage 1: Search Gmail and upsert raw_emails.
     * Uses search queries from config. On re-sync, uses after: date filter.
     */
    async syncEmails(
        userId: Types.ObjectId,
        integrationId: Types.ObjectId,
        accessToken: string,
        refreshToken: string
    ): Promise<SyncResult> {
        const queries = parserConfigLoader.getSearchQueries();
        let totalFetched = 0;
        let totalNew = 0;
        let totalSkipped = 0;

        // Find the latest email date for this user (re-sync optimization)
        const latestEmail = await RawEmail.findOne(
            { userId },
            { date: 1 },
            { sort: { date: -1 } }
        );

        const afterDate = latestEmail?.date
            ? this.formatGmailDate(latestEmail.date)
            : undefined;

        for (const searchQuery of queries) {
            try {
                const query = afterDate
                    ? `${searchQuery.query} after:${afterDate}`
                    : searchQuery.query;

                const maxResults = searchQuery.maxResults || 200;

                logger.info(`[EmailSync] Searching: "${query}" (max: ${maxResults})`);

                const messages = await gmailPlugin.searchAllMessages(
                    accessToken,
                    refreshToken,
                    query,
                    maxResults
                );

                totalFetched += messages.length;

                for (const msg of messages) {
                    const result = await this.upsertRawEmail(userId, integrationId, msg);
                    if (result === 'created') {
                        totalNew++;
                    } else {
                        totalSkipped++;
                    }
                }

                logger.info(`[EmailSync] Query "${searchQuery.id}": fetched ${messages.length} messages`);
            } catch (err: any) {
                logger.error(`[EmailSync] Query "${searchQuery.id}" failed: ${err.message}`);
            }
        }

        logger.info(`[EmailSync] Total: ${totalFetched} fetched, ${totalNew} new, ${totalSkipped} duplicates`);

        return {
            fetched: totalFetched,
            newEmails: totalNew,
            skippedDuplicates: totalSkipped,
        };
    }

    /**
     * Upsert a single email. Returns 'created' or 'existed'.
     */
    private async upsertRawEmail(
        userId: Types.ObjectId,
        integrationId: Types.ObjectId,
        msg: GmailFullMessage
    ): Promise<'created' | 'existed'> {
        const existing = await RawEmail.findOne({
            userId,
            gmailMessageId: msg.messageId,
        });

        if (existing) return 'existed';

        await RawEmail.create({
            userId,
            integrationId,
            gmailMessageId: msg.messageId,
            threadId: msg.threadId,
            from: msg.from,
            fromEmail: msg.fromEmail,
            fromDomain: msg.fromDomain,
            subject: msg.subject,
            date: new Date(msg.date),
            receivedAt: new Date(msg.receivedAt),
            bodyHtml: msg.bodyHtml,
            bodyText: msg.bodyText,
            hasAttachments: msg.hasAttachments,
            attachments: msg.attachments.map((a) => ({
                filename: a.filename,
                mimeType: a.mimeType,
                gmailAttachmentId: a.gmailAttachmentId,
                downloaded: false,
            })),
            status: 'fetched',
        });

        return 'created';
    }

    /**
     * Format a Date as YYYY/MM/DD for Gmail after: filter.
     */
    private formatGmailDate(date: Date): string {
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    }
}

export const emailSyncService = new EmailSyncService();
