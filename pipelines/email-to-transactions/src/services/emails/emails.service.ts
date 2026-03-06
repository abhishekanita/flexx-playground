import { IRawEmailsDoc, RawEmailsModel } from '@/schema/raw-emails.schema';
import { BaseService } from '../base-service';

class RawEmailsService extends BaseService<IRawEmailsDoc> {
    constructor() {
        super(RawEmailsModel);
    }

    async getLatestEmail(userId: string) {
        return this.model.findOne({ userId }, { receivedAt: 1 }, { sort: { receivedAt: -1 } });
    }

    async saveEmail() {
        //
    }
}

export const rawEmailsService = new RawEmailsService();
