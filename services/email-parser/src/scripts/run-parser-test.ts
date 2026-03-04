/**
 * Test parser configs against real emails already in the database.
 * Run after run-pipeline.ts has fetched & classified emails.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/run-parser-test.ts [senderKey]
 *
 * Examples:
 *   npx ts-node -r tsconfig-paths/register src/scripts/run-parser-test.ts         # test all
 *   npx ts-node -r tsconfig-paths/register src/scripts/run-parser-test.ts swiggy   # test swiggy only
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { RawEmail } from '@/schema/raw-email.schema';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';
import { templateApplier } from '@/services/parse/template-applier';
import chalk from 'chalk';

async function main() {
    await databaseLoader();

    const senderKeyFilter = process.argv[2];

    // Load configs
    const stats = await parserConfigLoader.loadFromDisk();
    logger.info(`Loaded ${stats.parserConfigs} parser configs`);

    // Find classified emails
    const query: Record<string, any> = { status: { $in: ['classified', 'parsed', 'enriched'] } };
    if (senderKeyFilter) query.senderKey = senderKeyFilter;

    const emails = await RawEmail.find(query).sort({ senderKey: 1, date: -1 });
    logger.info(`Found ${emails.length} emails to test${senderKeyFilter ? ` (senderKey: ${senderKeyFilter})` : ''}`);

    if (emails.length === 0) {
        logger.info('No emails found. Run the pipeline first: npx ts-node -r tsconfig-paths/register src/scripts/run-pipeline.ts');
        process.exit(0);
    }

    // Group by senderKey
    const bySender = new Map<string, typeof emails>();
    for (const email of emails) {
        const key = email.senderKey || 'unknown';
        if (!bySender.has(key)) bySender.set(key, []);
        bySender.get(key)!.push(email);
    }

    let totalSuccess = 0;
    let totalFail = 0;
    let totalNoConfig = 0;

    for (const [senderKey, senderEmails] of bySender) {
        console.log(`\n${chalk.bold.cyan(`=== ${senderKey} (${senderEmails.length} emails) ===`)}`);

        let success = 0;
        let fail = 0;

        for (const email of senderEmails.slice(0, 5)) { // Test max 5 per sender
            const config = parserConfigLoader.getParserConfig(
                email.fromDomain,
                email.subject,
                email.date
            );

            if (!config) {
                console.log(`  ${chalk.yellow('SKIP')} ${email.subject.substring(0, 60)} — no parser config`);
                totalNoConfig++;
                continue;
            }

            if (config.extraction.method === 'template' && config.extraction.template) {
                const result = templateApplier.apply(email.bodyHtml, config.extraction.template);

                if (result.fieldsExtracted > 0) {
                    console.log(
                        `  ${chalk.green('PASS')} ${email.subject.substring(0, 50)} — ` +
                        `${result.fieldsExtracted} fields, ${result.lineItems.length} items`
                    );
                    // Print extracted data
                    for (const [key, val] of Object.entries(result.extractedData)) {
                        console.log(`    ${chalk.dim(key)}: ${val}`);
                    }
                    if (result.lineItems.length > 0) {
                        console.log(`    ${chalk.dim('lineItems')}: ${result.lineItems.length} items`);
                        for (const item of result.lineItems.slice(0, 3)) {
                            console.log(`      - ${item.name || '?'}: ₹${item.price || '?'}`);
                        }
                    }
                    success++;
                    totalSuccess++;
                } else {
                    console.log(
                        `  ${chalk.red('FAIL')} ${email.subject.substring(0, 50)} — ` +
                        `0 fields extracted, ${result.errors.length} errors`
                    );
                    for (const err of result.errors.slice(0, 3)) {
                        console.log(`    ${chalk.dim(err)}`);
                    }
                    fail++;
                    totalFail++;
                }
            } else if (config.extraction.method === 'llm') {
                console.log(
                    `  ${chalk.blue('LLM')} ${email.subject.substring(0, 50)} — ` +
                    `requires LLM extraction (skipping in test mode)`
                );
                totalNoConfig++;
            } else if (config.extraction.method.startsWith('pdf')) {
                console.log(
                    `  ${chalk.blue('PDF')} ${email.subject.substring(0, 50)} — ` +
                    `requires PDF extraction (skipping in test mode)`
                );
                totalNoConfig++;
            }
        }

        if (success + fail > 0) {
            const rate = ((success / (success + fail)) * 100).toFixed(0);
            console.log(chalk.dim(`  → ${success}/${success + fail} passed (${rate}%)`));
        }
    }

    console.log(`\n${chalk.bold('=== Summary ===')}`);
    console.log(`  Template success: ${chalk.green(totalSuccess.toString())}`);
    console.log(`  Template failed:  ${chalk.red(totalFail.toString())}`);
    console.log(`  Skipped (no config/LLM/PDF): ${chalk.yellow(totalNoConfig.toString())}`);

    const total = totalSuccess + totalFail;
    if (total > 0) {
        console.log(`  Success rate: ${((totalSuccess / total) * 100).toFixed(1)}%`);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
