import { Types } from 'mongoose';
import { SyncRun, ISyncRunDoc } from '@/schema/sync-run.schema';
import type { SyncTrigger, StageStatus, SyncStats } from '@/types/financial.types';

export class SyncRunService {
    async createRun(
        userId: Types.ObjectId,
        integrationId: Types.ObjectId,
        trigger: SyncTrigger
    ): Promise<ISyncRunDoc> {
        return SyncRun.create({ userId, integrationId, trigger });
    }

    async updateStage(
        run: ISyncRunDoc,
        stageName: string,
        status: StageStatus,
        metadata?: Record<string, any>
    ): Promise<void> {
        const stage = run.stages.find((s) => s.name === stageName);
        if (!stage) return;

        stage.status = status;
        if (status === 'running') stage.startedAt = new Date();
        if (status === 'completed' || status === 'failed') stage.completedAt = new Date();
        if (metadata) stage.metadata = metadata;
        await run.save();
    }

    async completeRun(run: ISyncRunDoc, stats: Partial<SyncStats>): Promise<void> {
        run.status = 'completed';
        Object.assign(run.stats, stats);
        await run.save();
    }

    async failRun(run: ISyncRunDoc, error: string): Promise<void> {
        run.status = 'failed';
        run.error = error;
        await run.save();
    }

    async getLatestRun(userId: Types.ObjectId): Promise<ISyncRunDoc | null> {
        return SyncRun.findOne({ userId }, {}, { sort: { createdAt: -1 } });
    }
}

export const syncRunService = new SyncRunService();
