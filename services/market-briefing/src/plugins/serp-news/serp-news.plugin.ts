import { getJson } from 'serpapi';
import { config } from '@/config/config';
import logger from '@/utils/logger';
import type {
	NewsArticle,
	NewsSearchOptions,
	StockNewsOptions,
	SectorNewsOptions,
	PersonalizedNewsOptions,
	PersonalizedNewsResult,
	MarketNewsOptions,
} from './types';

const log = logger.createServiceLogger('SerpNewsPlugin');

export class SerpNewsPlugin {
	private apiKey: string;

	constructor() {
		this.apiKey = config.serpApi.apiKey;
	}

	/**
	 * Core method: fetch news from Google News via SerpAPI.
	 */
	async getFinancialNews(options: NewsSearchOptions): Promise<NewsArticle[]> {
		const {
			query,
			limit = 10,
			timeRange = 'd',
			country = 'in',
			language = 'en',
		} = options;

		log.info(`Fetching news: "${query}" (limit=${limit}, time=${timeRange})`);

		try {
			const params: Record<string, any> = {
				api_key: this.apiKey,
				engine: 'google_news',
				q: query,
				gl: country,
				hl: language,
			};

			// Google News SerpAPI uses topic tokens or query strings
			// For time-based filtering, append time operator to query
			if (timeRange) {
				const timeMap: Record<string, string> = {
					h: 'when:1h',
					d: 'when:1d',
					w: 'when:7d',
					m: 'when:30d',
				};
				params.q = `${query} ${timeMap[timeRange] || ''}`.trim();
			}

			const result = await getJson(params);

			const articles: NewsArticle[] = [];

			// Google News returns news_results array
			const newsResults = result.news_results || [];
			for (const item of newsResults.slice(0, limit)) {
				// Each item may have sub-stories in stories[] or be a direct result
				if (item.stories) {
					for (const story of item.stories.slice(0, 2)) {
						articles.push(this.parseNewsItem(story));
					}
				} else {
					articles.push(this.parseNewsItem(item));
				}

				if (articles.length >= limit) break;
			}

			log.info(`Fetched ${articles.length} articles for "${query}"`);
			return articles.slice(0, limit);
		} catch (err) {
			log.error(`Failed to fetch news for "${query}"`, err);
			throw err;
		}
	}

	/**
	 * Get news for a specific stock (uses company name + "stock" in query).
	 */
	async getStockNews(options: StockNewsOptions): Promise<NewsArticle[]> {
		const exchange = options.exchange || 'NSE';
		const query = `${options.symbol} stock ${exchange} India`;

		return this.getFinancialNews({
			query,
			limit: options.limit || 5,
			timeRange: options.timeRange || 'd',
		});
	}

	/**
	 * Get general Indian market news.
	 */
	async getMarketNews(options: MarketNewsOptions = {}): Promise<NewsArticle[]> {
		return this.getFinancialNews({
			query: 'Indian stock market Nifty Sensex',
			limit: options.limit || 10,
			timeRange: options.timeRange || 'd',
		});
	}

	/**
	 * Get news for a specific sector.
	 */
	async getSectorNews(options: SectorNewsOptions): Promise<NewsArticle[]> {
		const query = `India ${options.sector} sector stocks`;

		return this.getFinancialNews({
			query,
			limit: options.limit || 5,
			timeRange: options.timeRange || 'd',
		});
	}

	/**
	 * Fetch personalized news based on user's holdings and interests.
	 * Returns grouped results per topic so caller can prioritize/merge.
	 */
	async getPersonalizedNews(options: PersonalizedNewsOptions): Promise<PersonalizedNewsResult[]> {
		const { holdings = [], interests = [], limitPerTopic = 3, timeRange = 'd' } = options;

		log.info(`Fetching personalized news: ${holdings.length} holdings, ${interests.length} interests`);

		const tasks: Promise<PersonalizedNewsResult>[] = [];

		// Fetch news for each holding
		for (const holding of holdings) {
			tasks.push(
				this.getStockNews({ symbol: holding, limit: limitPerTopic, timeRange })
					.then((articles) => ({ topic: holding, type: 'holding' as const, articles }))
					.catch((err) => {
						log.warn(`Failed to fetch news for holding "${holding}"`, err);
						return { topic: holding, type: 'holding' as const, articles: [] };
					}),
			);
		}

		// Fetch news for each interest
		for (const interest of interests) {
			tasks.push(
				this.getFinancialNews({ query: `${interest} India finance`, limit: limitPerTopic, timeRange })
					.then((articles) => ({ topic: interest, type: 'interest' as const, articles }))
					.catch((err) => {
						log.warn(`Failed to fetch news for interest "${interest}"`, err);
						return { topic: interest, type: 'interest' as const, articles: [] };
					}),
			);
		}

		return Promise.all(tasks);
	}

	/**
	 * Search Google via SerpAPI for broader financial queries (uses regular Google search, not Google News).
	 * Useful for getting RBI circulars, SEBI updates, etc.
	 */
	async searchFinancialWeb(query: string, limit = 10): Promise<NewsArticle[]> {
		log.info(`Web search: "${query}"`);

		try {
			const result = await getJson({
				api_key: this.apiKey,
				engine: 'google',
				q: query,
				gl: 'in',
				hl: 'en',
				tbm: 'nws',
				num: limit,
			});

			const newsResults = result.news_results || [];
			return newsResults.slice(0, limit).map((item: any) => this.parseNewsItem(item));
		} catch (err) {
			log.error(`Web search failed for "${query}"`, err);
			throw err;
		}
	}

	private parseNewsItem(item: any): NewsArticle {
		return {
			title: item.title || '',
			link: item.link || item.url || '',
			snippet: item.snippet || item.description || '',
			source: item.source?.name || item.source || '',
			date: item.date || item.published_date || undefined,
			thumbnail: item.thumbnail || item.image || undefined,
		};
	}
}

export const serpNewsPlugin = new SerpNewsPlugin();
