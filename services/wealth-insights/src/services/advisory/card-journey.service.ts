import { BaseService } from '../base-service';
import { ICardJourneyDoc, CardJourneyModel } from '@/schema/user/user-card-journeys.schema';
import { JourneyCard } from '@/types/advisory/card-journey.type';
import { InsightKey } from '@/types/advisory/insight-state.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { JOURNEY_TEMPLATES } from '@/core/advisory/journeys/templates';
import { resolveLiveBindings } from '@/core/advisory/journeys/resolve-bindings';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('CardJourneyService');

export class CardJourneyService extends BaseService<ICardJourneyDoc> {
    constructor() {
        super(CardJourneyModel);
    }

    /**
     * Build a card journey from a template and store it.
     */
    async assembleAndStore(
        pan: string,
        insightKey: InsightKey,
        conditionValue: any,
        analysis: PortfolioAnalysis,
    ): Promise<ICardJourneyDoc> {
        const template = JOURNEY_TEMPLATES[insightKey];
        if (!template) {
            throw new Error(`No journey template for insight key: ${insightKey}`);
        }

        const { cards, snapshotValues } = template.build(conditionValue);

        // Resolve placeholders using snapshot values
        const resolvedCards = resolveLiveBindings(cards, snapshotValues, analysis);

        const doc = await this.model.findOneAndUpdate(
            { pan, insightKey },
            {
                $set: {
                    pan,
                    insightKey,
                    cards: resolvedCards,
                    assembledAt: new Date(),
                    snapshotValues,
                },
            },
            { upsert: true, new: true },
        );

        log.info(`[${pan.slice(-4)}] Card journey assembled for ${insightKey} (${resolvedCards.length} cards)`);
        return doc;
    }

    /**
     * Fetch stored journey and re-resolve live bindings against latest analysis.
     */
    async getResolved(
        pan: string,
        insightKey: InsightKey,
        analysis: PortfolioAnalysis,
    ): Promise<JourneyCard[] | null> {
        const doc = await this.model.findOne({ pan, insightKey }).lean();
        if (!doc) return null;

        return resolveLiveBindings(doc.cards, doc.snapshotValues, analysis);
    }
}

export const cardJourneyService = new CardJourneyService();
