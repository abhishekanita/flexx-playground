import type { Types } from 'mongoose';
import logger from '@/utils/logger';
import { UserProfile, NewsArticle, normalizeUrl, computeUrlHash } from '@/schema';
import type { INewsArticle } from '@/schema';
import { yahooFinancePlugin } from '@/plugins/yahoo-finance';
import { mfapiPlugin } from '@/plugins/mfapi';
import { rssFeedsPlugin } from '@/plugins/rss-feeds';
import { serpNewsPlugin } from '@/plugins/serp-news';
import { nseFlowsPlugin } from '@/plugins/nse-flows';
import { youtubePlugin } from '@/plugins/youtube';
import { FINANCE_YOUTUBE_CHANNELS } from '@/plugins/youtube/types';
import { instagramPlugin } from '@/plugins/instagram';
import { FINANCE_INSTAGRAM_ACCOUNTS, FINANCE_INSTAGRAM_KEYWORDS } from '@/plugins/instagram/types';
import type { RSSArticle, FeedCategory } from '@/plugins/rss-feeds/types';
import type { NewsArticle as SerpNewsArticle } from '@/plugins/serp-news/types';
import type { AggregatedDemand, RawDataBundle, DataFetchError } from './types';

const log = logger.createServiceLogger('DataAggregator');

// ─── Stage 1: Aggregate Demand ──────────────────────────────────

export async function aggregateUserDemand(): Promise<AggregatedDemand> {
	log.info('Aggregating user demand...');

	const users = await UserProfile.find({}).lean();
	log.info(`Found ${users.length} user profiles`);

	const symbolPopularity = new Map<string, number>();
	const schemePopularity = new Map<string, number>();
	const interestSet = new Set<string>();

	for (const user of users) {
		for (const h of user.holdings || []) {
			const sym = h.symbol.toUpperCase();
			symbolPopularity.set(sym, (symbolPopularity.get(sym) || 0) + 1);
		}
		for (const mf of user.mfHoldings || []) {
			const key = String(mf.schemeCode);
			schemePopularity.set(key, (schemePopularity.get(key) || 0) + 1);
		}
		for (const interest of user.interests || []) {
			interestSet.add(interest.toLowerCase());
		}
	}

	const demand: AggregatedDemand = {
		symbols: [...symbolPopularity.keys()],
		schemeCodes: [...schemePopularity.keys()].map(Number),
		interests: [...interestSet],
		userCount: users.length,
		symbolPopularity,
		schemePopularity,
	};

	log.info(
		`Demand: ${demand.symbols.length} symbols, ${demand.schemeCodes.length} schemes, ${demand.interests.length} interests`,
	);

	return demand;
}

// ─── Stage 2: Fetch All Raw Data ────────────────────────────────

