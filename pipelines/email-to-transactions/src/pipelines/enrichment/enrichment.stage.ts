import { rawEmailsService } from '@/services/emails/raw-emails.service';
import { parserConfigService } from '@/services/parsers/parser-config.service';
import { transactionSignalService } from '@/services/transactions/transaction-signal.service';
import { getNormalizer, getInvestmentNormalizer, isInvestmentParser } from './normalizers/normalizer.registry';
import { findOrCreateTransaction } from './matcher';
import { enrichTransaction } from './enricher';
import { ingestInvestmentData, InvestmentIngestionResult } from './investment-ingester';
import { investmentTransactionService } from '@/services/investments/investment-transaction.service';
import { EnrichmentAction } from '@/types/financial-data/transactions.enums';
import { NormalizedSignal } from './normalizers/normalizer.types';

interface EnrichmentStats {
    processed: number;
    signalsGenerated: number;
    created: number;
    enriched: number;
    skipped: number;
    failed: number;
    noNormalizer: number;
    // Investment stats
    investmentProcessed: number;
    investmentAccountsUpserted: number;
    investmentHoldingsReplaced: number;
    investmentHoldingsInserted: number;
    investmentTransactionsCreated: number;
    investmentTransactionsDeduplicated: number;
    financialAccountsUpserted: number;
}

export class EnrichmentStage {
    constructor() {}

    async enrichAll(userId: string) {
        const emails = await rawEmailsService.find({
            userId,
            status: 'parsed',
            parsedData: { $exists: true },
        });

        // Build ObjectId → slug map from parser configs
        const configs = await parserConfigService.getActiveConfigs(userId);
        const idToSlug: Record<string, string> = {};
        for (const c of configs) {
            idToSlug[c._id.toString()] = c.slug;
            idToSlug[c.slug] = c.slug; // also support slug directly
        }
        logger.info(`[Enrichment] Found ${emails.length} parsed emails, ${configs.length} parser configs`);

        const stats: EnrichmentStats = {
            processed: 0,
            signalsGenerated: 0,
            created: 0,
            enriched: 0,
            skipped: 0,
            failed: 0,
            noNormalizer: 0,
            investmentProcessed: 0,
            investmentAccountsUpserted: 0,
            investmentHoldingsReplaced: 0,
            investmentHoldingsInserted: 0,
            investmentTransactionsCreated: 0,
            investmentTransactionsDeduplicated: 0,
            financialAccountsUpserted: 0,
        };

        for (const email of emails) {
            try {
                const parserId = email.marchedParserId;
                if (!parserId) {
                    stats.skipped++;
                    continue;
                }

                const parserSlug = idToSlug[parserId];
                if (!parserSlug) {
                    stats.noNormalizer++;
                    logger.warn(`[Enrichment] Unknown parser ID "${parserId}" — not in active configs`);
                    continue;
                }

                const rawExtracted = email.parsedData?.rawExtracted;
                if (!rawExtracted) {
                    stats.skipped++;
                    continue;
                }

                // Route by domain: investment vs spending
                if (isInvestmentParser(parserSlug)) {
                    await this.processInvestmentEmail(userId, email, parserSlug, rawExtracted, stats);
                } else {
                    await this.processSpendingEmail(userId, email, parserSlug, rawExtracted, stats);
                }

                stats.processed++;
            } catch (err: any) {
                stats.failed++;
                logger.error(`[Enrichment] Failed "${email.subject}": ${err.message}`);
                await rawEmailsService.update(
                    { _id: email._id },
                    {
                        status: 'insert_failed',
                        statusUpdatedAt: new Date().toISOString(),
                        lastInsertError: err.message,
                        $inc: { insertAttempts: 1 },
                    }
                );
            }
        }

        logger.info(
            `[Enrichment] Done: ${stats.processed} emails processed, ` +
            `${stats.signalsGenerated} signals, ${stats.created} created, ` +
            `${stats.enriched} enriched, ${stats.skipped} skipped, ` +
            `${stats.failed} failed, ${stats.noNormalizer} no normalizer`
        );

        if (stats.investmentProcessed > 0) {
            logger.info(
                `[Enrichment] Investments: ${stats.investmentProcessed} emails, ` +
                `${stats.investmentAccountsUpserted} accounts, ` +
                `${stats.investmentHoldingsReplaced + stats.investmentHoldingsInserted} holdings, ` +
                `${stats.investmentTransactionsCreated} txns created, ` +
                `${stats.investmentTransactionsDeduplicated} deduped, ` +
                `${stats.financialAccountsUpserted} financial accounts`
            );
        }

        return stats;
    }

