import { BaseService } from '../base-service';
import { IMFUserInsightsDoc, MFUserInsightsModel } from '@/schema/user/user-insights.schema';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { DashboardData } from '@/types/analysis/dashboard-data.type';
import { InsightCardsResult } from '@/types/analysis/insight-cards.type';
import { AnalysisEngine, AnalysisOptions } from '@/core/analyse/analysis-engine';
import { computeDashboardData, BehavioralSignals } from '@/core/analyse/modules/dashboard-data.computer';
import { insightStateService } from '@/services/advisory/insight-state.service';
import { jobRunService } from '../job-run.service';
import { calculateCost } from '@/utils/ai-cost';
import { JobAIUsage } from '@/types/storage/job-run.type';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('InsightsService');

export class InsightsService extends BaseService<IMFUserInsightsDoc> {
    private analysisEngine = new AnalysisEngine();

    constructor() {
        super(MFUserInsightsModel);
    }

    /**
     * Run full analysis + dashboard computation + optional LLM insights.
     * Stores result in mfs.user.insights.
     */
    async generateAndStore(
        pan: string,
        email: string,
        data: MFDetailedStatementData,
        trigger: 'initial' | 'sync' | 'scheduled' | 'manual' = 'sync',
        analysisOptions?: AnalysisOptions,
    ): Promise<IMFUserInsightsDoc | null> {
        const startTime = Date.now();

        // Get current version
        const latest = await this.getLatest(pan);
        const nextVersion = (latest?.version || 0) + 1;
        const isFirstRun = !latest;

        // Start job tracking
        const jobId = await jobRunService.startJob({
            pan,
            email,
            jobType: 'insights_generation',
            trigger,
            isFirstRun,
            context: { version: nextVersion, activeFolios: data.folios.filter(f => f.closingUnitBalance > 0).length },
        });

        try {
            // Step 1: Run analysis
            log.info(`[${pan.slice(-4)}] Running analysis (v${nextVersion}, trigger=${trigger})...`);
            const analysis = await this.analysisEngine.analyse(data, undefined, analysisOptions);

            // Step 2: Compute dashboard data (pure computation, always succeeds)
            log.info(`[${pan.slice(-4)}] Computing dashboard data...`);
            const dashboardData = computeDashboardData(analysis);

            // Step 3: Generate insight cards (LLM, may fail gracefully)
            let insightCards: InsightCardsResult | null = null;
            let insightCardsStatus: 'pending' | 'ready' | 'failed' = 'pending';
            let llmCostUsd = 0;
            let aiUsage: JobAIUsage[] = [];
            let anomaliesDetected = 0;
            let gapCardsFound = 0;

            try {
                log.info(`[${pan.slice(-4)}] Generating LLM insight cards...`);
                const insightsResult = await this.analysisEngine.generateInsights(data, analysis);

                anomaliesDetected = insightsResult.anomalies.length;
                gapCardsFound = insightsResult.gapCardsFound;

                if (insightsResult.narratives) {
                    analysis.insights = insightsResult.narratives;
                }

                // Build AI usage from actual token data
                if (insightsResult.llmUsage.length > 0) {
                    const byModel = new Map<string, { calls: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; cacheWriteTokens: number }>();
                    for (const call of insightsResult.llmUsage) {
                        const entry = byModel.get(call.model) ?? { calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 };
                        entry.calls++;
                        entry.inputTokens += call.inputTokens;
                        entry.outputTokens += call.outputTokens;
                        entry.cachedInputTokens += call.cachedInputTokens;
                        entry.cacheWriteTokens += call.cacheWriteTokens;
                        byModel.set(call.model, entry);
                    }

                    for (const [model, usage] of byModel) {
                        try {
                            const cost = calculateCost(model, {
                                inputTokens: usage.inputTokens,
                                outputTokens: usage.outputTokens,
                                cachedInputTokens: usage.cachedInputTokens,
                                cacheWriteTokens: usage.cacheWriteTokens,
                            });
                            aiUsage.push({
                                model,
                                calls: usage.calls,
                                tokens: {
                                    inputTokens: usage.inputTokens,
                                    outputTokens: usage.outputTokens,
                                    cachedInputTokens: usage.cachedInputTokens,
                                    cacheWriteTokens: usage.cacheWriteTokens,
                                },
                                cost,
                            });
                            llmCostUsd += cost.totalCost;
                        } catch {
                            // Unknown model pricing — still track tokens without cost
                            aiUsage.push({
                                model,
                                calls: usage.calls,
                                tokens: {
                                    inputTokens: usage.inputTokens,
                                    outputTokens: usage.outputTokens,
                                    cachedInputTokens: usage.cachedInputTokens,
                                    cacheWriteTokens: usage.cacheWriteTokens,
                                },
                                cost: { inputCost: 0, cachedInputCost: 0, cacheWriteCost: 0, outputCost: 0, totalCost: 0 },
                            });
                        }
                    }
                }

                if (analysis.insightCards) {
                    insightCards = analysis.insightCards;
                    insightCardsStatus = 'ready';
                }
            } catch (err: any) {
                log.warn(`[${pan.slice(-4)}] LLM insights failed: ${err.message}`);
                insightCardsStatus = 'failed';
            }

            // Step 4: Store
            const now = new Date();
            const nextRefresh = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

            const result = await this.model.findOneAndUpdate(
                { pan, version: nextVersion },
                {
                    $set: {
                        pan,
                        email,
                        version: nextVersion,
                        generatedAt: now,
                        trigger,
                        dashboardData,
                        insightCards,
                        insightCardsStatus,
                        analysis,
                        nextScheduledRefresh: nextRefresh,
                        llmCostUsd,
                    },
                },
                { upsert: true, new: true }
            );

            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            log.info(`[${pan.slice(-4)}] Insights v${nextVersion} stored (${elapsed}s, cards=${insightCardsStatus}, cost=$${llmCostUsd.toFixed(4)})`);

            // Step 5: Run advisory insight state evaluation (fire-and-forget)
            insightStateService.evaluateAndUpsert(pan, analysis).catch(err =>
                log.warn(`[${pan.slice(-4)}] Advisory insight evaluation failed: ${err.message}`)
            );

            // Complete job tracking
            await jobRunService.completeJob(jobId, {
                aiUsage,
                metrics: {
                    insightCardsGenerated: insightCards?.cards.length ?? 0,
                    anomaliesDetected,
                    gapCardsFound,
                    dashboardComputed: true,
                    analysisVersion: nextVersion,
                },
            }).catch(err => log.warn(`[${pan.slice(-4)}] Job tracking failed: ${err.message}`));

            return result;
        } catch (err: any) {
            log.error(`[${pan.slice(-4)}] Insights generation failed: ${err.message}`);
            await jobRunService.failJob(jobId, err.message).catch(() => {});
            throw err;
        }
    }

    async getLatest(pan: string): Promise<IMFUserInsightsDoc | null> {
        return this.model.findOne({ pan }).sort({ generatedAt: -1 }).lean();
    }

    async getDashboardData(pan: string): Promise<DashboardData | null> {
        const latest = await this.getLatest(pan);
        return latest?.dashboardData || null;
    }

    async getInsightCards(pan: string): Promise<InsightCardsResult | null> {
        const latest = await this.getLatest(pan);
        return latest?.insightCards || null;
    }
}

export const insightsService = new InsightsService();
