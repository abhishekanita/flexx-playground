/**
 * Full one-time Gmail dump: seed → auth → fetch → filter → parse → store → stats.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/scripts/gmail/run-gmail-dump.ts
 */
import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { EmailSenderModel, FinancialEmailModel, EmailProcessingTemplateModel } from '@/schema';
import { ALL_SEED_SENDERS } from '@/services/gmail/seed/email-senders.seed';
import { GmailService } from '@/services/gmail/gmail.service';
import logger from '@/utils/logger';

async function main() {
    const log = logger.createServiceLogger('GmailDump');

    log.info('Connecting to database...');
    await databaseLoader();

    // ─── Step 0: Ensure senders are seeded ───────────────────────────────────
    const senderCount = await EmailSenderModel.countDocuments({ status: 'active' });
    if (senderCount < 10) {
        log.info('Seeding email senders (first run)...');
        let inserted = 0;
        for (const seed of ALL_SEED_SENDERS) {
            try {
                await EmailSenderModel.create({ ...seed, matchCount: 0 });
                inserted++;
            } catch {
                // Skip duplicates
            }
        }
        log.green(`Seeded ${inserted} senders`);
    } else {
        log.info(`${senderCount} active senders already in DB`);
    }

    // ─── Run the dump ────────────────────────────────────────────────────────
    const service = new GmailService();

    const monthsBack = parseInt(process.env.MONTHS_BACK || '3', 10);
    log.info(`\nStarting Gmail dump (last ${monthsBack} months)...\n`);

    const result = await service.runFullDump(monthsBack);

    // ─── Print summary ───────────────────────────────────────────────────────
    service.printSummary(result);

    // ─── Print DB stats ──────────────────────────────────────────────────────
    const emailCount = await FinancialEmailModel.countDocuments({ connectionId: result.connectionId });
    const templateCount = await EmailProcessingTemplateModel.countDocuments();
    const pendingSenders = await EmailSenderModel.countDocuments({ status: 'pending_review' });

    log.info('\n  ── DB State ──');
    log.info(`  financial-emails:            ${emailCount}`);
    log.info(`  email-processing-templates:  ${templateCount}`);
    log.info(`  pending_review senders:      ${pendingSenders}`);

    // Category breakdown
    const categories = await FinancialEmailModel.aggregate([
        { $match: { connectionId: result.connectionId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    if (categories.length > 0) {
        log.info('\n  ── Categories ──');
        for (const cat of categories) {
            log.info(`  ${cat._id}: ${cat.count}`);
        }
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
