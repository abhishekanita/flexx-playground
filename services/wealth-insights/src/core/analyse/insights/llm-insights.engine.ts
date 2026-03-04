/**
 * LLM Insights Engine — orchestrator for the narrative layer.
 *
 * Two-layer architecture:
 *   Layer 1 (Statistical): BehavioralAnalyser + AnomalyDetector (pure computation)
 *   Layer 2 (Narrative): NarrativeGenerator (LLM-powered via Vercel AI SDK + OpenAI)
 *
 * The engine works without LLM — it produces structured signals and anomalies
 * even if the OPENAI_API_KEY is missing. LLM narratives are additive.
 *
 * Updated to produce InsightCardsResult alongside the legacy LLMInsightsResult.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { LLMInsightsResult } from '@/types/analysis/insights.type';
import { InsightCardsResult } from '@/types/analysis/insight-cards.type';
import { BehavioralAnalyser, BehavioralSignals } from './behavioral.analyser';
import { AnomalyDetector, DetectedAnomaly } from './anomaly.detector';
import { NarrativeGenerator, LLMCallUsage } from './narrative.generator';
import { config } from '@/config';

export interface InsightsEngineResult {
    /** Pre-computed behavioral signals (always available) */
    behavioral: BehavioralSignals;
    /** Pre-computed anomalies (always available) */
    anomalies: DetectedAnomaly[];
    /** Legacy LLM-generated narratives (null if LLM unavailable or skipped) */
    narratives: LLMInsightsResult | null;
    /** New InsightCards output (null if LLM unavailable or skipped) */
    insightCards: InsightCardsResult | null;
    /** Token usage per LLM call (empty if no LLM calls made) */
    llmUsage: LLMCallUsage[];
    /** Number of gap cards found */
    gapCardsFound: number;
}

export interface InsightsOptions {
    /** Skip LLM calls — only compute statistical signals */
    skipLLM?: boolean;
}

export class LLMInsightsEngine {
    /**
     * Generate insights from analysis results.
     *
     * @param data - Raw parsed statement data (for behavioral analysis)
     * @param analysis - Completed analysis result (from AnalysisEngine)
     * @param options - Configuration
     */
    async generateInsights(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
        options?: InsightsOptions
    ): Promise<InsightsEngineResult> {
        // ── Layer 1: Statistical computation (always runs) ──
        console.log('  [Insights] Computing behavioral signals...');
        const behavioral = BehavioralAnalyser.analyse(data, analysis);

        console.log('  [Insights] Detecting anomalies...');
        const anomalies = AnomalyDetector.detect(data, analysis);

        console.log(
            `  [Insights] Found ${anomalies.length} anomalies (${anomalies.filter(a => a.severity === 'critical').length} critical)`
        );

        const emptyNarratives: LLMInsightsResult = {
            headline: '',
            performanceStory: '',
            holdingInsights: [],
            behavioralObservation: '',
            riskExplanation: '',
            whatIfNarratives: [],
            anomalies: AnomalyDetector.toInsights(anomalies),
        };

        // ── Layer 2: LLM narratives (optional) ──
        if (options?.skipLLM) {
            console.log('  [Insights] LLM skipped — returning statistical insights only');
            return { behavioral, anomalies, narratives: emptyNarratives, insightCards: null, llmUsage: [], gapCardsFound: 0 };
        }

        // Check for API key (Vercel AI SDK reads OPENAI_API_KEY automatically)
        if (!config.openai.apiKey) {
            console.log('  [Insights] No OPENAI_API_KEY — returning statistical insights only');
            return { behavioral, anomalies, narratives: emptyNarratives, insightCards: null, llmUsage: [], gapCardsFound: 0 };
        }

        console.log('  [Insights] Generating InsightCards (OpenAI via Vercel AI SDK)...');
        try {
            const generator = new NarrativeGenerator();
            const insightCards = await generator.generate(analysis, behavioral, anomalies);
            console.log(`  [Insights] Generated ${insightCards.cards.length} insight cards`);

            // Gap detection: review existing cards and surface missed insights
            console.log('  [Insights] Running gap detection agent...');
            const gapCards = await generator.detectGaps(analysis, insightCards.cards);
            if (gapCards.length > 0) {
                console.log(`  [Insights] Gap agent found ${gapCards.length} additional insight(s)`);
                insightCards.cards.push(...gapCards);
                insightCards.cards.sort((a, b) => a.priority - b.priority);
            } else {
                console.log('  [Insights] Gap agent found no additional insights');
            }

            // Also populate the analysis object directly
            analysis.insightCards = insightCards;

            return { behavioral, anomalies, narratives: emptyNarratives, insightCards, llmUsage: generator.getUsage(), gapCardsFound: gapCards.length };
        } catch (err) {
            console.warn('  [Insights] InsightCards generation failed:', (err as Error).message);
            return { behavioral, anomalies, narratives: emptyNarratives, insightCards: null, llmUsage: [], gapCardsFound: 0 };
        }
    }
}
