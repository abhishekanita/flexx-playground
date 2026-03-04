import { Types } from 'mongoose';
import { ISyncRunDoc } from '@/schema/sync-run.schema';
import { syncRunService } from '@/services/sync/sync-run.service';
import { emailSyncService } from '@/services/sync/email-sync.service';
import { emailClassifierService } from '@/services/classify/email-classifier.service';
import { parserConfigLoader } from '@/services/parse/parser-config-loader';
import { parserEngineService } from '@/services/parse/parser-engine.service';
import { reconciliationService } from '@/services/reconcile/reconciliation.service';
import type { SyncTrigger } from '@/types/financial.types';

export interface PipelineOptions {
    userId: Types.ObjectId;
    integrationId: Types.ObjectId;
    accessToken: string;
    refreshToken: string;
    trigger: SyncTrigger;
}

export class PipelineOrchestrator {
    async runPipeline(options: PipelineOptions): Promise<ISyncRunDoc> {
        const { userId, integrationId, trigger } = options;
        const startTime = Date.now();

        // Stage 0: Init
        const run = await syncRunService.createRun(userId, integrationId, trigger);
        logger.info(`[Pipeline] Starting run ${run._id} for user ${userId} (trigger: ${trigger})`);

        try {
            await syncRunService.updateStage(run, 'init', 'running');

            // Load/refresh parser configs
            await parserConfigLoader.loadFromDisk();

            await syncRunService.updateStage(run, 'init', 'completed');

            // Stage 1: Search & Fetch
            await syncRunService.updateStage(run, 'search-fetch', 'running');

            const syncResult = await emailSyncService.syncEmails(
                userId,
                integrationId,
                options.accessToken,
                options.refreshToken
            );

            await syncRunService.updateStage(run, 'search-fetch', 'completed', {
                fetched: syncResult.fetched,
                new: syncResult.newEmails,
                duplicates: syncResult.skippedDuplicates,
            });

            // Stage 2: Classify
            await syncRunService.updateStage(run, 'classify', 'running');

            const classifyResult = await emailClassifierService.classifyEmails(userId);

            await syncRunService.updateStage(run, 'classify', 'completed', {
                classified: classifyResult.classified,
                unclassified: classifyResult.unclassified,
                byCategory: classifyResult.byCategory,
            });

            // Stage 3: Parse
            await syncRunService.updateStage(run, 'parse', 'running');

            const parseResult = await parserEngineService.parseEmails(
                userId,
                options.accessToken,
                options.refreshToken
            );

            await syncRunService.updateStage(run, 'parse', 'completed', {
                parsed: parseResult.parsed,
                failed: parseResult.failed,
                skipped: parseResult.skipped,
                llmCostUSD: parseResult.llmCostUSD,
            });

            // Stage 4: Reconcile
            await syncRunService.updateStage(run, 'reconcile', 'running');

            const reconcileResult = await reconciliationService.reconcile(userId);

            await syncRunService.updateStage(run, 'reconcile', 'completed', {
                transactionsCreated: reconcileResult.transactionsCreated,
                transactionsEnriched: reconcileResult.transactionsEnriched,
                invoicesCreated: reconcileResult.invoicesCreated,
                statementsCreated: reconcileResult.statementsCreated,
                duplicatesSkipped: reconcileResult.duplicatesSkipped,
            });

            // Stage 5: Finalize
            await syncRunService.updateStage(run, 'finalize', 'running');

            const totalTimeMs = Date.now() - startTime;

            await syncRunService.completeRun(run, {
                emailsFetched: syncResult.fetched,
                emailsNew: syncResult.newEmails,
                emailsClassified: classifyResult.classified,
                emailsParsed: parseResult.parsed,
                emailsFailed: parseResult.failed,
                emailsSkipped: classifyResult.unclassified + parseResult.skipped,
                transactionsCreated: reconcileResult.transactionsCreated,
                transactionsEnriched: reconcileResult.transactionsEnriched,
                invoicesCreated: reconcileResult.invoicesCreated,
                llmCostUSD: parseResult.llmCostUSD,
                totalTimeMs,
            });

            await syncRunService.updateStage(run, 'finalize', 'completed');

            logger.info(`[Pipeline] Run ${run._id} completed in ${totalTimeMs}ms — ${syncResult.newEmails} new emails, ${classifyResult.classified} classified`);

            return run;
        } catch (err: any) {
            logger.error(`[Pipeline] Run ${run._id} failed: ${err.message}`);
            await syncRunService.failRun(run, err.message);
            return run;
        }
    }
}

export const pipelineOrchestrator = new PipelineOrchestrator();
