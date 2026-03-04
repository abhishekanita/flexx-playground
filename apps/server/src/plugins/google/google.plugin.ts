import { config } from '@/config';
import { google, Common } from 'googleapis';
import axios from 'axios';
import { AppError } from '@/definitions/exceptions/AppError';

export interface GmailMessage {
    subject: string;
    from: string;
    date: string;
    bodyText: string;
}

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

class GooglePlugin {
    private auth: Common.OAuth2Client;

    constructor() {
        this.auth = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
    }

    public getAuthUrl(state: string) {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
        ];

        return this.auth.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
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
                throw new AppError(error.message);
            });
        return googleUser;
    }

    public getGmailAuthUrl(state: string) {
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/gmail.readonly',
        ];

        return this.auth.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: scopes,
            redirect_uri: config.google.redirectUrl,
            state: state || '',
        });
    }

    public async getGmailTokensAndUser(code: string) {
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
                throw new AppError(error.message);
            });
        return {
            user: googleUser,
            tokens: {
                accessToken: tokens.access_token || '',
                refreshToken: tokens.refresh_token || '',
                scopes: (tokens.scope || '').split(' '),
            },
        };
    }
    public async searchEmails(
        accessToken: string,
        refreshToken: string,
        query: string,
        maxResults: number = 5
    ): Promise<GmailMessage[]> {
        const oauth2Client = new google.auth.OAuth2(
            config.google.clientId,
            config.google.clientSecret,
            config.google.redirectUrl
        );
        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const listRes = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults,
        });

        const messageIds = listRes.data.messages || [];
        const results: GmailMessage[] = [];

        for (const msg of messageIds) {
            if (!msg.id) continue;

            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'full',
            });

            const headers = detail.data.payload?.headers || [];
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            const from = headers.find(h => h.name === 'From')?.value || '';
            const date = headers.find(h => h.name === 'Date')?.value || '';

            const bodyText = this.extractBodyText(detail.data.payload);

            results.push({ subject, from, date, bodyText });
        }

        return results;
    }

    private extractBodyText(payload: any): string {
        if (!payload) return '';

        // Try plain text part first
        if (payload.mimeType === 'text/plain' && payload.body?.data) {
            return Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }

        // Search multipart parts
        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    return Buffer.from(part.body.data, 'base64').toString('utf-8');
                }
            }
            // Fallback: strip HTML
            for (const part of payload.parts) {
                if (part.mimeType === 'text/html' && part.body?.data) {
                    const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                }
            }
            // Recurse into nested multipart
            for (const part of payload.parts) {
                const nested = this.extractBodyText(part);
                if (nested) return nested;
            }
        }

        // Fallback: HTML body on root payload
        if (payload.mimeType === 'text/html' && payload.body?.data) {
            const html = Buffer.from(payload.body.data, 'base64').toString('utf-8');
            return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        return '';
    }
}

export default new GooglePlugin();
