import { SyncEmailStage } from './email-sync/email-sync.stage';
import { ParserStage } from './parsers/parsers.stage';
import { EnrichmentStage } from './enrichment/enrichment.stage';

export class EmailPipelineWorkflow {
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async run() {
        await this.syncEmails();
        // await this.matchAndParseEmails();
        // await this.upsertAndEnrichTrxns();
    }

    //@Stage-1
    async syncEmails() {
        const emailSync = new SyncEmailStage();
        const results = await emailSync.syncEmailBulk(this.userId);
        console.log('results', results);
    }

    //@Stage-2
    async matchAndParseEmails() {
        const parser = new ParserStage();
        await parser.parseAll(this.userId);
    }

    //@Stage-3
    async upsertAndEnrichTrxns() {
        const enrichment = new EnrichmentStage();
        return enrichment.enrichAll(this.userId);
    }
}
