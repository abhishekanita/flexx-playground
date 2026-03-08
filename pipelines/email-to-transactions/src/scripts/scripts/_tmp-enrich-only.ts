import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { EnrichmentStage } from '@/pipelines/enrichment/enrichment.stage';

const USER_ID = '69ad593fb3726a47dec36515';

async function main() {
    await databaseLoader();
    const enrichment = new EnrichmentStage();
    const stats = await enrichment.enrichAll(USER_ID);
    console.log('\n=== RESULTS ===');
    console.log(JSON.stringify(stats, null, 2));
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
