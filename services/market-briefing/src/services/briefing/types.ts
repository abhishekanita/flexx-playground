import type { Types } from 'mongoose';
import type { StockQuote, IndexQuote, DailyMover, MacroQuote } from '@/plugins/yahoo-finance/types';
import type { MultipleNAVResult, NAVChange } from '@/plugins/mfapi/types';
import type { RSSArticle } from '@/plugins/rss-feeds/types';
import type { NewsArticle } from '@/plugins/serp-news/types';
import type { FIIDIITrend } from '@/plugins/nse-flows/types';
import type { CreatorVideo } from '@/plugins/youtube/types';
import type { CreatorReel } from '@/plugins/instagram/types';
import type { ContentCategory, IContentPieceTags, IContentSource, INewsArticle } from '@/schema';

// ─── Stage 1: Aggregated Demand ─────────────────────────────────

export interface AggregatedDemand {
	symbols: string[];
	schemeCodes: number[];
	interests: string[];
	userCount: number;
	/** symbols → number of users holding it (for prioritization) */
	symbolPopularity: Map<string, number>;
	schemePopularity: Map<string, number>;
}

// ─── Stage 2: Raw Data Bundle ───────────────────────────────────

export interface RawDataBundle {
	// Yahoo Finance
	stockQuotes: StockQuote[];
	indexQuotes: IndexQuote[];
	dailyMovers: DailyMover[];
	macroQuotes: MacroQuote[];

	// MFAPI
	mfNAVs: MultipleNAVResult[];
	mfNAVChanges: NAVChange[];

	// RSS Feeds
	rssArticles: RSSArticle[];
	rbiArticles: RSSArticle[];

	// SerpAPI News
	marketNews: NewsArticle[];
	stockNews: Map<string, NewsArticle[]>; // symbol → news

	// NSE Institutional Flows
	fiiDiiTrend: FIIDIITrend;

	// Creator Content
	creatorVideos: CreatorVideo[];
	creatorReels: CreatorReel[];

	// Persisted articles (with _id for referencing)
	savedArticles: INewsArticle[];

	// Metadata
	fetchedAt: Date;
	errors: DataFetchError[];
}

export interface DataFetchError {
	source: string;
	method: string;
	error: string;
}

// ─── Stage 3: Content Generation ────────────────────────────────

export interface ContentGenerationInput {
	category: ContentCategory;
	model: string;
	systemPrompt: string;
	userPrompt: string;
	tags: Partial<IContentPieceTags>;
	sources: IContentSource[];
	priority: number;
	subcategory?: string;
}

export interface GeneratedContent {
	title: string;
	body: string;
	tldr: string;
	durationSeconds: number;
}

export interface ContentGenerationResult {
	content: GeneratedContent;
	input: ContentGenerationInput;
	model: string;
	promptTokens: number;
	completionTokens: number;
	costUSD: number;
}

// ─── Stage 5: Briefing Assembly ─────────────────────────────────

export interface ScoredContentPiece {
	contentPieceId: Types.ObjectId;
	category: ContentCategory;
	title: string;
	body: string;
	tldr: string;
	durationSeconds: number;
	sources: IContentSource[];
	score: number;
	priority: number;
}

export interface BriefingResult {
	userId: string;
	date: Date;
	pieces: ScoredContentPiece[];
	totalDurationSeconds: number;
	generatedAt: Date;
}

// ─── Stage 2b: Signal Detection ─────────────────────────────────

export interface SectorMove {
	stocks: import('@/plugins/yahoo-finance/types').StockQuote[];
	avgChange: number;
	direction: 'up' | 'down';
}

export interface NewsTheme {
	theme: string;
	articles: (RSSArticle | NewsArticle)[];
	relatedSymbols: string[];
}

export interface MacroSignals {
	usdinr?: MacroQuote;
	brentCrude?: MacroQuote;
	wtiCrude?: MacroQuote;
	goldFutures?: MacroQuote;
	us10y?: MacroQuote;
	globalIndices: MacroQuote[];
	fiiDiiTrend: FIIDIITrend;
	rupeeTrend?: 'strengthening' | 'weakening' | 'stable';
	crudeTrend?: 'rising' | 'falling' | 'stable';
	fiiFlow?: 'heavy-buying' | 'buying' | 'neutral' | 'selling' | 'heavy-selling';
	rbiActions: RSSArticle[];
}

export interface MarketSignals {
	// Market-level
	marketMood: 'crash' | 'bearish' | 'flat' | 'bullish' | 'rally';
	niftyChange: number;

	// Notable stocks (filtered — skip boring <1.5% moves on normal volume)
	bigMovers: import('@/plugins/yahoo-finance/types').StockQuote[];
	nearExtremes: import('@/plugins/yahoo-finance/types').StockQuote[];

	// Sector patterns
	sectorMoves: Map<string, SectorMove>;

	// News themes (cluster articles by keyword overlap)
	newsThemes: NewsTheme[];

	// Macro signals
	macroSignals: MacroSignals;

	// MF signals (only if meaningful change)
	mfNotable: { nav: MultipleNAVResult; change: NAVChange }[];

	// Creator content signals
	creatorTopics: CreatorTopic[];
}

// ─── Creator Topic Clustering ────────────────────────────────────

export interface CreatorTopic {
	topic: string;
	creators: string[];
	videoCount: number;
	reelCount: number;
	sampleTitles: string[];
	totalEngagement: number;
}

// ─── Pipeline ───────────────────────────────────────────────────

export type PipelineEvent =
	| { type: 'crash'; niftyChangePercent: number }
	| { type: 'rbi'; title: string }
	| { type: 'manual' };
