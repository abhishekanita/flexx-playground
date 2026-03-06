import { google, gmail_v1 } from 'googleapis';
import { config } from '@/config';

export interface GmailFullMessage {
    messageId: string;
    threadId: string;
    from: string;
    fromEmail: string;
    fromDomain: string;
    subject: string;
    date: string;
    receivedAt: string;
    bodyHtml: string;
    bodyText: string;
    hasAttachments: boolean;
    attachments: GmailAttachmentMeta[];
}

export interface GmailAttachmentMeta {
    filename: string;
    mimeType: string;
    gmailAttachmentId: string;
    size: number;
}

export interface GmailSearchOptions {
    query: string;
    maxResults?: number;
    pageToken?: string;
}

export interface GmailSearchResult {
    messages: GmailFullMessage[];
    nextPageToken?: string;
    totalEstimate: number;
}

export class GmailPlugin {
    private createClient(accessToken: string, refreshToken: string) {
        const oauth2Client = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        return { oauth2Client, gmail: google.gmail({ version: 'v1', auth: oauth2Client }) };
    }

    /**
     * Refresh the access token and return the new one.
     */
    async refreshAccessToken(refreshToken: string): Promise<string> {
        const oauth2Client = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const { credentials } = await oauth2Client.refreshAccessToken();
        return credentials.access_token || '';
    }

    /**
     * Search Gmail with pagination. Returns one page of results.
     */
    async searchMessages(
        accessToken: string,
        refreshToken: string,
        options: GmailSearchOptions
    ): Promise<GmailSearchResult> {
        const { gmail } = this.createClient(accessToken, refreshToken);

        const listRes = await gmail.users.messages.list({
            userId: 'me',
            q: options.query,
            maxResults: options.maxResults || 100,
            pageToken: options.pageToken,
        });

        const messageRefs = listRes.data.messages || [];
        const totalEstimate = listRes.data.resultSizeEstimate || 0;

        const messages: GmailFullMessage[] = [];
        for (const ref of messageRefs) {
            if (!ref.id) continue;
            try {
                const msg = await this.fetchFullMessage(gmail, ref.id);
                messages.push(msg);
            } catch (err: any) {
                logger.warn(`[GmailPlugin] Failed to fetch message ${ref.id}: ${err.message}`);
            }
        }

        return {
            messages,
            nextPageToken: listRes.data.nextPageToken || undefined,
            totalEstimate,
        };
    }

    /**
     * Search all pages of Gmail results for a query.
     */
    async searchAllMessages(
        accessToken: string,
        refreshToken: string,
        query: string,
        maxTotal: number = 500
    ): Promise<GmailFullMessage[]> {
        const all: GmailFullMessage[] = [];
        let pageToken: string | undefined;

        while (all.length < maxTotal) {
            const result = await this.searchMessages(accessToken, refreshToken, {
                query,
                maxResults: Math.min(100, maxTotal - all.length),
                pageToken,
            });

            all.push(...result.messages);

            if (!result.nextPageToken || result.messages.length === 0) break;
            pageToken = result.nextPageToken;
        }

        return all;
    }

    /**
     * Fetch a single full message by ID.
     */
    async fetchMessageById(
        accessToken: string,
        refreshToken: string,
        messageId: string
    ): Promise<GmailFullMessage> {
        const { gmail } = this.createClient(accessToken, refreshToken);
        return this.fetchFullMessage(gmail, messageId);
    }

    /**
     * Download an attachment by its Gmail attachment ID.
     */
    async downloadAttachment(
        accessToken: string,
        refreshToken: string,
        messageId: string,
        attachmentId: string
    ): Promise<Buffer> {
        const { gmail } = this.createClient(accessToken, refreshToken);

        const res = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId,
        });

        const data = res.data.data || '';
        return Buffer.from(data, 'base64');
    }

    // --- Private helpers ---

    private async fetchFullMessage(gmail: gmail_v1.Gmail, messageId: string): Promise<GmailFullMessage> {
        const detail = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const payload = detail.data.payload;
        const headers = payload?.headers || [];

        const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const from = getHeader('From');
        const fromEmail = this.extractEmail(from);
        const fromDomain = this.extractDomain(fromEmail);
        const subject = getHeader('Subject');
        const date = getHeader('Date');
        const receivedAt = getHeader('Date'); // Use Date header as receivedAt

        const bodyHtml = this.extractBody(payload, 'text/html');
        const bodyText = this.extractBody(payload, 'text/plain');

        const attachments = this.extractAttachmentMeta(payload);

        return {
            messageId: detail.data.id || messageId,
            threadId: detail.data.threadId || '',
            from,
            fromEmail,
            fromDomain,
            subject,
            date,
            receivedAt,
            bodyHtml,
            bodyText,
            hasAttachments: attachments.length > 0,
            attachments,
        };
    }

    private extractBody(payload: any, mimeType: string): string {
        if (!payload) return '';

        if (payload.mimeType === mimeType && payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        if (payload.parts) {
            // Direct children first
            for (const part of payload.parts) {
                if (part.mimeType === mimeType && part.body?.data) {
                    return Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
            }
            // Recurse into nested multipart
            for (const part of payload.parts) {
                const nested = this.extractBody(part, mimeType);
                if (nested) return nested;
            }
        }

        return '';
    }

    private extractAttachmentMeta(payload: any): GmailAttachmentMeta[] {
        const attachments: GmailAttachmentMeta[] = [];
        if (!payload) return attachments;

        const walk = (part: any) => {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType || 'application/octet-stream',
                    gmailAttachmentId: part.body.attachmentId,
                    size: part.body.size || 0,
                });
            }
            if (part.parts) {
                for (const child of part.parts) {
                    walk(child);
                }
            }
        };

        walk(payload);
        return attachments;
    }

    private extractEmail(from: string): string {
        const match = from.match(/<([^>]+)>/);
        return match ? match[1].toLowerCase() : from.toLowerCase().trim();
    }

    private extractDomain(email: string): string {
        const parts = email.split('@');
        return parts.length > 1 ? parts[1] : '';
    }
}

export const gmailPlugin = new GmailPlugin();
