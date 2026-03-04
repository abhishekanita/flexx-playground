/**
 * Comprehensive test script for all 4 data plugins.
 * Run: NODE_ENV=dev npx ts-node --files -r tsconfig-paths/register src/scripts/test-plugins.ts
 */
import { config } from '@/config/config';
import { YahooFinancePlugin } from '@/plugins/yahoo-finance/yahoo-finance.plugin';
import { MFAPIPlugin } from '@/plugins/mfapi/mfapi.plugin';
import { RSSFeedsPlugin } from '@/plugins/rss-feeds/rss-feeds.plugin';
import { SerpNewsPlugin } from '@/plugins/serp-news/serp-news.plugin';

// ─── Helpers ────────────────────────────────────────────────
const divider = (title: string) => {
	console.log('\n' + '═'.repeat(70));
	console.log(`  ${title}`);
	console.log('═'.repeat(70));
};

const section = (title: string) => {
	console.log(`\n--- ${title} ---`);
};

const json = (data: any) => console.log(JSON.stringify(data, null, 2));

const safe = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
	try {
		const start = Date.now();
		const result = await fn();
		console.log(`  [OK] ${label} (${Date.now() - start}ms)`);
		return result;
	} catch (err: any) {
		console.log(`  [FAIL] ${label}: ${err.message}`);
		return null;
	}
};

