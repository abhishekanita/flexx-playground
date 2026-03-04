import Parser from 'rss-parser';

const parser = new Parser({
	timeout: 10_000,
	headers: {
		'User-Agent':
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: 'application/rss+xml, application/xml, text/xml, */*',
	},
});

const feeds = [
	// Moneycontrol alternatives
	{ name: 'MC - Business', url: 'https://www.moneycontrol.com/rss/business.xml' },
	{ name: 'MC - Latest', url: 'https://www.moneycontrol.com/rss/latestnews.xml' },
	{ name: 'MC - MF', url: 'https://www.moneycontrol.com/rss/MFreport.xml' },
	{ name: 'MC - Economy', url: 'https://www.moneycontrol.com/rss/economy.xml' },

	// Business Standard alternatives
	{ name: 'BS - Finance', url: 'https://www.business-standard.com/rss/finance-10.rss' },
	{ name: 'BS - Markets Alt', url: 'https://www.business-standard.com/rss/markets-104.rss' },
	{ name: 'BS - Economy', url: 'https://www.business-standard.com/rss/economy-102.rss' },
	{ name: 'BS - Companies', url: 'https://www.business-standard.com/rss/companies-101.rss' },

	// NDTV alternatives
	{ name: 'NDTV Profit Latest', url: 'https://www.ndtvprofit.com/rss/latest' },
	{ name: 'NDTV FeedBurner', url: 'https://feeds.feedburner.com/ndtvprofit-latest' },

	// ET MF fix attempts
	{ name: 'ET - Stocks', url: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms' },
	{ name: 'ET - MF analysis', url: 'https://economictimes.indiatimes.com/mf/analysis/rssfeeds/15836498.cms' },

	// New free sources
	{ name: 'Finshots Daily', url: 'https://finshots.in/rss/' },
	{ name: 'Zerodha Varsity', url: 'https://zerodha.com/varsity/feed/' },
	{ name: 'FreeFincal', url: 'https://freefincal.com/feed/' },
	{ name: 'Capitalmind', url: 'https://www.capitalmind.in/feed/' },

	// Regulatory
	{ name: 'SEBI RSS', url: 'https://www.sebi.gov.in/sebiweb/ajax/RSSFeedAction.jsp' },
	{ name: 'RBI Press', url: 'https://www.rbi.org.in/pressreleases_rss.xml' },

	// Mint extra paths
	{ name: 'Mint - MF', url: 'https://www.livemint.com/rss/mutual-funds' },
	{ name: 'Mint - Insurance', url: 'https://www.livemint.com/rss/insurance' },
	{ name: 'Mint - Companies', url: 'https://www.livemint.com/rss/companies' },
	{ name: 'Mint - Industry', url: 'https://www.livemint.com/rss/industry' },
];

(async () => {
	console.log('Testing', feeds.length, 'RSS feeds...\n');

	const results = await Promise.allSettled(
		feeds.map(async (feed) => {
			const result = await parser.parseURL(feed.url);
			return { feed, count: result.items?.length || 0, sample: result.items?.[0]?.title?.slice(0, 55) };
		}),
	);

	const ok: string[] = [];
	const fail: string[] = [];

	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		const feed = feeds[i];
		if (r.status === 'fulfilled') {
			ok.push(`  [OK]   ${feed.name.padEnd(22)} ${String(r.value.count).padStart(3)} items | ${r.value.sample}`);
		} else {
			fail.push(`  [FAIL] ${feed.name.padEnd(22)} ${(r.reason?.message || 'unknown').slice(0, 50)}`);
		}
	}

	console.log('=== WORKING ===');
	ok.forEach((l) => console.log(l));
	console.log(`\n=== FAILED (${fail.length}) ===`);
	fail.forEach((l) => console.log(l));
	console.log(`\nSummary: ${ok.length}/${feeds.length} feeds working`);
})();
