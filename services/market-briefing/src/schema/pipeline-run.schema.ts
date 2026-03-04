import mongoose, { Schema, Document } from 'mongoose';

export type PipelineTrigger = 'daily-cron' | 'event:crash' | 'event:rbi' | 'manual';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface IPipelineStage {
	name: string;
	status: StageStatus;
	startedAt?: Date;
	completedAt?: Date;
	metadata?: Record<string, any>;
}

export interface IPipelineStats {
	totalUsers: number;
	uniqueSymbols: number;
	uniqueSchemes: number;
	uniqueInterests: number;
	contentPiecesGenerated: number;
	totalLLMCost: number;
	dataFetchTimeMs: number;
	contentGenTimeMs: number;
	totalTimeMs: number;
}

export interface IPipelineRun extends Document {
	date: Date;
	trigger: PipelineTrigger;
	status: 'running' | 'completed' | 'failed';
	stages: IPipelineStage[];
	stats: IPipelineStats;
	error?: string;
	createdAt: Date;
}

const PipelineStageSchema = new Schema(
	{
		name: { type: String, required: true },
		status: {
			type: String,
			enum: ['pending', 'running', 'completed', 'failed'],
			default: 'pending',
		},
		startedAt: Date,
		completedAt: Date,
		metadata: { type: Schema.Types.Mixed, default: {} },
	},
	{ _id: false },
);

const PipelineRunSchema = new Schema(
	{
		date: { type: Date, required: true },
		trigger: {
			type: String,
			enum: ['daily-cron', 'event:crash', 'event:rbi', 'manual'],
			required: true,
		},
		status: {
			type: String,
			enum: ['running', 'completed', 'failed'],
			default: 'running',
		},
		stages: { type: [PipelineStageSchema], default: [] },
		stats: {
			totalUsers: { type: Number, default: 0 },
			uniqueSymbols: { type: Number, default: 0 },
			uniqueSchemes: { type: Number, default: 0 },
			uniqueInterests: { type: Number, default: 0 },
			contentPiecesGenerated: { type: Number, default: 0 },
			totalLLMCost: { type: Number, default: 0 },
			dataFetchTimeMs: { type: Number, default: 0 },
			contentGenTimeMs: { type: Number, default: 0 },
			totalTimeMs: { type: Number, default: 0 },
		},
		error: String,
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

PipelineRunSchema.index({ date: -1 });
PipelineRunSchema.index({ status: 1 });

export const PipelineRun = mongoose.model<IPipelineRun>('PipelineRun', PipelineRunSchema);
