import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { folioService } from './folio.service';
import { transactionService } from './transaction.service';
import { snapshotService } from './snapshot.service';
import { insightsService } from './insights.service';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('SyncService');

export interface SyncResult {
    pan: string;
    foliosUpserted: number;
    transactionsInserted: number;
    transactionsDuplicated: number;
    snapshotUpdated: boolean;
    insightsTriggered: boolean;
}

export class SyncService {
    /**
     * Main sync entry point. Called after a statement is parsed.
     *
     * 1. Extract PAN
     * 2. Upsert folios
     * 3. Bulk insert transactions (dedup via unique index)
     * 4. Recompute snapshot
     * 5. Trigger insights (async, non-blocking)
     */
    async sync(data: MFDetailedStatementData, requestId?: string): Promise<SyncResult> {
        const pan = data.investor.pan;
        const email = data.investor.email;
        if (!pan) {
            throw new Error('Cannot sync: no PAN found in statement data');
        }
        if (!email) {
            throw new Error('Cannot sync: no email found in statement data');
        }

        const startTime = Date.now();
        log.info(`[${pan.slice(-4)}] Starting sync (${data.folios.length} folios)...`);

        // Check transaction count before sync to detect new data
        const txCountBefore = await transactionService.getTransactionCount(pan);

        // Step 1 & 2: Upsert folios + bulk insert transactions in parallel
        const [foliosUpserted, txResult] = await Promise.all([
            folioService.upsertFromStatement(pan, email, data),
            transactionService.bulkInsertFromStatement(pan, email, data),
        ]);

        // Backfill email on any existing transactions that don't have it
        const backfilled = await transactionService.backfillEmail(pan, email);
        if (backfilled > 0) {
            log.info(`[${pan.slice(-4)}] Backfilled email on ${backfilled} existing transactions`);
        }

        // Step 3: Recompute snapshot from stored folios
        const activeFolios = await folioService.getActiveFolios(pan);
        const snapshot = await snapshotService.recomputeSnapshot(pan, data, activeFolios);
        const snapshotUpdated = !!snapshot;

        // Step 4: Trigger insights (async, non-blocking)
        const hasNewTransactions = txResult.inserted > 0;
        const isFirstSync = txCountBefore === 0;
        let insightsTriggered = false;

        if (isFirstSync || hasNewTransactions) {
            insightsTriggered = true;
            const trigger = isFirstSync ? 'initial' as const : 'sync' as const;

            // Fire and forget -- don't block the sync response
            insightsService.generateAndStore(pan, email, data, trigger).catch(err => {
                log.error(`[${pan.slice(-4)}] Background insights generation failed: ${err.message}`);
            });
        } else {
            log.info(`[${pan.slice(-4)}] No new transactions detected, skipping insights regeneration`);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log.info(`[${pan.slice(-4)}] Sync complete in ${elapsed}s — folios: ${foliosUpserted}, new txns: ${txResult.inserted}, dupes: ${txResult.duplicates}`);

        return {
            pan,
            foliosUpserted,
            transactionsInserted: txResult.inserted,
            transactionsDuplicated: txResult.duplicates,
            snapshotUpdated,
            insightsTriggered,
        };
    }
}

export const syncService = new SyncService();
