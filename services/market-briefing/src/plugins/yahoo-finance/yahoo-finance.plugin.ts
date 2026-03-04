import YahooFinance from 'yahoo-finance2';
import logger from '@/utils/logger';
import type {
	StockQuote,
	StockSummary,
	HistoricalPrice,
	DailyMover,
	StockSearchResult,
	IndexQuote,
	MacroQuote,
	MacroCategory,
	GetHistoricalOptions,
} from './types';
import { INDIAN_INDICES, FOREX_PAIRS, COMMODITIES, GLOBAL_INDICES, BOND_YIELDS, nseSymbol } from './types';

const log = logger.createServiceLogger('YahooFinancePlugin');

export class YahooFinancePlugin {
	private yf: InstanceType<typeof YahooFinance>;

	constructor() {
		this.yf = new YahooFinance();
	}

	/**
	 * Get real-time quote for a single stock.
	 * Pass raw symbol like "RELIANCE.NS" or just "RELIANCE" (auto-appends .NS).
	 */
	async getQuote(symbol: string): Promise<StockQuote> {
		const sym = nseSymbol(symbol);
		log.info(`Fetching quote for ${sym}`);

		try {
			const result: any = await this.yf.quote(sym);

			return {
				symbol: result.symbol,
				name: result.shortName || result.longName || sym,
				exchange: result.exchange || '',
				currency: result.currency || 'INR',
				price: result.regularMarketPrice ?? 0,
				previousClose: result.regularMarketPreviousClose ?? 0,
				open: result.regularMarketOpen ?? 0,
				dayHigh: result.regularMarketDayHigh ?? 0,
				dayLow: result.regularMarketDayLow ?? 0,
				change: result.regularMarketChange ?? 0,
				changePercent: result.regularMarketChangePercent ?? 0,
				volume: result.regularMarketVolume ?? 0,
				averageVolume: result.averageDailyVolume3Month ?? 0,
				marketCap: result.marketCap,
				fiftyTwoWeekHigh: result.fiftyTwoWeekHigh,
				fiftyTwoWeekLow: result.fiftyTwoWeekLow,
				fetchedAt: new Date(),
			};
		} catch (err) {
			log.error(`Failed to fetch quote for ${sym}`, err);
			throw err;
		}
	}

