import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { ParserStage } from '@/pipelines/parsers/parsers.stage';
import { EnrichmentStage } from '@/pipelines/enrichment/enrichment.stage';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // Step 1: Re-run parser on all unprocessed + previously failed emails
    // First reset parse_failed back to fetched so they get re-tried
    const { RawEmailsModel } = require('@/schema/raw-emails.schema');
    const resetResult = await RawEmailsModel.updateMany(
        { userId: USER_ID, status: 'parse_failed' },
        { $set: { status: 'fetched', statusUpdatedAt: new Date().toISOString() }, $unset: { lastParseError: 1 } }
    );
    console.log(`Reset ${resetResult.modifiedCount} parse_failed emails back to fetched`);

    // Step 2: Run parser stage
    console.log('\n=== PARSER STAGE ===');
    const parser = new ParserStage();
    await parser.parseAll(USER_ID);

    // Step 3: Run enrichment stage
    console.log('\n=== ENRICHMENT STAGE ===');
    const enrichment = new EnrichmentStage();
    const stats = await enrichment.enrichAll(USER_ID);
    console.log('\n=== ENRICHMENT RESULTS ===');
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
