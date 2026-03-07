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
        if (credential && credential?.accessToken) return credential;
        return null;
    }
}

export const gmailConnectionService = new GmailConnectionService();
