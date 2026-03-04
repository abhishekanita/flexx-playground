import { BaseService } from '../base-service';
import { IInsightStateDoc, InsightStateModel } from '@/schema/user/user-insight-states.schema';
import { InsightKey, InsightStatus, ConditionResult } from '@/types/advisory/insight-state.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { BehavioralSignals } from '@/core/analyse/modules/dashboard-data.computer';
import { CONDITION_REGISTRY, INSIGHT_METADATA } from '@/core/advisory/conditions';
import { cardJourneyService } from './card-journey.service';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('InsightStateService');

export class InsightStateService extends BaseService<IInsightStateDoc> {
    constructor() {
        super(InsightStateModel);
    }

    /**
     * Run all 18 condition evaluators and upsert insight states with transition logic.
     */
    async evaluateAndUpsert(
        pan: string,
        analysis: PortfolioAnalysis,
        behavioral?: BehavioralSignals,
    ): Promise<{ ready: number; pending: number; total: number }> {
        const now = new Date();
        const keys = Object.keys(CONDITION_REGISTRY) as InsightKey[];
        let readyCount = 0;
        let pendingCount = 0;

        for (const key of keys) {
            const evaluator = CONDITION_REGISTRY[key];
            const meta = INSIGHT_METADATA[key];
            const result: ConditionResult = evaluator(analysis, behavioral);

            // Fetch existing state
            const existing = await this.model.findOne({ pan, insightKey: key });

            const nextStatus = this.resolveTransition(existing?.status ?? null, result.met, meta.frequencyType, existing?.snoozeUntil ?? null, now);

            const update: any = {
                pan,
                insightKey: key,
                category: meta.category,
                frequencyType: meta.frequencyType,
                status: nextStatus,
                conditionMet: result.met,
                conditionValue: result.value,
                relevanceScore: result.score,
                lastEvaluatedAt: now,
            };

            if (result.met && !existing?.firstTriggeredAt) {
                update.firstTriggeredAt = now;
            }

            const doc = await this.model.findOneAndUpdate(
                { pan, insightKey: key },
                { $set: update },
                { upsert: true, new: true },
            );

            // Assemble card journey when transitioning to READY
            if (nextStatus === 'READY' && result.met) {
                try {
                    const journey = await cardJourneyService.assembleAndStore(pan, key, result.value, analysis);
                    if (journey?._id) {
                        await this.model.findOneAndUpdate(
                            { pan, insightKey: key },
                            { $set: { cardJourneyId: journey._id.toString() } },
                        );
                    }
                } catch (err: any) {
                    log.warn(`[${pan.slice(-4)}] Card journey assembly failed for ${key}: ${err.message}`);
                }
            }

            if (nextStatus === 'READY') readyCount++;
            else if (nextStatus === 'PENDING') pendingCount++;
        }

        log.info(`[${pan.slice(-4)}] Evaluated ${keys.length} insight conditions: ${readyCount} READY, ${pendingCount} PENDING`);
        return { ready: readyCount, pending: pendingCount, total: keys.length };
    }

    private resolveTransition(
        currentStatus: InsightStatus | null,
        met: boolean,
        frequency: string,
        snoozeUntil: Date | null,
        now: Date,
    ): InsightStatus {
        // New insight
        if (currentStatus === null) {
            return met ? 'READY' : 'PENDING';
        }

        switch (currentStatus) {
            case 'PENDING':
                return met ? 'READY' : 'PENDING';

            case 'READY':
                // READY stays READY even if not met (user must dismiss/view)
                return met ? 'READY' : 'PENDING';

            case 'SHOWN':
                // SHOWN stays SHOWN — user must dismiss
                return 'SHOWN';

            case 'DISMISSED':
                // Re-trigger for non-ONCE frequencies
                if (met && frequency !== 'ONCE') return 'READY';
                return 'DISMISSED';

            case 'SNOOZED':
                if (snoozeUntil && now > snoozeUntil && met) return 'READY';
                return 'SNOOZED';

            default:
                return met ? 'READY' : 'PENDING';
        }
    }

    async getReadyStates(pan: string, limit = 10): Promise<IInsightStateDoc[]> {
        return this.model
            .find({ pan, status: 'READY' })
            .sort({ relevanceScore: -1 })
            .limit(limit)
            .lean();
    }

    async getAllGrouped(pan: string): Promise<Record<string, IInsightStateDoc[]>> {
        const all = await this.model.find({ pan }).sort({ relevanceScore: -1 }).lean();
        const grouped: Record<string, IInsightStateDoc[]> = {
            health: [],
            tax: [],
            behavioral: [],
            whatif: [],
        };
        for (const state of all) {
            (grouped[state.category] ??= []).push(state);
        }
        return grouped;
    }

    async markShown(pan: string, insightKey: InsightKey): Promise<void> {
        await this.model.findOneAndUpdate(
            { pan, insightKey },
            { $set: { status: 'SHOWN', shownAt: new Date() } },
        );
    }

    async dismiss(pan: string, insightKey: InsightKey): Promise<void> {
        await this.model.findOneAndUpdate(
            { pan, insightKey },
            { $set: { status: 'DISMISSED', dismissedAt: new Date() } },
        );
    }

    async snooze(pan: string, insightKey: InsightKey, until: Date): Promise<void> {
        await this.model.findOneAndUpdate(
            { pan, insightKey },
            { $set: { status: 'SNOOZED', snoozeUntil: until } },
        );
    }
}

export const insightStateService = new InsightStateService();
