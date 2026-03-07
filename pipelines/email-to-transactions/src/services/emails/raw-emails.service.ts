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

    async resetEmailsStatus(includeParsed = false) {
        const statuses: string[] = ['unmatched'];
        if (includeParsed) {
            statuses.push('matched', 'parsed', 'parse_failed');
        }

        const result = await this.model.updateMany(
            { status: { $in: statuses } },
            {
                $set: { status: 'fetched', statusUpdatedAt: new Date().toISOString() },
                $unset: {
                    marchedParserId: '',
                    matchedParserVersion: '',
                    parsedData: '',
                    lastParseError: '',
                },
            }
        );

        logger.info(`[EmailService] Reset ${result.modifiedCount} emails to 'fetched' (includeParsed: ${includeParsed})`);
        return result;
    }
}

export const rawEmailsService = new RawEmailsService();
