export interface RSSFeedSource {
	name: string;
	url: string;
	category: FeedCategory;
}

export type FeedCategory =
	| 'markets'
	| 'economy'
	| 'mutual-funds'
	| 'personal-finance'
	| 'banking'
	| 'general'
	| 'regulatory'
	| 'insurance'
	| 'education';

export interface RSSArticle {
	title: string;
	link: string;
	description: string;
	pubDate: Date;
	source: string;
	category: FeedCategory;
	content?: string;
	author?: string;
	imageUrl?: string;
}

export interface FeedFetchResult {
	source: string;
	category: FeedCategory;
	articles: RSSArticle[];
	fetchedAt: Date;
	error?: string;
}

export interface FetchAllFeedsOptions {
	/** Filter by specific categories */
	categories?: FeedCategory[];
	/** Max articles per feed (default: 20) */
	limitPerFeed?: number;
	/** Only articles newer than this date */
	since?: Date;
}

export interface SearchArticlesOptions {
	query: string;
	categories?: FeedCategory[];
	limit?: number;
	since?: Date;
}

export const INDIAN_FINANCE_FEEDS: RSSFeedSource[] = [
	// ── Markets ─────────────────────────────────────────────
	{
		name: 'Economic Times - Markets',
		url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms',
		category: 'markets',
	},
	{
		name: 'Economic Times - Stocks',
		url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
		category: 'markets',
	},
	{
		name: 'LiveMint - Markets',
		url: 'https://www.livemint.com/rss/markets',
		category: 'markets',
	},
	{
		name: 'LiveMint - Industry',
		url: 'https://www.livemint.com/rss/industry',
		category: 'markets',
	},
	{
		name: 'LiveMint - Companies',
		url: 'https://www.livemint.com/rss/companies',
		category: 'markets',
	},

	// ── Economy ─────────────────────────────────────────────
	{
		name: 'Economic Times - Economy',
		url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms',
		category: 'economy',
	},
	{
		name: 'LiveMint - Economy',
		url: 'https://www.livemint.com/rss/economy',
		category: 'economy',
	},

	// ── Personal Finance ────────────────────────────────────
	{
		name: 'Economic Times - Personal Finance',
		url: 'https://economictimes.indiatimes.com/wealth/rssfeeds/837555174.cms',
		category: 'personal-finance',
	},
	{
		name: 'LiveMint - Money',
		url: 'https://www.livemint.com/rss/money',
		category: 'personal-finance',
	},
	{
		name: 'Finshots Daily',
		url: 'https://finshots.in/rss/',
		category: 'personal-finance',
	},
	{
		name: 'FreeFincal',
		url: 'https://freefincal.com/feed/',
		category: 'personal-finance',
	},

	// ── Banking ─────────────────────────────────────────────
	{
		name: 'Economic Times - Banking',
		url: 'https://economictimes.indiatimes.com/industry/banking/finance/banking/rssfeeds/13358259.cms',
		category: 'banking',
	},

	// ── Insurance ───────────────────────────────────────────
	{
		name: 'LiveMint - Insurance',
		url: 'https://www.livemint.com/rss/insurance',
		category: 'insurance',
	},

	// ── General Business ────────────────────────────────────
	{
		name: 'Economic Times - Top Stories',
		url: 'https://economictimes.indiatimes.com/rssfeedstopstories.cms',
		category: 'general',
	},
	{
		name: 'NDTV Profit',
		url: 'https://feeds.feedburner.com/ndtvprofit-latest',
		category: 'general',
	},

	// ── Regulatory ──────────────────────────────────────────
	{
		name: 'RBI Press Releases',
		url: 'https://www.rbi.org.in/pressreleases_rss.xml',
		category: 'regulatory',
	},

	// ── Education / Deep Reads ──────────────────────────────
	{
		name: 'Zerodha Varsity',
		url: 'https://zerodha.com/varsity/feed/',
		category: 'education',
	},
	{
		name: 'Capitalmind',
		url: 'https://www.capitalmind.in/feed/',
		category: 'education',
	},
];
