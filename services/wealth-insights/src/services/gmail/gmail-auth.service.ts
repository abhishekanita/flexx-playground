import { config } from '@/config';
import { gmailPlugin } from '@/plugins/google/gmail.plugin';
import { GmailConnectionModel, IGmailConnectionDoc } from '@/schema/connections/gmail-connection.schema';
import { google } from 'googleapis';
import { BaseService } from '../base-service';

class GmailAuthService extends BaseService<IGmailConnectionDoc> {
    constructor() {
        super(GmailConnectionModel);
    }

    async createGmailConnection(code: string) {
        const { tokens, user } = await gmailPlugin.getTokensAndUser(code);
        if (!tokens.refresh_token) {
            logger.warn(`No refresh token received for ${user.email}`);
        }
        const userData = {
            email: user.email,
            googleId: user.id,
            name: user.name,
            picture: user.picture || '',
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || '',
            tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
            scopes: tokens.scope?.split(' ') || [],
            isActive: true,
        };
        const connection = await this.model.findOneAndUpdate({ email: userData.email }, { $set: userData }, { upsert: true, new: true });
        return connection;
    }

    async getGmailClient(email: string) {
        const connection = await this.model
            .findOne({
                email: email,
            })
            .lean();
        if (!connection) {
            throw new Error('No Gmail connection found for');
        }
        const oauth2 = new google.auth.OAuth2(config.google.clientId, config.google.clientSecret, config.google.redirectUrl);
        oauth2.setCredentials({
            access_token: connection.accessToken,
            refresh_token: connection.refreshToken,
            expiry_date: new Date(connection.tokenExpiresAt).getTime(),
        });
        const gmail = google.gmail({ version: 'v1', auth: oauth2 });
        return gmail;
    }
}

export const gmailAuthService = new GmailAuthService();
