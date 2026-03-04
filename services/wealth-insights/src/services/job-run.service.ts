import { randomUUID } from 'crypto';
import { BaseService } from './base-service';
import { IJobRunDoc, JobRunModel } from '@/schema/job-runs.schema';
import { JobType, JobStatus, JobAIUsage } from '@/types/storage/job-run.type';

export class JobRunService extends BaseService<IJobRunDoc> {
    constructor() {
        super(JobRunModel);
    }

    /**
     * Start tracking a new job run. Returns the jobId for later updates.
     */
    async startJob(opts: {
        pan?: string | null;
        email?: string | null;
        jobType: JobType;
        trigger: 'initial' | 'sync' | 'scheduled' | 'manual';
        isFirstRun?: boolean;
        context?: Record<string, string | number | boolean>;
    }): Promise<string> {
        const jobId = randomUUID();
        await this.create({
            pan: opts.pan ?? null,
            email: opts.email ?? null,
            jobType: opts.jobType,
            jobId,
            trigger: opts.trigger,
            status: 'running',
            startedAt: new Date(),
            completedAt: null,
            durationMs: null,
            error: null,
            aiUsage: [],
            totalAICostUsd: 0,
            totalTokens: 0,
            metrics: {
                insightCardsGenerated: null,
                anomaliesDetected: null,
                gapCardsFound: null,
                dashboardComputed: false,
                isFirstRun: opts.isFirstRun ?? false,
                analysisVersion: null,
            },
            context: opts.context ?? {},
        } as any);
        return jobId;
    }

    /**
     * Mark a job as completed with its results.
     */
    async completeJob(jobId: string, result: {
        aiUsage?: JobAIUsage[];
        metrics?: Partial<IJobRunDoc['metrics']>;
        context?: Record<string, string | number | boolean>;
    }): Promise<void> {
        const job = await this.model.findOne({ jobId });
        if (!job) return;

        const now = new Date();
        const durationMs = now.getTime() - job.startedAt.getTime();

        const aiUsage = result.aiUsage ?? [];
        const totalAICostUsd = aiUsage.reduce((sum, u) => sum + u.cost.totalCost, 0);
        const totalTokens = aiUsage.reduce(
            (sum, u) => sum + u.tokens.inputTokens + u.tokens.outputTokens,
            0
        );

        await this.model.updateOne(
            { jobId },
            {
                $set: {
                    status: 'completed' as JobStatus,
                    completedAt: now,
                    durationMs,
                    aiUsage,
                    totalAICostUsd,
                    totalTokens,
                    ...(result.metrics ? { metrics: { ...job.metrics, ...result.metrics } } : {}),
                    ...(result.context ? { context: { ...job.context, ...result.context } } : {}),
                },
            }
        );
    }

    /**
     * Mark a job as failed.
     */
    async failJob(jobId: string, error: string): Promise<void> {
        const job = await this.model.findOne({ jobId });
        if (!job) return;

        const now = new Date();
        const durationMs = now.getTime() - job.startedAt.getTime();

        await this.model.updateOne(
            { jobId },
            {
                $set: {
                    status: 'failed' as JobStatus,
                    completedAt: now,
                    durationMs,
                    error,
                },
            }
        );
    }

    /** Get the most recent job run for a PAN */
    async getLatestForPan(pan: string): Promise<IJobRunDoc | null> {
        return this.model.findOne({ pan }).sort({ startedAt: -1 }).lean();
    }

    /** Get recent job runs (for debugging / monitoring) */
    async getRecent(limit = 20): Promise<IJobRunDoc[]> {
        return this.model.find().sort({ startedAt: -1 }).limit(limit).lean();
    }

    /** Get recent runs by type */
    async getRecentByType(jobType: JobType, limit = 20): Promise<IJobRunDoc[]> {
        return this.model.find({ jobType }).sort({ startedAt: -1 }).limit(limit).lean();
    }

    /** Get failed jobs for investigation */
    async getFailedJobs(limit = 50): Promise<IJobRunDoc[]> {
        return this.model.find({ status: 'failed' }).sort({ startedAt: -1 }).limit(limit).lean();
    }

    /** Get total AI cost for a date range */
    async getTotalCost(since: Date): Promise<{ totalCost: number; jobCount: number }> {
        const result = await this.model.aggregate([
            { $match: { startedAt: { $gte: since }, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    totalCost: { $sum: '$totalAICostUsd' },
                    jobCount: { $sum: 1 },
                },
            },
        ]);
        return result[0] ?? { totalCost: 0, jobCount: 0 };
    }
}

export const jobRunService = new JobRunService();
