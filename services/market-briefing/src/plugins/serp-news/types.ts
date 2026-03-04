export interface NewsArticle {
	title: string;
	link: string;
	snippet: string;
	source: string;
	date?: string;
	thumbnail?: string;
}

export interface NewsSearchOptions {
	query: string;
	/** Number of results (default: 10) */
	limit?: number;
	/** Time filter: h = past hour, d = past day, w = past week, m = past month */
	timeRange?: 'h' | 'd' | 'w' | 'm';
	/** Country code (default: in) */
	country?: string;
	/** Language (default: en) */
	language?: string;
}

export interface StockNewsOptions {
	/** Stock symbol or company name */
	symbol: string;
	/** Include exchange name in query (e.g. "NSE") */
	exchange?: string;
	limit?: number;
	timeRange?: 'h' | 'd' | 'w' | 'm';
}

export interface SectorNewsOptions {
	sector: string;
	limit?: number;
	timeRange?: 'h' | 'd' | 'w' | 'm';
}

export interface PersonalizedNewsOptions {
	/** User's stock holdings (symbols or company names) */
	holdings?: string[];
	/** User's interests (e.g. "mutual funds", "crypto", "real estate") */
	interests?: string[];
	/** Max articles per interest/holding */
	limitPerTopic?: number;
	timeRange?: 'h' | 'd' | 'w' | 'm';
}

export interface PersonalizedNewsResult {
	topic: string;
	type: 'holding' | 'interest';
	articles: NewsArticle[];
}

export interface MarketNewsOptions {
	limit?: number;
	timeRange?: 'h' | 'd' | 'w' | 'm';
}
