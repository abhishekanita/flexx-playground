import { SyncEmailStage } from './email-sync/email-sync.stage';
import { ParserStage } from './parsers/parsers.stage';

export class EmailPipeline {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async startPipeline(syncQueryIds?: string[], lookbackMonths = 3) {
        //STAGE-1
        if (syncQueryIds) {
            const emailSync = new SyncEmailStage();
            await emailSync.syncEmailsForUser(this.userId, syncQueryIds, lookbackMonths);
        }

        //STAGE-2
        const parser = new ParserStage();
        await parser.parseAll(this.userId);
    }
}