	/**
	 * Get quotes for multiple stocks in one call.
	 */
	async getQuotes(symbols: string[]): Promise<StockQuote[]> {
		log.info(`Fetching quotes for ${symbols.length} symbols`);
		const results = await Promise.allSettled(symbols.map((s) => this.getQuote(s)));

		return results
			.filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === 'fulfilled')
			.map((r) => r.value);
	}

	/**
	 * Get historical OHLCV data for a stock.
	 */
	async getHistoricalPrices(options: GetHistoricalOptions): Promise<HistoricalPrice[]> {
		const sym = nseSymbol(options.symbol);
		const interval = options.interval || '1d';
		const endDate = options.endDate || new Date();

		log.info(`Fetching historical prices for ${sym} from ${options.startDate.toISOString()} (${interval})`);

		try {
			const result: any = await this.yf.chart(sym, {
				period1: options.startDate,
				period2: endDate,
				interval,
			});

			return (result.quotes || []).map((q: any) => ({
				date: new Date(q.date),
				open: q.open ?? 0,
				high: q.high ?? 0,
				low: q.low ?? 0,
				close: q.close ?? 0,
				adjustedClose: q.adjclose ?? q.close ?? 0,
				volume: q.volume ?? 0,
			}));
		} catch (err) {
			log.error(`Failed to fetch historical prices for ${sym}`, err);
			throw err;
		}
	}

	/**
	 * Get daily price movements for a list of stocks (useful for portfolio tracking).
	 * Returns sorted by absolute change% descending (biggest movers first).
	 */
	async getDailyMovers(symbols: string[]): Promise<DailyMover[]> {
		log.info(`Fetching daily movers for ${symbols.length} symbols`);
		const quotes = await this.getQuotes(symbols);

		return quotes
			.map((q) => ({
				symbol: q.symbol,
				name: q.name,
				price: q.price,
				change: q.change,
				changePercent: q.changePercent,
				volume: q.volume,
			}))
			.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
	}

	/**
	 * Get detailed stock summary including fundamentals.
	 */
	async getStockSummary(symbol: string): Promise<StockSummary> {
		const sym = nseSymbol(symbol);
		log.info(`Fetching stock summary for ${sym}`);

		try {
			const [quoteResult, summaryResult]: any[] = await Promise.all([
				this.yf.quote(sym),
				this.yf.quoteSummary(sym, {
					modules: ['summaryProfile', 'defaultKeyStatistics', 'financialData'],
				}).catch(() => null),
			]);

			const profile = summaryResult?.summaryProfile;
			const keyStats = summaryResult?.defaultKeyStatistics;

			return {
				symbol: quoteResult.symbol,
				name: quoteResult.shortName || quoteResult.longName || sym,
				exchange: quoteResult.exchange || '',
				currency: quoteResult.currency || 'INR',
				price: quoteResult.regularMarketPrice ?? 0,
				previousClose: quoteResult.regularMarketPreviousClose ?? 0,
				open: quoteResult.regularMarketOpen ?? 0,
				dayHigh: quoteResult.regularMarketDayHigh ?? 0,
				dayLow: quoteResult.regularMarketDayLow ?? 0,
				change: quoteResult.regularMarketChange ?? 0,
				changePercent: quoteResult.regularMarketChangePercent ?? 0,
				volume: quoteResult.regularMarketVolume ?? 0,
				averageVolume: quoteResult.averageDailyVolume3Month ?? 0,
				marketCap: quoteResult.marketCap,
				fiftyTwoWeekHigh: quoteResult.fiftyTwoWeekHigh,
				fiftyTwoWeekLow: quoteResult.fiftyTwoWeekLow,
				pe: quoteResult.trailingPE ?? keyStats?.trailingPE,
				eps: keyStats?.trailingEps,
				dividendYield: keyStats?.dividendYield,
				bookValue: keyStats?.bookValue,
				sector: profile?.sector,
				industry: profile?.industry,
				description: profile?.longBusinessSummary,
				fetchedAt: new Date(),
			};
		} catch (err) {
			log.error(`Failed to fetch stock summary for ${sym}`, err);
			throw err;
		}
	}

	/**
	 * Search for stocks by name or symbol.
	 */
	async searchStocks(query: string): Promise<StockSearchResult[]> {
		log.info(`Searching stocks: "${query}"`);

		try {
			const result: any = await this.yf.search(query);

			return (result.quotes || [])
				.filter((q: any) => q.quoteType === 'EQUITY')
				.map((q: any) => ({
					symbol: q.symbol,
					name: q.shortname || q.longname || q.symbol,
					exchange: q.exchange || '',
					type: q.quoteType || 'EQUITY',
				}));
		} catch (err) {
			log.error(`Failed to search stocks for "${query}"`, err);
			throw err;
		}
	}

	/**
	 * Get quotes for major Indian indices (Nifty 50, Sensex, Bank Nifty, etc.)
	 */
	async getIndexQuotes(): Promise<IndexQuote[]> {
		log.info('Fetching Indian index quotes');

		const indexSymbols = Object.values(INDIAN_INDICES);
		const results = await Promise.allSettled(
			indexSymbols.map((sym) => this.yf.quote(sym) as Promise<any>),
		);

		return results
			.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
			.map((r) => {
				const q = r.value;
				return {
					symbol: q.symbol,
					name: q.shortName || q.longName || q.symbol,
					price: q.regularMarketPrice ?? 0,
					change: q.regularMarketChange ?? 0,
					changePercent: q.regularMarketChangePercent ?? 0,
					fetchedAt: new Date(),
				};
			});
	}

	/**
	 * Get quotes for macro data: forex pairs, commodities, global indices, bond yields.
	 */
	async getMacroQuotes(): Promise<MacroQuote[]> {
		log.info('Fetching macro quotes (forex, commodities, global indices, bonds)');

		const symbolMap: { symbol: string; name: string; category: MacroCategory }[] = [
			// Forex
			...Object.entries(FOREX_PAIRS).map(([name, symbol]) => ({ symbol, name, category: 'forex' as const })),
			// Commodities
			...Object.entries(COMMODITIES).map(([name, symbol]) => ({ symbol, name, category: 'commodity' as const })),
			// Global Indices
			...Object.entries(GLOBAL_INDICES).map(([name, symbol]) => ({ symbol, name, category: 'global-index' as const })),
			// Bond Yields
			...Object.entries(BOND_YIELDS).map(([name, symbol]) => ({ symbol, name, category: 'bond-yield' as const })),
		];

		const results = await Promise.allSettled(
			symbolMap.map((s) => this.yf.quote(s.symbol) as Promise<any>),
		);

		const quotes: MacroQuote[] = [];
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === 'fulfilled') {
				const q = result.value;
				quotes.push({
					symbol: q.symbol,
					name: q.shortName || q.longName || symbolMap[i].name,
					category: symbolMap[i].category,
					price: q.regularMarketPrice ?? 0,
					previousClose: q.regularMarketPreviousClose ?? 0,
					change: q.regularMarketChange ?? 0,
					changePercent: q.regularMarketChangePercent ?? 0,
					currency: q.currency || 'USD',
					fetchedAt: new Date(),
				});
			} else {
				log.warn(`Failed to fetch macro quote for ${symbolMap[i].symbol}: ${result.reason?.message}`);
			}
		}

		log.info(`Fetched ${quotes.length}/${symbolMap.length} macro quotes`);
		return quotes;
	}

	/**
	 * Get a single index quote by key name.
	 */
	async getIndexQuote(indexKey: keyof typeof INDIAN_INDICES): Promise<IndexQuote> {
		const sym = INDIAN_INDICES[indexKey];
		log.info(`Fetching index quote for ${indexKey} (${sym})`);

		try {
			const q: any = await this.yf.quote(sym);
			return {
				symbol: q.symbol,
				name: q.shortName || q.longName || sym,
				price: q.regularMarketPrice ?? 0,
				change: q.regularMarketChange ?? 0,
				changePercent: q.regularMarketChangePercent ?? 0,
				fetchedAt: new Date(),
			};
		} catch (err) {
			log.error(`Failed to fetch index quote for ${indexKey}`, err);
			throw err;
		}
	}
}

export const yahooFinancePlugin = new YahooFinancePlugin();
