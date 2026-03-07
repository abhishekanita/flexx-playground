// =============================================================================
// Seed script — imports all existing parsers into the parser-configs collection
// =============================================================================
// Run: npx ts-node --files -r tsconfig-paths/register src/scripts/scripts/seed-parser-configs.ts

import { PARSER_CONFIGS } from '@/pipelines/parsers/helpers/parser-registry';
import { ParserConfigModel } from '@/schema/parser-configs.schema';
import { ParserConfig } from '@/types/pipelines/parser-config.type';

const now = new Date().toISOString();

const emptyStats = (): ParserConfig['stats'] => ({
    totalAttempts: 0,
    successCount: 0,
    failCount: 0,
    emptyResultCount: 0,
    successRate: 0,
    avgConfidence: 0,
    fieldStats: {},
    versionHistory: [{ version: 1, activatedAt: now, successRate: 0, totalAttempts: 0 }],
});

// =============================================================================

export async function seedParserConfigs() {
    let inserted = 0;
    let skipped = 0;
    let updated = 0;

    await ParserConfigModel.deleteMany({});

    for (const config of PARSER_CONFIGS) {
        const existing = await ParserConfigModel.findOne({ slug: config.slug });

        if (existing) {
            // Update match rules, attachment config, source — but preserve stats
            await ParserConfigModel.updateOne(
                { slug: config.slug },
                {
                    $set: {
                        name: config.name,
                        provider: config.provider,
                        match: config.match,
                        source: config.source,
                        attachment: config.attachment,
                        strategy: config.strategy,
                        codeModule: config.codeModule,
                        declarativeRules: config.declarativeRules,
                        domain: config.domain,
                        stats: emptyStats(),
                    },
                }
            );
            updated++;
            logger.info(`[Seed] Updated: ${config.slug}`);
        } else {
            await ParserConfigModel.create(config);
            inserted++;
            logger.info(`[Seed] Inserted: ${config.slug}`);
        }
    }

    logger.info(`[Seed] Done: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
}

// Run directly
if (require.main === module) {
    require('@/loaders/logger');
    const initServer = require('@/loaders').default;
    initServer().then(async () => {
        await seedParserConfigs();
        process.exit(0);
    });
}
