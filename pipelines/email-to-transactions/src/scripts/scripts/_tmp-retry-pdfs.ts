import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { ParserStage } from '@/pipelines/parsers/parsers.stage';
import { EnrichmentStage } from '@/pipelines/enrichment/enrichment.stage';
import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();

    const { ParserConfigModel } = require('@/schema/parser-configs.schema');
    const { RawEmailsModel } = require('@/schema/raw-emails.schema');

    // Sync updated configs
    for (const config of PARSER_CONFIGS) {
        const { id, _id, ...rest } = config as any;
        await ParserConfigModel.updateOne({ slug: config.slug }, { $set: rest }, { upsert: true });
    }
    console.log('Configs synced');

    // Reset only the PDF failures
    const resetResult = await RawEmailsModel.updateMany(
        { userId: USER_ID, status: 'parse_failed' },
        { $set: { status: 'fetched', statusUpdatedAt: new Date().toISOString() }, $unset: { lastParseError: 1 } }
    );
    console.log(`Reset ${resetResult.modifiedCount} parse_failed → fetched`);

    // Run parser
    const parser = new ParserStage();
    await parser.parseAll(USER_ID);

    // Run enrichment
    const enrichment = new EnrichmentStage();
    const stats = await enrichment.enrichAll(USER_ID);
    console.log('\n=== RESULTS ===');
    console.log(JSON.stringify(stats, null, 2));

    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