export async function fetchAllData(demand: AggregatedDemand, pipelineRunId: Types.ObjectId): Promise<RawDataBundle> {
	log.info('Fetching all raw data...');

	const errors: DataFetchError[] = [];
	const fetchStart = Date.now();

	// Prepare all fetches to run in parallel
	const [
		stockQuotesResult,
		indexQuotesResult,
		dailyMoversResult,
		macroQuotesResult,
		mfNAVsResult,
		mfNAVChangesResult,
		rssArticlesResult,
		rbiArticlesResult,
		marketNewsResult,
		fiiDiiTrendResult,
		creatorVideosResult,
		creatorReelsResult,
	] = await Promise.allSettled([
		// Yahoo Finance
		demand.symbols.length > 0
			? yahooFinancePlugin.getQuotes(demand.symbols)
			: Promise.resolve([]),

		yahooFinancePlugin.getIndexQuotes(),

		demand.symbols.length > 0
			? yahooFinancePlugin.getDailyMovers(demand.symbols)
			: Promise.resolve([]),

		yahooFinancePlugin.getMacroQuotes(),

		// MFAPI
		demand.schemeCodes.length > 0
			? mfapiPlugin.getMultipleNAVs(demand.schemeCodes)
			: Promise.resolve([]),

		demand.schemeCodes.length > 0
			? mfapiPlugin.getPortfolioNAVChanges(demand.schemeCodes, 1)
			: Promise.resolve([]),

		// RSS Feeds
		rssFeedsPlugin.getLatestArticles(50),

		rssFeedsPlugin.searchArticles({ query: 'RBI', limit: 10, categories: ['regulatory'] }),

		// SerpAPI News
		serpNewsPlugin.getMarketNews({ limit: 10 }),

		// NSE Institutional Flows
		nseFlowsPlugin.getFlowTrend(),

		// Creator Content
		youtubePlugin.getRecentCreatorVideos(FINANCE_YOUTUBE_CHANNELS),
		instagramPlugin.getRecentCreatorReels(FINANCE_INSTAGRAM_ACCOUNTS, FINANCE_INSTAGRAM_KEYWORDS),
	]);

	// Extract results with error handling
	const stockQuotes = extractResult(stockQuotesResult, 'yahoo-finance', 'getQuotes', errors) || [];
	const indexQuotes = extractResult(indexQuotesResult, 'yahoo-finance', 'getIndexQuotes', errors) || [];
	const dailyMovers = extractResult(dailyMoversResult, 'yahoo-finance', 'getDailyMovers', errors) || [];
	const macroQuotes = extractResult(macroQuotesResult, 'yahoo-finance', 'getMacroQuotes', errors) || [];
	const mfNAVs = extractResult(mfNAVsResult, 'mfapi', 'getMultipleNAVs', errors) || [];
	const mfNAVChanges = extractResult(mfNAVChangesResult, 'mfapi', 'getPortfolioNAVChanges', errors) || [];
	const rssArticles = extractResult(rssArticlesResult, 'rss-feeds', 'getLatestArticles', errors) || [];
	const rbiArticles = extractResult(rbiArticlesResult, 'rss-feeds', 'searchArticles(RBI)', errors) || [];
	const marketNews = extractResult(marketNewsResult, 'serp-news', 'getMarketNews', errors) || [];
	const fiiDiiTrend = extractResult(fiiDiiTrendResult, 'nse-flows', 'getFlowTrend', errors) || {
		today: null, direction: 'neutral' as const, netFII: 0, netDII: 0, narrative: 'FII/DII data unavailable',
	};
	const creatorVideos = extractResult(creatorVideosResult, 'youtube', 'getRecentCreatorVideos', errors) || [];
	const creatorReels = extractResult(creatorReelsResult, 'instagram', 'getRecentCreatorReels', errors) || [];

	// Fetch stock-specific news for top movers (limit to top 5 to save API credits)
	const stockNews = new Map<string, import('@/plugins/serp-news/types').NewsArticle[]>();
	const topMovers = dailyMovers.slice(0, 5);

	if (topMovers.length > 0) {
		const stockNewsResults = await Promise.allSettled(
			topMovers.map((mover) =>
				serpNewsPlugin.getStockNews({ symbol: mover.symbol.replace('.NS', ''), limit: 3 }),
			),
		);

		for (let i = 0; i < topMovers.length; i++) {
			const result = stockNewsResults[i];
			if (result.status === 'fulfilled') {
				stockNews.set(topMovers[i].symbol, result.value);
			} else {
				errors.push({
					source: 'serp-news',
					method: `getStockNews(${topMovers[i].symbol})`,
					error: result.reason?.message || 'Unknown error',
				});
			}
		}
	}

	const fetchTimeMs = Date.now() - fetchStart;
	log.info(`Data fetch complete in ${fetchTimeMs}ms (${errors.length} errors)`);

	if (errors.length > 0) {
		for (const err of errors) {
			log.warn(`Fetch error: ${err.source}.${err.method} — ${err.error}`);
		}
	}

	// Persist all articles to MongoDB with dedup
	const savedArticles = await persistArticles(
		rssArticles,
		rbiArticles,
		marketNews,
		stockNews,
		pipelineRunId,
	);

	return {
		stockQuotes,
		indexQuotes,
		dailyMovers,
		macroQuotes,
		mfNAVs,
		mfNAVChanges,
		rssArticles,
		rbiArticles,
		marketNews,
		stockNews,
		fiiDiiTrend,
		creatorVideos,
		creatorReels,
		savedArticles,
		fetchedAt: new Date(),
		errors,
	};
}

// ─── Article Persistence ────────────────────────────────────────

