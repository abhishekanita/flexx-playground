import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';
import type { FeedCategory } from '@/plugins/rss-feeds/types';

export interface INewsArticle extends Document {
	pipelineRunId: Types.ObjectId;
	source: 'rss' | 'serp-news';
	sourceName: string;
	feedCategory?: FeedCategory;

	title: string;
	url: string;
	urlHash: string;
	description: string;
	content?: string;
	author?: string;
	imageUrl?: string;
	publishedAt?: Date;

	fetchedAt: Date;
	createdAt: Date;
	updatedAt: Date;
}

const NewsArticleSchema = new Schema(
	{
		pipelineRunId: { type: Schema.Types.ObjectId, ref: 'PipelineRun', required: true },
		source: {
			type: String,
			enum: ['rss', 'serp-news'],
			required: true,
		},
		sourceName: { type: String, required: true },
		feedCategory: {
			type: String,
			enum: ['markets', 'economy', 'mutual-funds', 'personal-finance', 'banking', 'general', 'regulatory', 'insurance', 'education'],
		},

		title: { type: String, required: true },
		url: { type: String, required: true },
		urlHash: { type: String, required: true },
		description: { type: String, default: '' },
		content: String,
		author: String,
		imageUrl: String,
		publishedAt: Date,

		fetchedAt: { type: Date, required: true },
	},
	{ timestamps: true },
);

NewsArticleSchema.index({ urlHash: 1 }, { unique: true });
NewsArticleSchema.index({ pipelineRunId: 1 });
NewsArticleSchema.index({ fetchedAt: -1 });
NewsArticleSchema.index({ source: 1, feedCategory: 1 });

export const NewsArticle = mongoose.model<INewsArticle>('NewsArticle', NewsArticleSchema);

/** Normalize a URL for consistent hashing (lowercase, strip trailing slash, strip fragment) */
export function normalizeUrl(url: string): string {
	try {
		const parsed = new URL(url);
		parsed.hash = '';
		// Remove trailing slash from pathname
		if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
			parsed.pathname = parsed.pathname.slice(0, -1);
		}
		return parsed.toString().toLowerCase();
	} catch {
		return url.toLowerCase().replace(/\/+$/, '');
	}
}

/** Compute SHA-256 hash of a normalized URL */
export function computeUrlHash(url: string): string {
	return crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex');
}
