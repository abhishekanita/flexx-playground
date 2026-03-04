import { google, gmail_v1 } from 'googleapis';
import * as http from 'http';
import * as url from 'url';
import { exec } from 'child_process';
import { config } from '@/config';
import { GmailOAuthTokens, GmailParsedMessage, GmailAttachment } from './gmail.type';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const OAUTH_PORT = 3456;

export class GmailPlugin {
    private createOAuth2Client(): OAuth2Client {
        return new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl,
        );
    }

    /**
     * Interactive OAuth: opens browser, catches redirect, returns tokens + email.
     */
    async authenticateInteractive(): Promise<GmailOAuthTokens> {
        const oauth2Client = this.createOAuth2Client();

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent',
        });

        return new Promise<GmailOAuthTokens>((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    const parsedUrl = url.parse(req.url || '', true);
                    if (parsedUrl.pathname !== '/oauth/callback') return;

                    const code = parsedUrl.query.code as string;
                    if (!code) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Missing authorization code</h1>');
                        reject(new Error('Missing authorization code'));
                        return;
                    }

                    const { tokens } = await oauth2Client.getToken(code);
                    oauth2Client.setCredentials(tokens);

                    // Fetch email from userinfo
                    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
                    const { data: userInfo } = await oauth2.userinfo.get();
                    const email = userInfo.email || '';

                    const expiresAt = tokens.expiry_date
                        ? new Date(tokens.expiry_date)
                        : new Date(Date.now() + 3600 * 1000);

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication successful!</h1><p>You can close this tab.</p>');

                    server.close();

                    resolve({
                        accessToken: tokens.access_token!,
                        refreshToken: tokens.refresh_token!,
                        email,
                        expiresAt,
                    });
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<h1>Authentication failed</h1>');
                    server.close();
                    reject(err);
                }
            });

            server.listen(OAUTH_PORT, () => {
                console.log(`OAuth callback server listening on port ${OAUTH_PORT}`);
                console.log(`Opening browser for authentication...`);

                // Open browser (macOS: open, Linux: xdg-open, Windows: start)
                const openCmd = process.platform === 'darwin'
                    ? 'open'
                    : process.platform === 'win32'
                        ? 'start'
                        : 'xdg-open';

                exec(`${openCmd} "${authUrl}"`);
            });

            server.on('error', (err) => {
                reject(new Error(`Failed to start OAuth server: ${err.message}`));
            });
        });
    }

    /**
     * Create an authenticated Gmail client from existing tokens.
     */
    authenticateWithTokens(accessToken: string, refreshToken: string): gmail_v1.Gmail {
        const oauth2Client = this.createOAuth2Client();
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        return google.gmail({ version: 'v1', auth: oauth2Client });
    }

    /**
     * List message IDs matching a Gmail query.
     */
    async fetchMessageIds(
        gmail: gmail_v1.Gmail,
        query: string,
        maxResults: number = 500,
    ): Promise<string[]> {
        const ids: string[] = [];
        let pageToken: string | undefined;

        do {
            const res = await gmail.users.messages.list({
                userId: 'me',
                q: query,
                maxResults: Math.min(maxResults - ids.length, 100),
                pageToken,
            });

            const messages = res.data.messages || [];
            for (const msg of messages) {
                if (msg.id) ids.push(msg.id);
            }

            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken && ids.length < maxResults);

        return ids;
    }

    /**
     * Fetch full messages (headers + body + attachment metadata) by IDs.
     * Processes in batches of 10 to avoid rate limits.
     */
    async fetchMessages(
        gmail: gmail_v1.Gmail,
        messageIds: string[],
    ): Promise<GmailParsedMessage[]> {
        const parsed: GmailParsedMessage[] = [];
        const batchSize = 10;

        for (let i = 0; i < messageIds.length; i += batchSize) {
            const batch = messageIds.slice(i, i + batchSize);

            const results = await Promise.allSettled(
                batch.map(id =>
                    gmail.users.messages.get({
                        userId: 'me',
                        id,
                        format: 'full',
                    }),
                ),
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const msg = this.parseMessage(result.value.data);
                    if (msg) parsed.push(msg);
                }
            }
        }

        return parsed;
    }

    /**
     * Download a specific attachment as a Buffer.
     */
    async fetchAttachment(
        gmail: gmail_v1.Gmail,
        messageId: string,
        attachmentId: string,
    ): Promise<Buffer> {
        const res = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId,
        });

        const data = res.data.data;
        if (!data) throw new Error(`Empty attachment data for ${attachmentId}`);

        // Gmail returns base64url-encoded data
        return Buffer.from(data, 'base64url');
    }

    // ─── Internal: MIME parsing ─────────────────────────────────────────────

    private parseMessage(message: gmail_v1.Schema$Message): GmailParsedMessage | null {
        if (!message.id || !message.payload) return null;

        const headers = message.payload.headers || [];
        const getHeader = (name: string): string => {
            const h = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
            return h?.value || '';
        };

        const dateStr = getHeader('Date');
        const date = dateStr ? new Date(dateStr) : new Date();

        let textBody: string | undefined;
        let htmlBody: string | undefined;
        const attachments: GmailAttachment[] = [];

        // Recursively walk MIME parts
        this.walkParts(message.payload, (part) => {
            const mimeType = part.mimeType || '';
            const filename = part.filename || '';
            const bodyData = part.body?.data;
            const bodySize = part.body?.size || 0;
            const attachmentId = part.body?.attachmentId;

            if (attachmentId && filename) {
                // This is an attachment
                attachments.push({
                    filename,
                    mimeType,
                    size: bodySize,
                    attachmentId,
                });
            } else if (mimeType === 'text/plain' && bodyData && !textBody) {
                textBody = Buffer.from(bodyData, 'base64url').toString('utf-8');
            } else if (mimeType === 'text/html' && bodyData && !htmlBody) {
                htmlBody = Buffer.from(bodyData, 'base64url').toString('utf-8');
            }
        });

        return {
            id: message.id,
            threadId: message.threadId || message.id,
            from: getHeader('From'),
            to: getHeader('To') || undefined,
            subject: getHeader('Subject'),
            date,
            snippet: message.snippet || '',
            textBody,
            htmlBody,
            attachments,
            attachmentTexts: {},
        };
    }

    private walkParts(
        part: gmail_v1.Schema$MessagePart,
        callback: (part: gmail_v1.Schema$MessagePart) => void,
    ): void {
        callback(part);
        if (part.parts) {
            for (const child of part.parts) {
                this.walkParts(child, callback);
            }
        }
    }
}

export const gmailPlugin = new GmailPlugin();
