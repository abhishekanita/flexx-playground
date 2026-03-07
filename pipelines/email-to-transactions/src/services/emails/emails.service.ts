import { IRawEmailsDoc, RawEmailsModel } from '@/schema/raw-emails.schema';
import { BaseService } from '../base-service';

class RawEmailsService extends BaseService<IRawEmailsDoc> {
    constructor() {
        super(RawEmailsModel);
    }

    async getLatestEmail(userId: string) {
        return this.model.findOne({ userId }, { receivedAt: 1 }, { sort: { receivedAt: -1 } });
    }

    async getEmailsToBeMatched(userId?: string) {
        const query: any = { status: { $in: ['fetched', 'unmatched'] } };
        if (userId) query.userId = userId;
        return this.model.find(query);
    }

    async resetEmailsStatus(includeParsed?: true) {
        //unmatched -> fetched
        //matched || parsed also to fetched
    }
}

export const rawEmailsService = new RawEmailsService();