export async function persistArticles(
	rssArticles: RSSArticle[],
	rbiArticles: RSSArticle[],
	marketNews: SerpNewsArticle[],
	stockNews: Map<string, SerpNewsArticle[]>,
	pipelineRunId: Types.ObjectId,
): Promise<INewsArticle[]> {
	const now = new Date();

	// Build bulk operations from all article sources
	const ops: import('mongoose').AnyBulkWriteOperation<INewsArticle>[] = [];
	const urlHashes = new Set<string>();

	const addOp = (doc: {
		source: 'rss' | 'serp-news';
		sourceName: string;
		feedCategory?: FeedCategory;
		title: string;
		url: string;
		description: string;
		content?: string;
		author?: string;
		imageUrl?: string;
		publishedAt?: Date;
	}) => {
		const urlHash = computeUrlHash(doc.url);
		if (urlHashes.has(urlHash)) return; // skip in-batch duplicates
		urlHashes.add(urlHash);

		ops.push({
			updateOne: {
				filter: { urlHash },
				update: {
					$setOnInsert: {
						pipelineRunId,
						source: doc.source,
						sourceName: doc.sourceName,
						...(doc.feedCategory && { feedCategory: doc.feedCategory }),
						title: doc.title,
						url: normalizeUrl(doc.url),
						urlHash,
						description: doc.description,
						...(doc.content && { content: doc.content }),
						...(doc.author && { author: doc.author }),
						...(doc.imageUrl && { imageUrl: doc.imageUrl }),
						...(doc.publishedAt && { publishedAt: doc.publishedAt }),
						fetchedAt: now,
					},
				},
				upsert: true,
			},
		});
	};

	// RSS articles
	for (const a of rssArticles) {
		addOp({
			source: 'rss',
			sourceName: a.source,
			feedCategory: a.category,
			title: a.title,
			url: a.link,
			description: a.description || '',
			content: a.content,
			author: a.author,
			imageUrl: a.imageUrl,
			publishedAt: a.pubDate,
		});
	}

	// RBI articles (also RSS-sourced)
	for (const a of rbiArticles) {
		addOp({
			source: 'rss',
			sourceName: a.source,
			feedCategory: a.category,
			title: a.title,
			url: a.link,
			description: a.description || '',
			content: a.content,
			author: a.author,
			imageUrl: a.imageUrl,
			publishedAt: a.pubDate,
		});
	}

	// Market news (SerpAPI)
	for (const a of marketNews) {
		addOp({
			source: 'serp-news',
			sourceName: a.source,
			title: a.title,
			url: a.link,
			description: a.snippet || '',
			imageUrl: a.thumbnail,
			publishedAt: a.date ? new Date(a.date) : undefined,
		});
	}

	// Stock news (SerpAPI)
	for (const [, articles] of stockNews) {
		for (const a of articles) {
			addOp({
				source: 'serp-news',
				sourceName: a.source,
				title: a.title,
				url: a.link,
				description: a.snippet || '',
				imageUrl: a.thumbnail,
				publishedAt: a.date ? new Date(a.date) : undefined,
			});
		}
	}

	if (ops.length === 0) {
		log.info('No articles to persist');
		return [];
	}

	const totalFetched = rssArticles.length + rbiArticles.length + marketNews.length +
		[...stockNews.values()].reduce((sum, arr) => sum + arr.length, 0);

	const result = await NewsArticle.bulkWrite(ops, { ordered: false });
	const upserted = result.upsertedCount;
	const matched = result.matchedCount;

	log.info(
		`Articles persisted: ${upserted} new, ${matched} deduplicated (${totalFetched} total fetched, ${ops.length} unique URLs)`,
	);

	// Return all saved docs (both new and existing) by their urlHashes
	const savedArticles = await NewsArticle.find({
		urlHash: { $in: [...urlHashes] },
	}).lean() as INewsArticle[];

	return savedArticles;
}

// ─── Helpers ────────────────────────────────────────────────────

function extractResult<T>(
	result: PromiseSettledResult<T>,
	source: string,
	method: string,
	errors: DataFetchError[],
): T | null {
	if (result.status === 'fulfilled') return result.value;
	errors.push({ source, method, error: result.reason?.message || 'Unknown error' });
	return null;
}
