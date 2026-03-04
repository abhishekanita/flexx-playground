import mongoose, { Schema, Document, Types } from 'mongoose';

export const CONTENT_CATEGORIES = [
	'market-pulse',
	'portfolio-update',
	'stock-deep-dive',
	'mf-watch',
	'news-digest',
	'comparison',
	'tax-tip',
	'rbi-update',
	'gold-commodity',
	'ipo-update',
	'week-review',
	'learn',
	'plan-ahead',
	'action-item',
	'crash-alert',
	'event-special',
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export interface IContentPieceTags {
	symbols: string[];
	schemeCodes: number[];
	sectors: string[];
	interests: string[];
	riskLevels: string[];
	incomeBrackets: string[];
	ageGroups: string[];
	isUniversal: boolean;
}

export interface IContentSource {
	title: string;
	url: string;
	source: string;
	articleId?: Types.ObjectId;
}

export interface IContentPiece extends Document {
	pipelineRunId: Types.ObjectId;
	date: Date;
	category: ContentCategory;
	subcategory: string;
	title: string;
	body: string;
	tldr: string;
	durationSeconds: number;
	tags: IContentPieceTags;
	sources: IContentSource[];
	modelId: string;
	promptTokens: number;
	completionTokens: number;
	costUSD: number;
	priority: number;
	status: 'draft' | 'published' | 'archived';
	createdAt: Date;
	updatedAt: Date;
}

const ContentPieceSchema = new Schema(
	{
		pipelineRunId: { type: Schema.Types.ObjectId, ref: 'PipelineRun', required: true },
		date: { type: Date, required: true },
		category: {
			type: String,
			enum: CONTENT_CATEGORIES,
			required: true,
		},
		subcategory: { type: String, default: '' },
		title: { type: String, required: true },
		body: { type: String, required: true },
		tldr: { type: String, required: true },
		durationSeconds: { type: Number, default: 30 },
		tags: {
			symbols: { type: [String], default: [] },
			schemeCodes: { type: [Number], default: [] },
			sectors: { type: [String], default: [] },
			interests: { type: [String], default: [] },
			riskLevels: { type: [String], default: [] },
			incomeBrackets: { type: [String], default: [] },
			ageGroups: { type: [String], default: [] },
			isUniversal: { type: Boolean, default: false },
		},
		sources: [
			{
				title: String,
				url: String,
				source: String,
				articleId: { type: Schema.Types.ObjectId, ref: 'NewsArticle' },
				_id: false,
			},
		],
		modelId: { type: String, default: '' },
		promptTokens: { type: Number, default: 0 },
		completionTokens: { type: Number, default: 0 },
		costUSD: { type: Number, default: 0 },
		priority: { type: Number, default: 3, min: 1, max: 5 },
		status: {
			type: String,
			enum: ['draft', 'published', 'archived'],
			default: 'draft',
		},
	},
	{ timestamps: true },
);

ContentPieceSchema.index({ date: -1, status: 1 });
ContentPieceSchema.index({ date: -1, 'tags.symbols': 1 });
ContentPieceSchema.index({ date: -1, 'tags.isUniversal': 1 });
ContentPieceSchema.index({ date: -1, 'tags.schemeCodes': 1 });
ContentPieceSchema.index({ pipelineRunId: 1 });

export const ContentPiece = mongoose.model<IContentPiece>('ContentPiece', ContentPieceSchema);
