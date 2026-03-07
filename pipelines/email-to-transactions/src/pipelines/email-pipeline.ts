import { SyncEmailStage } from './email-sync/email-sync.stage';
import { ParserStage } from './parsers/parsers.stage';

export class EmailPipelineWorkflow {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async run() {
        await this.syncEmails();
    }

    //@Stage-1
    async syncEmails() {
        const syncQueryIds = [];
        const lookbackMonths = 3;
        const emailSync = new SyncEmailStage();
        const results = await emailSync.syncEmailBulk(this.userId, syncQueryIds, lookbackMonths);
    }

    //@Stage-2
    async matchAndParseEmails() {
        const parser = new ParserStage();
        await parser.parseAll(this.userId);
    }

    //@Stage-3
    async upsertAndEnrichTrxns() {
        //
    }
}
