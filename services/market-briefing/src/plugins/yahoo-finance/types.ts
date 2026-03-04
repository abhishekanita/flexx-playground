export interface StockQuote {
	symbol: string;
	name: string;
	exchange: string;
	currency: string;
	price: number;
	previousClose: number;
	open: number;
	dayHigh: number;
	dayLow: number;
	change: number;
	changePercent: number;
	volume: number;
	averageVolume: number;
	marketCap?: number;
	fiftyTwoWeekHigh?: number;
	fiftyTwoWeekLow?: number;
	fetchedAt: Date;
}

export interface StockSummary extends StockQuote {
	pe?: number;
	eps?: number;
	dividendYield?: number;
	bookValue?: number;
	sector?: string;
	industry?: string;
	description?: string;
}

export interface HistoricalPrice {
	date: Date;
	open: number;
	high: number;
	low: number;
	close: number;
	adjustedClose: number;
	volume: number;
}

export interface DailyMover {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	volume: number;
}

export interface StockSearchResult {
	symbol: string;
	name: string;
	exchange: string;
	type: string;
}

export interface IndexQuote {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	fetchedAt: Date;
}

export type HistoricalInterval = '1d' | '1wk' | '1mo';

export interface GetHistoricalOptions {
	symbol: string;
	startDate: Date;
	endDate?: Date;
	interval?: HistoricalInterval;
}

export const INDIAN_INDICES = {
	NIFTY_50: '^NSEI',
	SENSEX: '^BSESN',
	NIFTY_BANK: '^NSEBANK',
	NIFTY_IT: '^CNXIT',
	NIFTY_PHARMA: '^CNXPHARMA',
	INDIA_VIX: '^INDIAVIX',
} as const;

export const FOREX_PAIRS = {
	USDINR: 'USDINR=X',
	EURINR: 'EURINR=X',
	GBPINR: 'GBPINR=X',
} as const;

export const COMMODITIES = {
	WTI_CRUDE: 'CL=F',
	BRENT_CRUDE: 'BZ=F',
	GOLD_FUTURES: 'GC=F',
	SILVER_FUTURES: 'SI=F',
} as const;

export const GLOBAL_INDICES = {
	SP500: '^GSPC',
	DOW_JONES: '^DJI',
	NASDAQ: '^IXIC',
	HANG_SENG: '^HSI',
	NIKKEI_225: '^N225',
	FTSE_100: '^FTSE',
} as const;

export const BOND_YIELDS = {
	US_10Y: '^TNX',
} as const;

export type MacroCategory = 'forex' | 'commodity' | 'global-index' | 'bond-yield';

export interface MacroQuote {
	symbol: string;
	name: string;
	category: MacroCategory;
	price: number;
	previousClose: number;
	change: number;
	changePercent: number;
	currency: string;
	fetchedAt: Date;
}

/** Append .NS for NSE, .BO for BSE */
export function nseSymbol(ticker: string): string {
	return ticker.includes('.') ? ticker : `${ticker}.NS`;
}

export function bseSymbol(ticker: string): string {
	return ticker.includes('.') ? ticker : `${ticker}.BO`;
}