// ─── PLUGIN 1: Yahoo Finance ────────────────────────────────
async function testYahooFinance() {
	divider('PLUGIN 1: Yahoo Finance (yahoo-finance2) — FREE, no API key needed');

	const yf = new YahooFinancePlugin();

	// 1a. Single stock quote
	section('1a. Single Stock Quote — RELIANCE.NS');
	const quote = await safe('getQuote("RELIANCE")', () => yf.getQuote('RELIANCE'));
	if (quote) json(quote);

	// 1b. Multiple stock quotes (simulate a portfolio)
	section('1b. Batch Quotes — Portfolio of 5 stocks');
	const portfolio = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC'];
	const quotes = await safe('getQuotes(portfolio)', () => yf.getQuotes(portfolio));
	if (quotes) {
		console.log(`  Fetched ${quotes.length}/${portfolio.length} quotes`);
		for (const q of quotes) {
			console.log(`    ${q.symbol.padEnd(18)} ₹${q.price.toFixed(2).padStart(10)}  ${q.change >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%  vol=${q.volume.toLocaleString()}`);
		}
	}

	// 1c. Daily movers
	section('1c. Daily Movers — sorted by abs change%');
	const movers = await safe('getDailyMovers()', () =>
		yf.getDailyMovers(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC', 'SBIN', 'BAJFINANCE', 'LT']),
	);
	if (movers) {
		for (const m of movers.slice(0, 5)) {
			console.log(`    ${m.symbol.padEnd(18)} ${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}%  ₹${m.price.toFixed(2)}`);
		}
	}

	// 1d. Indian indices
	section('1d. Indian Indices — Nifty, Sensex, Bank Nifty, VIX');
	const indices = await safe('getIndexQuotes()', () => yf.getIndexQuotes());
	if (indices) {
		for (const idx of indices) {
			console.log(`    ${idx.name?.padEnd(25) || idx.symbol.padEnd(25)} ${idx.price.toFixed(2).padStart(12)}  ${idx.change >= 0 ? '+' : ''}${idx.changePercent.toFixed(2)}%`);
		}
	}

	// 1e. Stock summary with fundamentals
	section('1e. Stock Summary — HDFCBANK fundamentals');
	const summary = await safe('getStockSummary("HDFCBANK")', () => yf.getStockSummary('HDFCBANK'));
	if (summary) {
		console.log(`    Price: ₹${summary.price}  PE: ${summary.pe ?? 'N/A'}  Sector: ${summary.sector ?? 'N/A'}`);
		console.log(`    52W High: ₹${summary.fiftyTwoWeekHigh}  52W Low: ₹${summary.fiftyTwoWeekLow}`);
		console.log(`    Market Cap: ₹${summary.marketCap ? (summary.marketCap / 1e7).toFixed(0) + ' Cr' : 'N/A'}`);
	}

	// 1f. Historical prices (last 7 days)
	section('1f. Historical Prices — TCS last 7 days');
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const history = await safe('getHistoricalPrices("TCS", 7d)', () =>
		yf.getHistoricalPrices({ symbol: 'TCS', startDate: sevenDaysAgo }),
	);
	if (history) {
		for (const h of history) {
			console.log(`    ${h.date.toISOString().split('T')[0]}  O=${h.open.toFixed(2)} H=${h.high.toFixed(2)} L=${h.low.toFixed(2)} C=${h.close.toFixed(2)} V=${h.volume.toLocaleString()}`);
		}
	}

	// 1g. Search
	section('1g. Stock Search — "adani"');
	const search = await safe('searchStocks("adani")', () => yf.searchStocks('adani'));
	if (search) {
		for (const s of search.slice(0, 5)) {
			console.log(`    ${s.symbol.padEnd(25)} ${s.name.padEnd(30)} ${s.exchange}`);
		}
	}

	// 1h. Gold & commodity proxies
	section('1h. Commodity ETF Proxies — Gold, Silver, Nifty Next 50');
	const commodities = await safe('getQuotes(commodity ETFs)', () =>
		yf.getQuotes(['GOLDBEES.NS', 'SILVERBEES.NS', 'NIFTYBEES.NS']),
	);
	if (commodities) {
		for (const c of commodities) {
			console.log(`    ${c.symbol.padEnd(20)} ₹${c.price.toFixed(2)}  ${c.change >= 0 ? '+' : ''}${c.changePercent.toFixed(2)}%`);
		}
	}
}

// ─── PLUGIN 2: MFAPI ────────────────────────────────────────
async function testMFAPI() {
	divider('PLUGIN 2: MFAPI (mfapi.in) — FREE, no API key needed');

	const mf = new MFAPIPlugin();

	// Popular MF scheme codes
	const PARAG_PARIKH = 122639; // Parag Parikh Flexi Cap Direct
	const HDFC_MIDCAP = 118989;  // HDFC Mid-Cap Opportunities Direct
	const SBI_SMALL = 125497;    // SBI Small Cap Direct

	// 2a. Single NAV
	section('2a. Single Scheme NAV — Parag Parikh Flexi Cap');
	const nav = await safe('getSchemeNAV(122639)', () => mf.getSchemeNAV(PARAG_PARIKH));
	if (nav) json(nav);

	// 2b. Multiple NAVs (portfolio)
	section('2b. Batch NAVs — 3 fund portfolio');
	const navs = await safe('getMultipleNAVs([3 schemes])', () =>
		mf.getMultipleNAVs([PARAG_PARIKH, HDFC_MIDCAP, SBI_SMALL]),
	);
	if (navs) {
		for (const n of navs) {
			console.log(`    ${n.schemeCode}  NAV: ${n.nav.toFixed(4)}  ${n.schemeName.slice(0, 50)}  (${n.date})`);
		}
	}

	// 2c. NAV change (1d, 7d, 30d)
	section('2c. NAV Change — Parag Parikh 1d/7d/30d');
	for (const days of [1, 7, 30]) {
		const change = await safe(`getNAVChange(PPFAS, ${days}d)`, () => mf.getNAVChange(PARAG_PARIKH, days));
		if (change) {
			console.log(`    ${change.period.padEnd(5)} NAV: ${change.currentNAV.toFixed(4)} → was ${change.previousNAV.toFixed(4)}  Change: ${change.change >= 0 ? '+' : ''}${change.change.toFixed(4)} (${change.changePercent >= 0 ? '+' : ''}${change.changePercent.toFixed(2)}%)`);
		}
	}

	// 2d. Portfolio NAV changes
	section('2d. Portfolio NAV Changes — 7 day');
	const portfolioChanges = await safe('getPortfolioNAVChanges([3], 7)', () =>
		mf.getPortfolioNAVChanges([PARAG_PARIKH, HDFC_MIDCAP, SBI_SMALL], 7),
	);
	if (portfolioChanges) {
		for (const pc of portfolioChanges) {
			console.log(`    ${pc.schemeName.slice(0, 45).padEnd(45)}  ${pc.changePercent >= 0 ? '+' : ''}${pc.changePercent.toFixed(2)}%`);
		}
	}

	// 2e. Scheme details
	section('2e. Scheme Details — HDFC Mid-Cap');
	const details = await safe('getSchemeDetails(118989)', () => mf.getSchemeDetails(HDFC_MIDCAP));
	if (details) {
		console.log(`    Fund House: ${details.meta.fundHouse}`);
		console.log(`    Category:   ${details.meta.schemeCategory}`);
		console.log(`    Current NAV: ${details.currentNAV.nav} (${details.currentNAV.date})`);
		console.log(`    History entries: ${details.data.length}`);
		console.log(`    Oldest: ${details.data[details.data.length - 1]?.date}`);
	}

	// 2f. Search schemes
	section('2f. Search Schemes — "axis bluechip"');
	const schemes = await safe('searchSchemes("axis bluechip")', () => mf.searchSchemes('axis bluechip'));
	if (schemes) {
		console.log(`    Found ${schemes.length} results`);
		for (const s of schemes.slice(0, 5)) {
			console.log(`    ${s.schemeCode}  ${s.schemeName.slice(0, 70)}`);
		}
	}

	// 2g. Scheme history (last 30 days)
	section('2g. Scheme History — PPFAS last 30 days');
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const hist = await safe('getSchemeHistory(PPFAS, 30d)', () =>
		mf.getSchemeHistory({ schemeCode: PARAG_PARIKH, startDate: thirtyDaysAgo }),
	);
	if (hist) {
		console.log(`    Got ${hist.length} NAV entries`);
		for (const h of hist.slice(0, 5)) {
			console.log(`    ${h.date}  NAV: ${h.nav.toFixed(4)}`);
		}
		if (hist.length > 5) console.log(`    ... and ${hist.length - 5} more`);
	}
}

// ─── PLUGIN 3: RSS Feeds ────────────────────────────────────
async function testRSSFeeds() {
	divider('PLUGIN 3: RSS Feeds — FREE, no API key needed');

	const rss = new RSSFeedsPlugin();

	// 3a. List available feeds
	section('3a. Available Feed Sources');
	const feeds = rss.getAvailableFeeds();
	for (const f of feeds) {
		console.log(`    [${f.category.padEnd(16)}] ${f.name}`);
	}

	// 3b. Fetch all feeds
	section('3b. Fetch ALL feeds (parallel)');
	const allResults = await safe('fetchAllFeeds()', () => rss.fetchAllFeeds({ limitPerFeed: 5 }));
	if (allResults) {
		for (const r of allResults) {
			const status = r.error ? `ERROR: ${r.error}` : `${r.articles.length} articles`;
			console.log(`    [${r.category.padEnd(16)}] ${r.source.padEnd(35)} ${status}`);
		}
		const totalArticles = allResults.reduce((sum, r) => sum + r.articles.length, 0);
		const failedFeeds = allResults.filter((r) => r.error).length;
		console.log(`\n    Total: ${totalArticles} articles from ${allResults.length - failedFeeds}/${allResults.length} feeds`);
	}

	// 3c. Latest articles across all feeds
	section('3c. Latest Articles (top 10 across all feeds)');
	const latest = await safe('getLatestArticles(10)', () => rss.getLatestArticles(10));
	if (latest) {
		for (const a of latest) {
			const ago = Math.round((Date.now() - a.pubDate.getTime()) / 3600000);
			console.log(`    [${ago}h ago] [${a.source.slice(0, 20).padEnd(20)}] ${a.title.slice(0, 80)}`);
		}
	}

	// 3d. Category filtered — markets only
	section('3d. Markets category only (latest 5)');
	const markets = await safe('getLatestArticles(5, [markets])', () => rss.getLatestArticles(5, ['markets']));
	if (markets) {
		for (const a of markets) {
			console.log(`    [${a.source.slice(0, 25).padEnd(25)}] ${a.title.slice(0, 70)}`);
		}
	}

	// 3e. Search articles
	section('3e. Search Articles — "RBI" across all feeds');
	const rbiArticles = await safe('searchArticles("RBI")', () =>
		rss.searchArticles({ query: 'RBI', limit: 5 }),
	);
	if (rbiArticles) {
		console.log(`    Found ${rbiArticles.length} articles mentioning "RBI"`);
		for (const a of rbiArticles) {
			console.log(`    [${a.source.slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
		}
	}

	// 3f. Search for "gold"
	section('3f. Search Articles — "gold"');
	const goldArticles = await safe('searchArticles("gold")', () =>
		rss.searchArticles({ query: 'gold', limit: 5 }),
	);
	if (goldArticles) {
		console.log(`    Found ${goldArticles.length} articles mentioning "gold"`);
		for (const a of goldArticles) {
			console.log(`    [${a.source.slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
		}
	}

	// 3g. Add custom feed and test
	section('3g. Custom Feed — RBI press releases');
	rss.addFeed({
		name: 'RBI Press Releases',
		url: 'https://www.rbi.org.in/pressreleases_rss.xml',
		category: 'regulatory',
	});
	const rbiDirect = await safe('fetchFeed("RBI Press Releases")', () => rss.fetchFeed('RBI Press Releases', 5));
	if (rbiDirect) {
		console.log(`    ${rbiDirect.articles.length} articles from RBI`);
		for (const a of rbiDirect.articles) {
			console.log(`    ${a.pubDate.toISOString().split('T')[0]}  ${a.title.slice(0, 70)}`);
		}
	}
}

// ─── PLUGIN 4: SerpAPI News ─────────────────────────────────
async function testSerpNews() {
	divider('PLUGIN 4: SerpAPI News — Requires SERP_API_KEY (uses credits)');

	if (!config.serpApi.apiKey) {
		console.log('  SKIPPED: SERP_API_KEY not configured');
		return;
	}

	const serp = new SerpNewsPlugin();

	// 4a. General market news
	section('4a. General Market News');
	const marketNews = await safe('getMarketNews(limit=5)', () => serp.getMarketNews({ limit: 5 }));
	if (marketNews) {
		for (const a of marketNews) {
			console.log(`    [${(a.source || 'unknown').slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
			if (a.snippet) console.log(`      ${a.snippet.slice(0, 100)}`);
		}
	}

	// 4b. Stock-specific news
	section('4b. Stock News — Reliance');
	const stockNews = await safe('getStockNews("Reliance")', () =>
		serp.getStockNews({ symbol: 'Reliance', limit: 3 }),
	);
	if (stockNews) {
		for (const a of stockNews) {
			console.log(`    [${(a.source || '').slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
		}
	}

	// 4c. Sector news
	section('4c. Sector News — Banking');
	const sectorNews = await safe('getSectorNews("banking")', () =>
		serp.getSectorNews({ sector: 'banking', limit: 3 }),
	);
	if (sectorNews) {
		for (const a of sectorNews) {
			console.log(`    [${(a.source || '').slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
		}
	}

	// 4d. RBI/regulatory search
	section('4d. Financial Web Search — "RBI circular 2026"');
	const rbiSearch = await safe('searchFinancialWeb("RBI circular 2026")', () =>
		serp.searchFinancialWeb('RBI circular 2026', 5),
	);
	if (rbiSearch) {
		for (const a of rbiSearch) {
			console.log(`    [${(a.source || '').slice(0, 20).padEnd(20)}] ${a.title.slice(0, 70)}`);
			if (a.link) console.log(`      ${a.link}`);
		}
	}

	// 4e. Personalized news (simulating a user with holdings + interests)
	section('4e. Personalized News — Holdings: [Reliance, HDFC Bank], Interests: [mutual funds, gold]');
	const personalized = await safe('getPersonalizedNews()', () =>
		serp.getPersonalizedNews({
			holdings: ['Reliance', 'HDFC Bank'],
			interests: ['mutual funds', 'gold investment'],
			limitPerTopic: 2,
		}),
	);
	if (personalized) {
		for (const group of personalized) {
			console.log(`\n    [${group.type.toUpperCase()}] ${group.topic} — ${group.articles.length} articles`);
			for (const a of group.articles) {
				console.log(`      ${a.title.slice(0, 70)}`);
			}
		}
	}
}

// ─── MAIN ───────────────────────────────────────────────────
async function main() {
	console.log('╔══════════════════════════════════════════════════════════════════════╗');
	console.log('║          DAILY BRIEFING — PLUGIN DATA AVAILABILITY TEST             ║');
	console.log('╚══════════════════════════════════════════════════════════════════════╝');

	const start = Date.now();

	// Run free plugins first (no API key consumption)
	await testYahooFinance();
	await testMFAPI();
	await testRSSFeeds();
	// SerpAPI uses credits — run last
	await testSerpNews();

	divider(`ALL TESTS COMPLETE — Total time: ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch(console.error);
