import { google, gmail_v1, Common } from 'googleapis';
import axios from 'axios';
import { config } from '@/config/config';
import logger, { ServiceLogger } from '@/utils/logger';
import {
    GmailRawMessage,
    GmailParsedMessage,
    GmailMessagePart,
    GmailAttachment,
    GmailHeader,
    GmailMessageListResponse,
} from './gmail.type';
import { PDFParse } from 'pdf-parse';

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];
export interface IGoogleUser {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name: string;
    family_name: string;
    picture: string;
    locale: string;
}

export class GmailPlugin {
    private log: ServiceLogger;
    private auth: Common.OAuth2Client;

    constructor() {
        this.log = logger.createServiceLogger('GmailPlugin');
        this.auth = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUrl);
    }

    public getAuthUrl(state: string) {
        return this.auth.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: SCOPES,
            redirect_uri: config.google.redirectUrl,
            state: state || '',
        });
    }

    public async getGoogleUser(code: string) {
        const { tokens } = await this.auth.getToken(code);
        const url = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${tokens.access_token}`;
        const googleUser: IGoogleUser = await axios
            .get(url, {
                headers: {
                    Authorization: `Bearer ${tokens.id_token}`,
                },
            })
            .then(res => res.data)
            .catch(error => {
                throw new Error(error.message);
            });
        return googleUser;
    }

    public async getTokensAndUser(code: string) {
        this.log.info('Exchanging auth code for tokens...');
        const { tokens } = await this.auth.getToken(code);
        this.log.info(
            `Tokens received — access_token: ${tokens.access_token ? 'present' : 'MISSING'}, refresh_token: ${
                tokens.refresh_token ? 'present' : 'MISSING'
            }`
        );

        this.log.info('Fetching Google user info...');
        const googleUser: IGoogleUser = await axios
            .get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
            })
            .then(res => res.data)
            .catch(error => {
                this.log.error(`User info fetch failed — status: ${error.response?.status}, data: ${JSON.stringify(error.response?.data)}`);
                throw new Error(error.message);
            });
        this.log.info(`Google user fetched: ${googleUser.email}`);
        return {
            tokens,
            user: googleUser,
        };
    }

    async fetchMessageIds(gmail: gmail_v1.Gmail, query: string, maxResults = 500): Promise<string[]> {
        const ids: string[] = [];
        let pageToken: string | undefined;

        this.log.info(`Fetching messages with query: "${query.substring(0, 100)}..."`);
        do {
            const response = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: Math.min(maxResults - ids.length, 500),
                pageToken,
            });
            const data = response.data as GmailMessageListResponse;
            if (data.messages) {
                for (const msg of data.messages) {
                    ids.push(msg.id);
                }
            }
            pageToken = data.nextPageToken || undefined;
            if (ids.length % 100 === 0 && ids.length > 0) {
                this.log.info(`  Fetched ${ids.length} message IDs so far...`);
            }
        } while (pageToken && ids.length < maxResults);
        this.log.info(`Total message IDs fetched: ${ids.length}`);
        return ids;
    }

    async fetchMessages(gmail: gmail_v1.Gmail, messageIds: string[], batchSize = 20): Promise<GmailParsedMessage[]> {
        const parsed: GmailParsedMessage[] = [];
        for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(id =>
                    gmail.users.messages.get({
                        userId: 'me',
                        id,
                        format: 'full',
                    })
                )
            );
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const raw = result.value.data as unknown as GmailRawMessage;
                    try {
                        const message = this.parseMessage(raw);
                        const attachments = this.extractAttachments(raw.payload);
                        message.attachments = attachments;
                        parsed.push(message);
                    } catch (err: any) {
                        this.log.warn(`Failed to parse message ${raw.id}: ${err.message}`);
                    }
                }
            }
            if (i + batchSize < messageIds.length) {
                await this.sleep(200); // Rate limit
            }
            if ((i + batchSize) % 100 === 0) {
                this.log.info(`  Fetched ${Math.min(i + batchSize, messageIds.length)}/${messageIds.length} messages`);
            }
        }
        return parsed;
    }

    private parseMessage(raw: GmailRawMessage): GmailParsedMessage {
        const headers = raw.payload.headers || [];
        const getHeader = (name: string) => headers.find((h: GmailHeader) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        const textBody = this.extractBody(raw.payload, 'text/plain');
        const htmlBody = this.extractBody(raw.payload, 'text/html');
        return {
            id: raw.id,
            threadId: raw.threadId,
            from: getHeader('From'),
            to: getHeader('To'),
            subject: getHeader('Subject'),
            date: new Date(parseInt(raw.internalDate)),
            textBody,
            htmlBody,
            snippet: raw.snippet,
            attachments: [],
            attachmentTexts: {},
        };
    }

    private extractBody(payload: GmailRawMessage['payload'], mimeType: string): string {
        if (payload.mimeType === mimeType && payload.body?.data) {
            return this.decodeBase64Url(payload.body.data);
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                const result = this.extractBodyFromPart(part, mimeType);
                if (result) return result;
            }
        }

        return '';
    }

    private extractBodyFromPart(part: GmailMessagePart, mimeType: string): string {
        if (part.mimeType === mimeType && part.body?.data) {
            return this.decodeBase64Url(part.body.data);
        }

        if (part.parts) {
            for (const subPart of part.parts) {
                const result = this.extractBodyFromPart(subPart, mimeType);
                if (result) return result;
            }
        }

        return '';
    }

    private extractAttachments(payload: GmailRawMessage['payload']): GmailAttachment[] {
        const attachments: GmailAttachment[] = [];
        this.walkPartsForAttachments(payload.parts || [], attachments);
        return attachments;
    }

    private walkPartsForAttachments(parts: GmailMessagePart[], result: GmailAttachment[]): void {
        for (const part of parts) {
            if (part.filename && part.body?.attachmentId) {
                result.push({
                    attachmentId: part.body.attachmentId,
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size || 0,
                });
            }
            if (part.parts) {
                this.walkPartsForAttachments(part.parts, result);
            }
        }
    }

    async fetchAttachmentData(gmail: gmail_v1.Gmail, messageId: string, attachmentId: string): Promise<Buffer> {
        const response = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId,
        });
        const data = response.data.data;
        if (!data) throw new Error('Empty attachment data');
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64');
    }

    private decodeBase64Url(data: string): string {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64').toString('utf-8');
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export const gmailPlugin = new GmailPlugin();
