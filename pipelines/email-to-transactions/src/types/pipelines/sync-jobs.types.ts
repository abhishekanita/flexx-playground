import { Types } from 'mongoose';

export type SyncTrigger = 'manual' | 'scheduled' | 'config-update' | 'new-connection';
export type SyncRunStatus = 'running' | 'completed' | 'failed';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface SyncStats {
    emailsFetched: number;
    emailsNew: number;
    emailsClassified: number;
    emailsParsed: number;
    emailsFailed: number;
    emailsSkipped: number;
    transactionsCreated: number;
    transactionsEnriched: number;
    invoicesCreated: number;
    llmCostUSD: number;
    totalTimeMs: number;
}

export interface SyncStage {
    name: string;
    status: StageStatus;
    startedAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
}

export interface EmailSyncRun {
    userId: Types.ObjectId;
    integrationId: string;
    trigger: SyncTrigger;
    status: SyncRunStatus;
    stages: SyncStage[];
    stats: SyncStats;
    error?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
