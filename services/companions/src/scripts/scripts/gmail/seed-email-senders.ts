/**
 * Seed the email-senders collection with known Indian financial senders.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/scripts/gmail/seed-email-senders.ts
 */
import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { EmailSenderModel } from '@/schema';
import { ALL_SEED_SENDERS } from '@/services/gmail/seed/email-senders.seed';
import logger from '@/utils/logger';

async function main() {
    const log = logger.createServiceLogger('SeedEmailSenders');

    log.info('Connecting to database...');
    await databaseLoader();

    log.info(`Seeding ${ALL_SEED_SENDERS.length} email senders...`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const seed of ALL_SEED_SENDERS) {
        try {
            const existing = await EmailSenderModel.findOne({ emailPattern: seed.emailPattern });
            if (existing) {
                skipped++;
                continue;
            }

            await EmailSenderModel.create({
                ...seed,
                matchCount: 0,
            });
            inserted++;
        } catch (err: any) {
            if (err.code === 11000) {
                skipped++;
            } else {
                log.error(`Failed to insert ${seed.emailPattern}: ${err.message}`);
                errors++;
            }
        }
    }

    log.green(`\nSeed complete: ${inserted} inserted, ${skipped} skipped (already exist), ${errors} errors`);

    // Print summary by category
    const categories = await EmailSenderModel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    log.info('\nSenders by category:');
    for (const cat of categories) {
        log.info(`  ${cat._id}: ${cat.count}`);
    }

    const total = await EmailSenderModel.countDocuments();
    log.info(`\nTotal senders in DB: ${total}`);

    process.exit(0);
}

main();
