import { TokenUsage, CostBreakdown } from '@/utils/ai-cost';

export type JobType = 'insights_generation' | 'statement_acquisition' | 'sync';
export type JobStatus = 'running' | 'completed' | 'failed';

export interface JobAIUsage {
    model: string;
    calls: number;
    tokens: TokenUsage;
    cost: CostBreakdown;
}

export interface JobRun {
    /** Which user this job ran for (null for system-level jobs) */
    pan: string | null;
    email: string | null;

    /** Job identification */
    jobType: JobType;
    jobId: string;
    trigger: 'initial' | 'sync' | 'scheduled' | 'manual';

    /** Status tracking */
    status: JobStatus;
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    error: string | null;

    /** AI usage — one entry per model used */
    aiUsage: JobAIUsage[];
    totalAICostUsd: number;
    totalTokens: number;

    /** Output metrics (what the job produced) */
    metrics: {
        /** Insight cards generated (for insights_generation jobs) */
        insightCardsGenerated: number | null;
        /** Anomalies detected */
        anomaliesDetected: number | null;
        /** Gap cards found by gap agent */
        gapCardsFound: number | null;
        /** Dashboard data computed */
        dashboardComputed: boolean;
        /** Whether this was the first run for this user or incremental */
        isFirstRun: boolean;
        /** Analysis version produced */
        analysisVersion: number | null;
    };

    /** Freeform context for debugging */
    context: Record<string, string | number | boolean>;
}