    private async processSpendingEmail(
        userId: string,
        email: any,
        parserSlug: string,
        rawExtracted: Record<string, any>,
        stats: EnrichmentStats
    ) {
        const normalizer = getNormalizer(parserSlug);
        if (!normalizer) {
            stats.noNormalizer++;
            logger.warn(`[Enrichment] No normalizer for parser "${parserSlug}"`);
            return;
        }

        // Check if already processed
        const alreadyProcessed = await transactionSignalService.existsForEmail(
            email._id.toString()
        );
        if (alreadyProcessed) {
            stats.skipped++;
            return;
        }

        const signals: NormalizedSignal[] = normalizer(rawExtracted, {
            rawEmailId: email._id.toString(),
            receivedAt: email.receivedAt,
        });

        stats.signalsGenerated += signals.length;

        for (const signal of signals) {
            const { txn, action, confidence } = await findOrCreateTransaction(userId, signal);

            if (action === EnrichmentAction.Create) {
                stats.created++;
                await transactionSignalService.create({
                    transaction_id: txn._id.toString(),
                    source_type: signal.sourceType,
                    source_id: email._id.toString(),
                    raw_email_id: email._id.toString(),
                    parsed_data: signal.rawParsed,
                    confidence: signal.confidence,
                    fields_contributed: ['*'],
                    received_at: new Date(email.receivedAt),
                } as any);
            } else if (action === EnrichmentAction.Enrich || action === EnrichmentAction.EnrichWithReview) {
                await enrichTransaction(
                    txn,
                    signal,
                    email._id.toString(),
                    new Date(email.receivedAt)
                );
                stats.enriched++;

                if (action === EnrichmentAction.EnrichWithReview) {
                    logger.warn(
                        `[Enrichment] Low-confidence match (${confidence.toFixed(2)}) for "${email.subject}" → txn ${txn._id}`
                    );
                }
            }
        }

        // Mark email as inserted
        await rawEmailsService.update(
            { _id: email._id },
            {
                status: 'inserted',
                statusUpdatedAt: new Date().toISOString(),
                insertionResult: {
                    success: true,
                    action: signals.length > 0 ? 'created' : 'skipped_duplicate',
                    targetTable: 'transactions',
                    insertedAt: new Date().toISOString(),
                },
            }
        );
    }

    private async processInvestmentEmail(
        userId: string,
        email: any,
        parserSlug: string,
        rawExtracted: Record<string, any>,
        stats: EnrichmentStats
    ) {
        const normalizer = getInvestmentNormalizer(parserSlug);
        if (!normalizer) {
            stats.noNormalizer++;
            logger.warn(`[Enrichment] No investment normalizer for parser "${parserSlug}"`);
            return;
        }

        // Check if already processed
        const alreadyProcessed = await investmentTransactionService.existsForEmail(
            email._id.toString()
        );
        if (alreadyProcessed) {
            stats.skipped++;
            return;
        }

        const normalized = normalizer(rawExtracted, {
            rawEmailId: email._id.toString(),
            receivedAt: email.receivedAt,
        });

        const result = await ingestInvestmentData(
            userId,
            normalized,
            email._id.toString(),
            new Date(email.receivedAt)
        );

        stats.investmentProcessed++;
        stats.investmentAccountsUpserted += result.accountsUpserted;
        stats.investmentHoldingsReplaced += result.holdingsReplaced;
        stats.investmentHoldingsInserted += result.holdingsInserted;
        stats.investmentTransactionsCreated += result.transactionsCreated;
        stats.investmentTransactionsDeduplicated += result.transactionsDeduplicated;
        stats.financialAccountsUpserted += result.financialAccountsUpserted;

        // Mark email as inserted
        await rawEmailsService.update(
            { _id: email._id },
            {
                status: 'inserted',
                statusUpdatedAt: new Date().toISOString(),
                insertionResult: {
                    success: true,
                    action: 'investment_ingested',
                    targetTable: 'investment-transactions',
                    insertedAt: new Date().toISOString(),
                    details: result,
                },
            }
        );
    }
}
