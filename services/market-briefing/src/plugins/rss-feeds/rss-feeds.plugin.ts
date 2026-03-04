import Parser from 'rss-parser';
import logger from '@/utils/logger';
import type {
	RSSFeedSource,
	RSSArticle,
	FeedFetchResult,
	FetchAllFeedsOptions,
	FeedCategory,
	SearchArticlesOptions,
} from './types';
import { INDIAN_FINANCE_FEEDS } from './types';

const log = logger.createServiceLogger('RSSFeedsPlugin');

export class RSSFeedsPlugin {
	private parser: Parser;
	private feeds: RSSFeedSource[];

	constructor(customFeeds?: RSSFeedSource[]) {
		this.parser = new Parser({
			timeout: 10_000,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'application/rss+xml, application/xml, text/xml, */*',
			},
		});
		this.feeds = customFeeds || INDIAN_FINANCE_FEEDS;
	}

	/**
	 * Fetch articles from all configured feeds (or filtered by category).
	 */
	async fetchAllFeeds(options: FetchAllFeedsOptions = {}): Promise<FeedFetchResult[]> {
		const { categories, limitPerFeed = 20, since } = options;

		const targetFeeds = categories
			? this.feeds.filter((f) => categories.includes(f.category))
			: this.feeds;

		log.info(`Fetching ${targetFeeds.length} RSS feeds`);

		const results = await Promise.allSettled(
			targetFeeds.map((feed) => this.fetchSingleFeed(feed, limitPerFeed, since)),
		);

		return results.map((r, i) => {
			if (r.status === 'fulfilled') return r.value;

			const feed = targetFeeds[i];
			log.warn(`Feed failed: ${feed.name}`, r.reason);
			return {
				source: feed.name,
				category: feed.category,
				articles: [],
				fetchedAt: new Date(),
				error: r.reason?.message || 'Unknown error',
			};
		});
	}

	/**
	 * Fetch articles from a single feed by name.
	 */
	async fetchFeed(sourceName: string, limit = 20): Promise<FeedFetchResult> {
		const feed = this.feeds.find(
			(f) => f.name.toLowerCase() === sourceName.toLowerCase(),
		);

		if (!feed) {
			throw new Error(`Feed not found: "${sourceName}". Available: ${this.feeds.map((f) => f.name).join(', ')}`);
		}

		return this.fetchSingleFeed(feed, limit);
	}

	/**
	 * Fetch from a custom URL (not preconfigured).
	 */
	async fetchCustomFeed(url: string, name = 'Custom', category: FeedCategory = 'general', limit = 20): Promise<FeedFetchResult> {
		return this.fetchSingleFeed({ name, url, category }, limit);
	}

	/**
	 * Get latest articles across all feeds, sorted by date (newest first).
	 */
	async getLatestArticles(limit = 30, categories?: FeedCategory[]): Promise<RSSArticle[]> {
		const feedResults = await this.fetchAllFeeds({ categories, limitPerFeed: limit });

		const allArticles = feedResults.flatMap((r) => r.articles);

		return allArticles
			.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
			.slice(0, limit);
	}

	/**
	 * Search articles across all feeds by keyword in title or description.
	 */
	async searchArticles(options: SearchArticlesOptions): Promise<RSSArticle[]> {
		const { query, categories, limit = 20, since } = options;
		const queryLower = query.toLowerCase();

		const feedResults = await this.fetchAllFeeds({ categories, since });

		const allArticles = feedResults.flatMap((r) => r.articles);

		return allArticles
			.filter(
				(a) =>
					a.title.toLowerCase().includes(queryLower) ||
					a.description.toLowerCase().includes(queryLower),
			)
			.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
			.slice(0, limit);
	}

	/**
	 * Get list of all configured feed sources.
	 */
	getAvailableFeeds(): RSSFeedSource[] {
		return [...this.feeds];
	}

	/**
	 * Add a custom feed to the list at runtime.
	 */
	addFeed(feed: RSSFeedSource): void {
		const exists = this.feeds.some((f) => f.url === feed.url);
		if (exists) {
			log.warn(`Feed already exists: ${feed.url}`);
			return;
		}
		this.feeds.push(feed);
		log.info(`Added feed: ${feed.name} (${feed.url})`);
	}

	/**
	 * Remove a feed by name.
	 */
	removeFeed(name: string): boolean {
		const idx = this.feeds.findIndex((f) => f.name.toLowerCase() === name.toLowerCase());
		if (idx === -1) return false;
		this.feeds.splice(idx, 1);
		log.info(`Removed feed: ${name}`);
		return true;
	}

	// --- Private ---

	private async fetchSingleFeed(
		feed: RSSFeedSource,
		limit: number,
		since?: Date,
	): Promise<FeedFetchResult> {
		try {
			const parsed = await this.parser.parseURL(feed.url);

			let articles: RSSArticle[] = (parsed.items || []).slice(0, limit).map((item) => ({
				title: item.title || '',
				link: item.link || '',
				description: this.stripHtml(item.contentSnippet || item.content || item.summary || ''),
				pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
				source: feed.name,
				category: feed.category,
				content: item.content || item['content:encoded'] || undefined,
				author: item.creator || item.author || undefined,
				imageUrl: this.extractImageUrl(item),
			}));

			if (since) {
				articles = articles.filter((a) => a.pubDate >= since);
			}

			return {
				source: feed.name,
				category: feed.category,
				articles,
				fetchedAt: new Date(),
			};
		} catch (err: any) {
			log.error(`Failed to fetch feed: ${feed.name} (${feed.url})`, err);
			return {
				source: feed.name,
				category: feed.category,
				articles: [],
				fetchedAt: new Date(),
				error: err.message,
			};
		}
	}

	private stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
	}

	private extractImageUrl(item: any): string | undefined {
		if (item.enclosure?.url) return item.enclosure.url;
		if (item['media:content']?.['$']?.url) return item['media:content']['$'].url;

		// Try to extract from content
		const content = item.content || item['content:encoded'] || '';
		const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
		return imgMatch?.[1];
	}
}

export const rssFeedsPlugin = new RSSFeedsPlugin();
