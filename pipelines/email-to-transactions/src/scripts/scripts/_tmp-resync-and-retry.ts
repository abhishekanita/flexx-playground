import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { ParserStage } from '@/pipelines/parsers/parsers.stage';
import { EnrichmentStage } from '@/pipelines/enrichment/enrichment.stage';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    // Step 1: Re-sync parser configs to MongoDB
    const { ParserConfigModel } = require('@/schema/parser-configs.schema');
    const { RawEmailsModel } = require('@/schema/raw-emails.schema');

    let updated = 0;
    for (const config of PARSER_CONFIGS) {
        const { id, _id, ...rest } = config as any;
        const result = await ParserConfigModel.updateOne(
            { slug: config.slug },
            { $set: rest },
            { upsert: true }
        );
        if (result.modifiedCount > 0 || result.upsertedCount > 0) updated++;
    }
    console.log(`Synced ${updated} parser configs to MongoDB`);

    // Step 2: Reset parse_failed (the 221 PDF failures) back to fetched
    const resetResult = await RawEmailsModel.updateMany(
        { userId: USER_ID, status: 'parse_failed' },
        { $set: { status: 'fetched', statusUpdatedAt: new Date().toISOString() }, $unset: { lastParseError: 1 } }
    );
    console.log(`Reset ${resetResult.modifiedCount} parse_failed emails back to fetched`);

    // Step 3: Run parser
    console.log('\n=== PARSER STAGE ===');
    const parser = new ParserStage();
    await parser.parseAll(USER_ID);

    // Step 4: Run enrichment
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
