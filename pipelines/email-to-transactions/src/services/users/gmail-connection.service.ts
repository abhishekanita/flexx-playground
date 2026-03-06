import { IGmailConnectionDoc } from '@playground/schema';
import { BaseService } from '../base-service';
import { GmailConnectionModel } from '@/schema';
import { Types } from 'mongoose';

class GmailConnectionService extends BaseService<IGmailConnectionDoc> {
    constructor() {
        super(GmailConnectionModel);
    }

    async getCredentials(userId: string) {
        const credential = await this.model.findOne({ userId: new Types.ObjectId(userId) });
        console.log(credential);
        if (credential && credential?.accessToken) return credential;
        return null;
    }

    async refreshTokens(userId: string) {
        // try {
        //     const credentials = await this.getCredentials(userId);
        //     if (!credentials.refreshToken) throw new Error('');
        //     const
        //     const freshToken = await gmailPlugin.refreshAccessToken(credentials.refreshToken);
        //     logger.info('Access token refreshed successfully');
        //     return freshToken;
        // } catch (err: any) {
        //     throw new Error(`Token refresh failed, using existing: ${err.message}`);
        // }
    }
}

export const gmailConnectionService = new GmailConnectionService();
