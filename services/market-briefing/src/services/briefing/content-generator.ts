import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import logger from '@/utils/logger';
import { calculateCost, formatCost } from '@/utils/ai-cost';
import { normalizeUrl } from '@/schema';
import type { Types } from 'mongoose';
import type { ContentCategory, IContentPieceTags, IContentSource } from '@/schema';
import type { StockQuote, MacroQuote } from '@/plugins/yahoo-finance/types';
import type { RSSArticle } from '@/plugins/rss-feeds/types';
import type { NewsArticle } from '@/plugins/serp-news/types';
import type { CreatorVideo } from '@/plugins/youtube/types';
import type { CreatorReel } from '@/plugins/instagram/types';
import type {
	AggregatedDemand,
	RawDataBundle,
	ContentGenerationInput,
	ContentGenerationResult,
	GeneratedContent,
	MarketSignals,
	MacroSignals,
	SectorMove,
	NewsTheme,
	CreatorTopic,
} from './types';

const log = logger.createServiceLogger('ContentGenerator');

// ─── System Prompt Base ─────────────────────────────────────────

const SYSTEM_BASE = `You are a sharp financial content writer for an Indian daily briefing app.

VOICE:
- Write in professional English with natural Hindi sprinkled in (like how people talk in Indian offices)
- Conversational and punchy — like a smart colleague explaining markets at lunch
- NOT a news ticker. NOT a textbook. You're telling a STORY.

CONTENT RULES:
- Lead with a hook — why should I care? Don't start with numbers.
- Connect dots — link multiple data points into a narrative
- Answer "so what?" — every paragraph should tell the reader what this means for their money
- Use ₹ for Indian currency, Cr for crores, L for lakhs
- Be factual — no speculation, no direct buy/sell advice
- SEBI-compliant language (no guaranteed returns, no specific stock tips)

OUTPUT FORMAT (strict JSON):
{
  "title": "catchy, hook-driven headline (max 80 chars, NOT a data description)",
  "body": "the story (2-4 paragraphs, narrative-driven)",
  "tldr": "one punchy line (max 120 chars)",
  "durationSeconds": estimated_read_time_in_seconds
}

BAD TITLES: "TCS: Slight dip amid market fluctuations" / "Market update for today"
GOOD TITLES: "IT sector holds while everything bleeds — here's why" / "Crude at $85 — your Reliance and paint stocks feel the heat"

Return ONLY valid JSON. No markdown fences, no preamble.`;

// ─── Signal Detection ───────────────────────────────────────────

// Keyword lists for news clustering
const MACRO_KEYWORDS: Record<string, string[]> = {
	crude: ['crude', 'oil', 'brent', 'opec', 'petroleum'],
	rupee: ['rupee', 'inr', 'dollar', 'forex', 'currency', 'usd'],
	fii: ['fii', 'fpi', 'foreign investor', 'foreign institutional', 'dii'],
	rbi: ['rbi', 'reserve bank', 'monetary policy', 'repo rate', 'interest rate'],
};

const SECTOR_KEYWORDS: Record<string, string[]> = {
	IT: ['it', 'tech', 'software', 'tcs', 'infosys', 'hcltech', 'wipro', 'techm', 'ltimindtree'],
	Banking: ['bank', 'hdfc', 'icici', 'sbi', 'kotak', 'axis', 'nifty bank', 'banking'],
	Pharma: ['pharma', 'drug', 'sun pharma', "dr reddy", 'cipla', 'divis', 'healthcare'],
	Auto: ['auto', 'maruti', 'tata motors', 'mahindra', 'bajaj auto', 'eicher', 'vehicle'],
	Energy: ['reliance', 'ongc', 'power', 'energy', 'adani power', 'ntpc', 'coal'],
	FMCG: ['fmcg', 'itc', 'hul', 'hindustan unilever', 'nestle', 'dabur', 'consumer'],
	Metal: ['metal', 'steel', 'tata steel', 'jsw', 'hindalco', 'vedanta', 'aluminium'],
	Realty: ['realty', 'real estate', 'dlf', 'godrej properties', 'housing'],
};

export function detectSignals(data: RawDataBundle, demand: AggregatedDemand): MarketSignals {
	log.info('Detecting market signals...');

	// ── Market Mood ──
	const nifty = data.indexQuotes.find((q) => q.symbol === '^NSEI');
	const niftyChange = nifty?.changePercent ?? 0;

	let marketMood: MarketSignals['marketMood'];
	if (niftyChange <= -3) marketMood = 'crash';
	else if (niftyChange <= -1) marketMood = 'bearish';
	else if (niftyChange >= 3) marketMood = 'rally';
	else if (niftyChange >= 1) marketMood = 'bullish';
	else marketMood = 'flat';

	// ── Big Movers: |changePercent| > 1.5% OR volume > 1.5x avg ──
	const bigMovers = data.stockQuotes.filter((q) => {
		const bigChange = Math.abs(q.changePercent) > 1.5;
		const highVolume = q.averageVolume > 0 && q.volume > 1.5 * q.averageVolume;
		return bigChange || highVolume;
	});

	// ── Near 52W Extremes: within 5% ──
	const nearExtremes = data.stockQuotes.filter((q) => {
		if (!q.fiftyTwoWeekHigh || !q.fiftyTwoWeekLow) return false;
		const nearHigh = q.price >= q.fiftyTwoWeekHigh * 0.95;
		const nearLow = q.price <= q.fiftyTwoWeekLow * 1.05;
		return nearHigh || nearLow;
	});

	// ── Sector Patterns ──
	const sectorMoves = new Map<string, SectorMove>();
	for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
		const sectorStocks = data.stockQuotes.filter((q) => {
			const nameAndSymbol = `${q.name} ${q.symbol}`.toLowerCase();
			return keywords.some((kw) => nameAndSymbol.includes(kw));
		});
		if (sectorStocks.length >= 2) {
			const avgChange = sectorStocks.reduce((s, q) => s + q.changePercent, 0) / sectorStocks.length;
			if (Math.abs(avgChange) > 0.5) {
				sectorMoves.set(sector, {
					stocks: sectorStocks,
					avgChange,
					direction: avgChange >= 0 ? 'up' : 'down',
				});
			}
		}
	}

	// ── News Theme Clustering ──
	const allArticles: (RSSArticle | NewsArticle)[] = [
		...data.rssArticles,
		...data.marketNews,
	];

	const newsThemes: NewsTheme[] = [];
	const themeKeywords: Record<string, string[]> = {
		...MACRO_KEYWORDS,
		...Object.fromEntries(
			Object.entries(SECTOR_KEYWORDS).map(([sector, kws]) => [sector.toLowerCase(), kws]),
		),
		gold: ['gold', 'bullion', 'gold etf', 'precious metal'],
		gst: ['gst', 'goods and services tax', 'tax collection'],
		election: ['election', 'vote', 'poll', 'manifesto'],
		infrastructure: ['infra', 'infrastructure', 'road', 'highway', 'railway'],
	};

	for (const [theme, keywords] of Object.entries(themeKeywords)) {
		const matched = allArticles.filter((a) => {
			const text = `${a.title} ${'description' in a ? a.description : ''} ${'snippet' in a ? a.snippet : ''}`.toLowerCase();
			return keywords.some((kw) => text.includes(kw));
		});
		if (matched.length >= 2) {
			// Find related stock symbols
			const relatedSymbols = data.stockQuotes
				.filter((q) => {
					const nameAndSymbol = `${q.name} ${q.symbol}`.toLowerCase();
					return keywords.some((kw) => nameAndSymbol.includes(kw));
				})
				.map((q) => q.symbol);

			newsThemes.push({ theme, articles: matched, relatedSymbols });
		}
	}

	// Sort themes by article count desc
	newsThemes.sort((a, b) => b.articles.length - a.articles.length);

	// ── Macro Signals (real price data) ──
	const findMacro = (sym: string): MacroQuote | undefined =>
		data.macroQuotes.find((q) => q.symbol === sym);

	const usdinr = findMacro('USDINR=X');
	const brentCrude = findMacro('BZ=F');
	const wtiCrude = findMacro('CL=F');
	const goldFutures = findMacro('GC=F');
	const us10y = findMacro('^TNX');
	const globalIndices = data.macroQuotes.filter((q) => q.category === 'global-index');

	// Rupee: USDINR up = rupee weaker
	let rupeeTrend: MacroSignals['rupeeTrend'];
	if (usdinr) {
		if (usdinr.changePercent > 0.3) rupeeTrend = 'weakening';
		else if (usdinr.changePercent < -0.3) rupeeTrend = 'strengthening';
		else rupeeTrend = 'stable';
	}

	// Crude: use Brent as primary, WTI as fallback
	let crudeTrend: MacroSignals['crudeTrend'];
	const crudeRef = brentCrude || wtiCrude;
	if (crudeRef) {
		if (crudeRef.changePercent > 2) crudeTrend = 'rising';
		else if (crudeRef.changePercent < -2) crudeTrend = 'falling';
		else crudeTrend = 'stable';
	}

	// FII: directly from flow trend
	const fiiFlow = data.fiiDiiTrend.direction;

	const macroSignals: MacroSignals = {
		usdinr,
		brentCrude,
		wtiCrude,
		goldFutures,
		us10y,
		globalIndices,
		fiiDiiTrend: data.fiiDiiTrend,
		rupeeTrend,
		crudeTrend,
		fiiFlow,
		rbiActions: data.rbiArticles,
	};

	// ── MF Notable ──
	const mfNotable: MarketSignals['mfNotable'] = [];
	for (const nav of data.mfNAVs) {
		const change = data.mfNAVChanges.find((c) => c.schemeCode === nav.schemeCode);
		if (change && Math.abs(change.changePercent) > 0.5) {
			mfNotable.push({ nav, change });
		}
	}

	// ── Creator Topic Clustering ──
	const creatorTopics = detectCreatorTopics(data.creatorVideos, data.creatorReels);

	log.info(
		`Signals detected: mood=${marketMood}, bigMovers=${bigMovers.length}, nearExtremes=${nearExtremes.length}, ` +
		`sectors=${sectorMoves.size}, themes=${newsThemes.length}, mfNotable=${mfNotable.length}, ` +
		`creatorTopics=${creatorTopics.length}`,
	);

	return {
		marketMood,
		niftyChange,
		bigMovers,
		nearExtremes,
		sectorMoves,
		newsThemes,
		macroSignals,
		mfNotable,
		creatorTopics,
	};
}

// ─── Content Generation Orchestrator ────────────────────────────

export async function generateAllContent(
	data: RawDataBundle,
	demand: AggregatedDemand,
	pipelineRunId: Types.ObjectId,
): Promise<ContentGenerationResult[]> {
	log.info('Starting narrative content generation...');

	// Build URL → ObjectId lookup from persisted articles
	const urlToArticleId = new Map<string, Types.ObjectId>();
	for (const article of data.savedArticles) {
		urlToArticleId.set(normalizeUrl(article.url), article._id as Types.ObjectId);
	}
	log.info(`Article lookup map: ${urlToArticleId.size} entries`);

	// Phase 1: Detect signals across all data
	const signals = detectSignals(data, demand);

	// Phase 2: Build story inputs conditionally
	const inputs: ContentGenerationInput[] = [];

	// 1. Big Story — always generated
	inputs.push(buildBigStory(signals, data, urlToArticleId));

	// 2. Portfolio Impact — only if holdings had notable moves
	const portfolioInput = buildPortfolioImpact(signals, data, demand, urlToArticleId);
	if (portfolioInput) inputs.push(portfolioInput);

	// 3. Sleeper Story — only if there's a contrarian/hidden signal
	const sleeperInput = buildSleeperStory(signals, data, urlToArticleId);
	if (sleeperInput) inputs.push(sleeperInput);

	// 4. Opportunity/Risk — only if stocks near extremes
	const oppInput = buildOpportunityRisk(signals, data, urlToArticleId);
	if (oppInput) inputs.push(oppInput);

	// 5. Global Connect — only if significant global-India connection
	const globalInput = buildGlobalConnect(signals, data, urlToArticleId);
	if (globalInput) inputs.push(globalInput);

	// 6. Quick Hits — always generated
	inputs.push(buildQuickHits(signals, data, urlToArticleId));

	// 7. Creator Buzz — only if creators converge on a topic or high engagement
	const creatorBuzzInput = buildCreatorBuzz(signals, data);
	if (creatorBuzzInput) inputs.push(creatorBuzzInput);

	// 8. Your Move — always generated
	inputs.push(buildYourMove(signals, data, demand));

	log.info(`Prepared ${inputs.length} narrative content inputs (from 8 story types)`);

	// Execute all LLM calls (with concurrency limit)
	const results = await executeGenerations(inputs);

	log.info(`Generated ${results.length} narrative content pieces`);
	const totalCost = results.reduce((sum, r) => sum + r.costUSD, 0);
	log.info(`Total LLM cost: ${formatCost(totalCost)}`);

	return results;
}

// ─── Source Helpers ──────────────────────────────────────────────

function resolveArticleId(url: string, urlToArticleId: Map<string, Types.ObjectId>): Types.ObjectId | undefined {
	return urlToArticleId.get(normalizeUrl(url));
}

function buildSource(
	title: string,
	url: string,
	source: string,
	urlToArticleId?: Map<string, Types.ObjectId>,
): IContentSource {
	const s: IContentSource = { title, url, source };
	if (urlToArticleId) {
		const articleId = resolveArticleId(url, urlToArticleId);
		if (articleId) s.articleId = articleId;
	}
	return s;
}

// ─── Formatting Helpers ─────────────────────────────────────────

function fmtPct(val: number): string {
	return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function fmtPrice(val: number): string {
	return `₹${val.toFixed(2)}`;
}

function stockSummary(q: StockQuote): string {
	const volRatio = q.averageVolume > 0 ? (q.volume / q.averageVolume).toFixed(1) : 'N/A';
	let line = `${q.name} (${q.symbol}): ${fmtPrice(q.price)} (${fmtPct(q.changePercent)}), Vol: ${q.volume.toLocaleString()} (${volRatio}x avg)`;
	if (q.fiftyTwoWeekHigh && q.price >= q.fiftyTwoWeekHigh * 0.95) {
		line += ` — near 52W HIGH (${fmtPrice(q.fiftyTwoWeekHigh)})`;
	}
	if (q.fiftyTwoWeekLow && q.price <= q.fiftyTwoWeekLow * 1.05) {
		line += ` — near 52W LOW (${fmtPrice(q.fiftyTwoWeekLow)})`;
	}
	return line;
}

function articleLine(a: RSSArticle | NewsArticle): string {
	return `- ${a.title} [${a.source}]`;
}

function articleUrl(a: RSSArticle | NewsArticle): string {
	return a.link;
}

// ─── Story Builders ─────────────────────────────────────────────

function buildBigStory(
	signals: MarketSignals,
	data: RawDataBundle,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput {
	const indexSummary = data.indexQuotes
		.map((idx) => `${idx.name}: ${idx.price.toFixed(2)} (${fmtPct(idx.changePercent)})`)
		.join('\n');

	// Top theme
	const topTheme = signals.newsThemes[0];
	const themeText = topTheme
		? `Dominant news theme: "${topTheme.theme}" (${topTheme.articles.length} articles)\nKey headlines:\n${topTheme.articles.slice(0, 4).map(articleLine).join('\n')}`
		: '';

	// Macro context — real prices
	const macroLines: string[] = [];
	if (signals.macroSignals.brentCrude) {
		const q = signals.macroSignals.brentCrude;
		macroLines.push(`Brent Crude: $${q.price.toFixed(2)} (${fmtPct(q.changePercent)}) — ${signals.macroSignals.crudeTrend || 'stable'}`);
	}
	if (signals.macroSignals.usdinr) {
		const q = signals.macroSignals.usdinr;
		macroLines.push(`USD/INR: ₹${q.price.toFixed(2)} (${fmtPct(q.changePercent)}) — rupee ${signals.macroSignals.rupeeTrend || 'stable'}`);
	}
	if (signals.macroSignals.fiiDiiTrend.today) {
		macroLines.push(`FII/DII: ${signals.macroSignals.fiiDiiTrend.narrative} (${signals.macroSignals.fiiFlow})`);
	}
	if (signals.macroSignals.goldFutures) {
		const q = signals.macroSignals.goldFutures;
		macroLines.push(`Gold Futures: $${q.price.toFixed(2)} (${fmtPct(q.changePercent)})`);
	}
	if (signals.macroSignals.us10y) {
		const q = signals.macroSignals.us10y;
		macroLines.push(`US 10Y Yield: ${q.price.toFixed(2)}% (${fmtPct(q.changePercent)})`);
	}
	const macroText = macroLines.length > 0 ? `Macro data:\n${macroLines.join('\n')}` : '';

	// Sector summary
	const sectorLines = [...signals.sectorMoves.entries()]
		.sort((a, b) => Math.abs(b[1].avgChange) - Math.abs(a[1].avgChange))
		.slice(0, 4)
		.map(([name, s]) => `${name}: avg ${fmtPct(s.avgChange)} (${s.stocks.length} stocks ${s.direction})`);
	const sectorText = sectorLines.length > 0 ? `Sector moves:\n${sectorLines.join('\n')}` : '';

	// Big movers
	const moverText = signals.bigMovers.length > 0
		? `Notable movers:\n${signals.bigMovers.slice(0, 5).map(stockSummary).join('\n')}`
		: '';

	// Sources from theme articles
	const sources: IContentSource[] = [];
	if (topTheme) {
		for (const a of topTheme.articles.slice(0, 3)) {
			sources.push(buildSource(a.title, articleUrl(a), a.source, urlMap));
		}
	}

	return {
		category: 'market-pulse',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `What's THE story in Indian markets today? Connect the dots across multiple signals into one compelling narrative.

Market mood: ${signals.marketMood.toUpperCase()} (Nifty: ${fmtPct(signals.niftyChange)})

Index data:
${indexSummary}

${macroText}

${sectorText}

${moverText}

${themeText}

Write the day's dominant narrative. Connect 3-4 signals together — don't just list them. Lead with a hook. Tell the reader why they should care. 200-300 words.`,
		tags: { isUniversal: true },
		sources,
		priority: 1,
	};
}

function buildPortfolioImpact(
	signals: MarketSignals,
	data: RawDataBundle,
	demand: AggregatedDemand,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput | null {
	// Filter to user-held stocks that actually moved
	const heldSymbols = new Set(demand.symbols);
	const notableHeld = [...signals.bigMovers, ...signals.nearExtremes].filter(
		(q) => heldSymbols.has(q.symbol),
	);

	// Deduplicate
	const seen = new Set<string>();
	const unique = notableHeld.filter((q) => {
		if (seen.has(q.symbol)) return false;
		seen.add(q.symbol);
		return true;
	});

	if (unique.length === 0) return null;

	// Group by sector if possible
	const sectorGroups = new Map<string, StockQuote[]>();
	for (const q of unique) {
		let assigned = false;
		for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
			const nameAndSymbol = `${q.name} ${q.symbol}`.toLowerCase();
			if (keywords.some((kw) => nameAndSymbol.includes(kw))) {
				const group = sectorGroups.get(sector) || [];
				group.push(q);
				sectorGroups.set(sector, group);
				assigned = true;
				break;
			}
		}
		if (!assigned) {
			const group = sectorGroups.get('Other') || [];
			group.push(q);
			sectorGroups.set('Other', group);
		}
	}

	let holdingsText = '';
	for (const [sector, stocks] of sectorGroups) {
		holdingsText += `\n[${sector}]\n`;
		for (const q of stocks) {
			holdingsText += `${stockSummary(q)}\n`;
		}
	}

	// MF notable
	const heldSchemes = new Set(demand.schemeCodes);
	const notableMF = signals.mfNotable.filter((m) => heldSchemes.has(m.nav.schemeCode));
	let mfText = '';
	if (notableMF.length > 0) {
		mfText = '\nMutual Funds with notable moves:\n';
		for (const m of notableMF) {
			mfText += `${m.nav.schemeName}: NAV ${fmtPrice(m.nav.nav)} (${fmtPct(m.change.changePercent)})\n`;
		}
	}

	// Collect sources from stock news
	const sources: IContentSource[] = [];
	for (const q of unique.slice(0, 5)) {
		const news = data.stockNews.get(q.symbol);
		if (news && news.length > 0) {
			sources.push(buildSource(news[0].title, news[0].link, news[0].source, urlMap));
		}
	}

	const allSymbols = unique.map((q) => q.symbol);

	return {
		category: 'portfolio-update',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `How did the user's holdings perform today? Group by sector, connect moves to the day's narrative, and explain WHY — not just what.

Market context: ${signals.marketMood.toUpperCase()} day (Nifty: ${fmtPct(signals.niftyChange)})

Holdings that moved significantly:
${holdingsText}
${mfText}

Write a GROUPED portfolio update. Don't list stocks one by one — group by sector/theme, explain the common driver, and tell the reader what this means for their portfolio. 150-250 words.`,
		tags: { symbols: allSymbols, schemeCodes: notableMF.map((m) => m.nav.schemeCode) },
		sources,
		priority: 2,
	};
}

function buildSleeperStory(
	signals: MarketSignals,
	data: RawDataBundle,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput | null {
	// Look for contrarian signals
	const contrarians: string[] = [];
	const sources: IContentSource[] = [];

	// Sectors going against market
	for (const [sector, move] of signals.sectorMoves) {
		if (signals.marketMood === 'bearish' || signals.marketMood === 'crash') {
			if (move.direction === 'up' && move.avgChange > 0.5) {
				contrarians.push(`${sector} sector UP (avg ${fmtPct(move.avgChange)}) despite market being down`);
			}
		} else if (signals.marketMood === 'bullish' || signals.marketMood === 'rally') {
			if (move.direction === 'down' && move.avgChange < -0.5) {
				contrarians.push(`${sector} sector DOWN (avg ${fmtPct(move.avgChange)}) despite market being up`);
			}
		}
	}

	// Stocks going opposite to market
	for (const q of signals.bigMovers) {
		if ((signals.niftyChange < -1 && q.changePercent > 2) || (signals.niftyChange > 1 && q.changePercent < -2)) {
			contrarians.push(`${q.name} (${q.symbol}): ${fmtPct(q.changePercent)} — bucking the trend`);
		}
	}

	// Non-headline news themes (skip the top theme used in Big Story)
	const sleeperThemes = signals.newsThemes
		.slice(1) // skip dominant theme
		.filter((t) => t.articles.length >= 2)
		.slice(0, 2);

	for (const theme of sleeperThemes) {
		contrarians.push(`Under-the-radar theme: "${theme.theme}" — ${theme.articles.length} articles`);
		for (const a of theme.articles.slice(0, 2)) {
			sources.push(buildSource(a.title, articleUrl(a), a.source, urlMap));
		}
	}

	if (contrarians.length === 0) return null;

	return {
		category: 'news-digest',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `Something important that most people missed today. Find the hidden story.

Market mood: ${signals.marketMood.toUpperCase()} (Nifty: ${fmtPct(signals.niftyChange)})

Contrarian/hidden signals:
${contrarians.join('\n')}

${sleeperThemes.length > 0 ? `Related headlines:\n${sleeperThemes.flatMap((t) => t.articles.slice(0, 3)).map(articleLine).join('\n')}` : ''}

Write a "what everyone's missing" piece. Lead with the surprise, explain why it matters, and what it could mean going forward. 150-200 words.`,
		tags: { isUniversal: true },
		sources,
		priority: 3,
	};
}

function buildOpportunityRisk(
	signals: MarketSignals,
	data: RawDataBundle,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput | null {
	if (signals.nearExtremes.length === 0) return null;

	const stockDetails = signals.nearExtremes.slice(0, 4).map((q) => {
		const news = data.stockNews.get(q.symbol) || [];
		const newsText = news.slice(0, 2).map((n) => `  - ${n.title}`).join('\n');
		const isNearHigh = q.fiftyTwoWeekHigh && q.price >= q.fiftyTwoWeekHigh * 0.95;

		// Find sector context
		let sectorContext = '';
		for (const [sector, move] of signals.sectorMoves) {
			if (move.stocks.some((s) => s.symbol === q.symbol)) {
				sectorContext = `Sector (${sector}): avg ${fmtPct(move.avgChange)}`;
				break;
			}
		}

		return `${stockSummary(q)}
  Position: near 52-week ${isNearHigh ? 'HIGH' : 'LOW'}
  ${sectorContext}
${newsText ? `  Recent news:\n${newsText}` : '  No specific news found'}`;
	}).join('\n\n');

	const sources: IContentSource[] = [];
	for (const q of signals.nearExtremes.slice(0, 4)) {
		const news = data.stockNews.get(q.symbol);
		if (news && news.length > 0) {
			sources.push(buildSource(news[0].title, news[0].link, news[0].source, urlMap));
		}
	}

	return {
		category: 'stock-deep-dive',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `These stocks are near their 52-week extremes. Present both bull and bear case — opportunity or trap?

Market context: ${signals.marketMood.toUpperCase()} day (Nifty: ${fmtPct(signals.niftyChange)})

Stocks near 52W extremes:
${stockDetails}

For each stock (or group if they share a theme), present:
1. The bull case — why this could be an opportunity
2. The bear case — why this could be a trap
Do NOT give direct advice. Present both sides factually. 200-300 words.`,
		tags: { symbols: signals.nearExtremes.slice(0, 4).map((q) => q.symbol) },
		sources,
		priority: 2,
	};
}

function buildGlobalConnect(
	signals: MarketSignals,
	data: RawDataBundle,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput | null {
	const hasGlobalSignal = signals.macroSignals.crudeTrend ||
		signals.macroSignals.rupeeTrend ||
		signals.macroSignals.fiiFlow ||
		signals.macroSignals.globalIndices.length > 0;

	if (!hasGlobalSignal) return null;

	// Gather global-related articles
	const globalKeywords = [...MACRO_KEYWORDS.crude, ...MACRO_KEYWORDS.rupee, ...MACRO_KEYWORDS.fii, 'global', 'us market', 'fed', 'china', 'middle east', 'tariff', 'trade war'];
	const globalArticles = [...data.rssArticles, ...data.marketNews].filter((a) => {
		const text = `${a.title} ${'description' in a ? a.description : ''} ${'snippet' in a ? a.snippet : ''}`.toLowerCase();
		return globalKeywords.some((kw) => text.includes(kw));
	});

	// Real price data for macro signals
	const macroLines: string[] = [];
	if (signals.macroSignals.brentCrude) {
		const q = signals.macroSignals.brentCrude;
		macroLines.push(`Brent Crude: $${q.price.toFixed(2)} (${fmtPct(q.changePercent)}) — ${signals.macroSignals.crudeTrend || 'stable'}`);
	}
	if (signals.macroSignals.usdinr) {
		const q = signals.macroSignals.usdinr;
		macroLines.push(`USD/INR: ₹${q.price.toFixed(2)} (${fmtPct(q.changePercent)}) — rupee ${signals.macroSignals.rupeeTrend || 'stable'}`);
	}
	if (signals.macroSignals.fiiDiiTrend.today) {
		macroLines.push(`FII/DII: ${signals.macroSignals.fiiDiiTrend.narrative}`);
	}
	if (signals.macroSignals.us10y) {
		const q = signals.macroSignals.us10y;
		macroLines.push(`US 10Y Yield: ${q.price.toFixed(2)}% (${fmtPct(q.changePercent)})`);
	}

	// Global indices table
	let globalIndicesText = '';
	if (signals.macroSignals.globalIndices.length > 0) {
		const lines = signals.macroSignals.globalIndices.map((q) =>
			`${q.name}: ${q.price.toFixed(2)} (${fmtPct(q.changePercent)})`,
		);
		globalIndicesText = `\nGlobal Indices:\n${lines.join('\n')}`;
	}

	if (macroLines.length === 0 && globalArticles.length === 0) return null;

	const sources = globalArticles.slice(0, 4).map((a) =>
		buildSource(a.title, articleUrl(a), a.source, urlMap),
	);

	return {
		category: 'news-digest',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `How are global events affecting Indian markets? Connect the domino chain.

Macro data:
${macroLines.join('\n')}
${globalIndicesText}

${globalArticles.length > 0 ? `Global-related headlines:\n${globalArticles.slice(0, 6).map(articleLine).join('\n')}` : ''}

Market impact: Nifty ${fmtPct(signals.niftyChange)}, mood: ${signals.marketMood.toUpperCase()}

Write a "domino effect" piece: global event → transmission mechanism → impact on Indian markets/investor.
Show the chain of causation clearly. Use the actual numbers provided. 150-200 words.`,
		tags: { isUniversal: true },
		sources,
		priority: 3,
	};
}

function buildQuickHits(
	signals: MarketSignals,
	data: RawDataBundle,
	urlMap: Map<string, Types.ObjectId>,
): ContentGenerationInput {
	const bullets: string[] = [];
	const sources: IContentSource[] = [];

	// RBI updates
	if (signals.macroSignals.rbiActions.length > 0) {
		for (const a of signals.macroSignals.rbiActions.slice(0, 2)) {
			bullets.push(`RBI: ${a.title}`);
			sources.push(buildSource(a.title, a.link, a.source, urlMap));
		}
	}

	// Real macro data bullets
	if (signals.macroSignals.goldFutures) {
		const q = signals.macroSignals.goldFutures;
		bullets.push(`Gold Futures: $${q.price.toFixed(2)} (${fmtPct(q.changePercent)})`);
	}
	if (signals.macroSignals.us10y) {
		const q = signals.macroSignals.us10y;
		bullets.push(`US 10Y Treasury Yield: ${q.price.toFixed(2)}% (${fmtPct(q.changePercent)})`);
	}
	if (signals.macroSignals.fiiDiiTrend.today) {
		bullets.push(`FII/DII flows: ${signals.macroSignals.fiiDiiTrend.narrative}`);
	}

	// MF changes
	for (const m of signals.mfNotable.slice(0, 2)) {
		bullets.push(`${m.nav.schemeName}: NAV ${fmtPrice(m.nav.nav)} (${fmtPct(m.change.changePercent)})`);
	}

	// Minor news not covered by main stories (themes beyond the top 3)
	const minorThemes = signals.newsThemes.slice(3);
	for (const theme of minorThemes.slice(0, 2)) {
		if (theme.articles.length > 0) {
			bullets.push(`${theme.articles[0].title}`);
			sources.push(buildSource(theme.articles[0].title, articleUrl(theme.articles[0]), theme.articles[0].source, urlMap));
		}
	}

	// Any remaining interesting articles not in themes
	const themedUrls = new Set(
		signals.newsThemes.flatMap((t) => t.articles.map((a) => articleUrl(a))),
	);
	const uncovered = [...data.rssArticles, ...data.marketNews]
		.filter((a) => !themedUrls.has(articleUrl(a)))
		.slice(0, 3);
	for (const a of uncovered) {
		bullets.push(a.title);
		sources.push(buildSource(a.title, articleUrl(a), a.source, urlMap));
	}

	// Ensure at least some content
	if (bullets.length === 0) {
		for (const a of data.rssArticles.slice(0, 4)) {
			bullets.push(a.title);
			sources.push(buildSource(a.title, a.link, a.source, urlMap));
		}
	}

	return {
		category: 'news-digest',
		model: 'gpt-4.1-nano',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `Write a rapid-fire "quick hits" piece — everything notable that didn't make the main stories today.

Items to cover:
${bullets.map((b) => `- ${b}`).join('\n')}

Format as 4-6 bullet points, each 1-2 sentences. Punchy and informative. Cover the breadth, don't go deep. Under 150 words total.`,
		tags: { isUniversal: true },
		sources: sources.slice(0, 5),
		priority: 4,
		subcategory: 'quick-hits',
	};
}

function buildYourMove(
	signals: MarketSignals,
	data: RawDataBundle,
	demand: AggregatedDemand,
): ContentGenerationInput {
	const today = new Date();
	const dayOfWeek = today.getDay();
	const dayOfMonth = today.getDate();

	const contextParts: string[] = [];

	// Day-specific context
	if (dayOfWeek === 1) contextParts.push("It's Monday — start of a new trading week.");
	else if (dayOfWeek === 5) contextParts.push("It's Friday — last trading day this week, time to take stock.");
	else if (dayOfWeek === 0 || dayOfWeek === 6) contextParts.push('Markets are closed for the weekend.');

	// SIP context
	const sipDates = [1, 5, 7, 10, 15, 20, 25]; // Common SIP dates
	if (sipDates.includes(dayOfMonth) || sipDates.includes(dayOfMonth + 1) || sipDates.includes(dayOfMonth + 2)) {
		contextParts.push(`Near common SIP dates (around ${dayOfMonth}th). Many investors have SIPs scheduled this week.`);
	}

	// Market context
	const nifty = data.indexQuotes.find((q) => q.symbol === '^NSEI');
	if (nifty) {
		contextParts.push(`Nifty at ${nifty.price.toFixed(0)} (${fmtPct(nifty.changePercent)})`);
	}
	contextParts.push(`Market mood: ${signals.marketMood}`);

	// Notable situations
	if (signals.marketMood === 'crash' || signals.marketMood === 'bearish') {
		contextParts.push('Market is significantly down — potential SIP/averaging opportunity for long-term investors.');
	} else if (signals.marketMood === 'rally' || signals.marketMood === 'bullish') {
		contextParts.push('Market is up strongly — good day to review if any portfolio rebalancing is due.');
	}

	if (signals.nearExtremes.length > 0) {
		const extremeNames = signals.nearExtremes.slice(0, 3).map((q) => q.name).join(', ');
		contextParts.push(`Stocks near 52W extremes: ${extremeNames}`);
	}

	return {
		category: 'action-item',
		model: 'gpt-4.1-nano',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `Write ONE specific, actionable takeaway connected to today's actual market conditions. NOT generic — tie it to real signals.

Context:
${contextParts.join('\n')}

Write a single actionable point in 2-3 sentences. Be specific to today's conditions, not generic advice like "review your portfolio."
Examples of good output:
- "Market's down 2% — if you have SIPs scheduled this week, this dip works in your favor. Rupee cost averaging does its magic on days like this."
- "Nifty at all-time high — if you've been sitting on profits in mid-caps, today might be a good day to book partial gains."
Under 80 words.`,
		tags: { isUniversal: true },
		sources: [],
		priority: 4,
	};
}

// ─── Creator Topic Detection ────────────────────────────────────

const CREATOR_TOPIC_KEYWORDS: Record<string, string[]> = {
	...MACRO_KEYWORDS,
	...Object.fromEntries(
		Object.entries(SECTOR_KEYWORDS).map(([sector, kws]) => [sector.toLowerCase(), kws]),
	),
	sip: ['sip', 'systematic investment', 'monthly investment'],
	tax: ['tax', 'income tax', 'capital gains', 'ltcg', 'stcg', 'section 80'],
	ipo: ['ipo', 'initial public offering', 'listing'],
	crypto: ['crypto', 'bitcoin', 'ethereum', 'web3'],
	'real-estate': ['real estate', 'property', 'home loan', 'flat', 'rent vs buy'],
	insurance: ['insurance', 'term plan', 'lic', 'health insurance'],
	sebi: ['sebi', 'regulation', 'mutual fund regulation'],
	nps: ['nps', 'national pension', 'pension'],
	gold: ['gold', 'sovereign gold bond', 'gold etf', 'sgb'],
};

function detectCreatorTopics(videos: CreatorVideo[], reels: CreatorReel[]): CreatorTopic[] {
	const topicMap = new Map<string, {
		creators: Set<string>;
		videoCount: number;
		reelCount: number;
		sampleTitles: string[];
		totalEngagement: number;
	}>();

	const matchTopics = (text: string): string[] => {
		const lower = text.toLowerCase();
		const matched: string[] = [];
		for (const [topic, keywords] of Object.entries(CREATOR_TOPIC_KEYWORDS)) {
			if (keywords.some((kw) => lower.includes(kw))) {
				matched.push(topic);
			}
		}
		return matched;
	};

	for (const video of videos) {
		const text = `${video.title} ${video.description} ${video.tags.join(' ')}`;
		const topics = matchTopics(text);
		for (const topic of topics) {
			const entry = topicMap.get(topic) || {
				creators: new Set(), videoCount: 0, reelCount: 0, sampleTitles: [], totalEngagement: 0,
			};
			entry.creators.add(video.channelName);
			entry.videoCount++;
			if (entry.sampleTitles.length < 3) entry.sampleTitles.push(video.title);
			entry.totalEngagement += video.viewCount + video.likeCount + video.commentCount;
			topicMap.set(topic, entry);
		}
	}

	for (const reel of reels) {
		const text = `${reel.caption} ${reel.hashtags.join(' ')}`;
		const topics = matchTopics(text);
		for (const topic of topics) {
			const entry = topicMap.get(topic) || {
				creators: new Set(), videoCount: 0, reelCount: 0, sampleTitles: [], totalEngagement: 0,
			};
			entry.creators.add(reel.displayName || reel.username);
			entry.reelCount++;
			if (entry.sampleTitles.length < 3) entry.sampleTitles.push(reel.caption.slice(0, 80));
			entry.totalEngagement += reel.viewCount + reel.likeCount + reel.commentCount;
			topicMap.set(topic, entry);
		}
	}

	const topics: CreatorTopic[] = [];
	for (const [topic, data] of topicMap) {
		topics.push({
			topic,
			creators: [...data.creators],
			videoCount: data.videoCount,
			reelCount: data.reelCount,
			sampleTitles: data.sampleTitles,
			totalEngagement: data.totalEngagement,
		});
	}

	// Sort by creator count (convergence signal), then engagement
	topics.sort((a, b) => b.creators.length - a.creators.length || b.totalEngagement - a.totalEngagement);

	return topics;
}

function buildCreatorBuzz(
	signals: MarketSignals,
	data: RawDataBundle,
): ContentGenerationInput | null {
	const { creatorTopics } = signals;

	// Check high-engagement individual content (> 100K views)
	const viralVideos = data.creatorVideos.filter((v) => v.viewCount > 100_000);
	const viralReels = data.creatorReels.filter((r) => r.viewCount > 100_000);

	// Trigger: >= 2 creators on same topic OR any viral content
	const convergentTopics = creatorTopics.filter((t) => t.creators.length >= 2);
	const hasViral = viralVideos.length > 0 || viralReels.length > 0;

	if (convergentTopics.length === 0 && !hasViral) return null;

	// Build prompt data
	const topicLines: string[] = [];
	for (const topic of convergentTopics.slice(0, 3)) {
		topicLines.push(
			`Topic: "${topic.topic}" — ${topic.creators.length} creators (${topic.creators.join(', ')})` +
			`\n  ${topic.videoCount} videos, ${topic.reelCount} reels, ${(topic.totalEngagement / 1000).toFixed(0)}K total engagement` +
			`\n  Sample content: ${topic.sampleTitles.slice(0, 2).join(' | ')}`,
		);
	}

	const viralLines: string[] = [];
	for (const v of viralVideos.slice(0, 3)) {
		viralLines.push(`YouTube: "${v.title}" by ${v.channelName} — ${(v.viewCount / 1000).toFixed(0)}K views`);
	}
	for (const r of viralReels.slice(0, 3)) {
		viralLines.push(`Instagram: "${r.caption.slice(0, 60)}..." by @${r.username} — ${(r.viewCount / 1000).toFixed(0)}K views`);
	}

	const promptParts: string[] = [];
	if (topicLines.length > 0) {
		promptParts.push(`Creator convergence (multiple creators discussing the same topic):\n${topicLines.join('\n\n')}`);
	}
	if (viralLines.length > 0) {
		promptParts.push(`Viral creator content:\n${viralLines.join('\n')}`);
	}

	return {
		category: 'news-digest',
		model: 'gpt-4.1-mini',
		systemPrompt: SYSTEM_BASE,
		userPrompt: `What are Indian finance creators buzzing about? When multiple creators talk about the same topic, retail investors are paying attention.

Market context: ${signals.marketMood.toUpperCase()} day (Nifty: ${fmtPct(signals.niftyChange)})

${promptParts.join('\n\n')}

Write a "Creator Buzz" piece: what are finance YouTubers and Instagram creators talking about, why does it matter, and how does it connect to today's market? Name the creators. Be specific about what they're saying. 150-200 words.`,
		tags: { isUniversal: true },
		sources: [],
		priority: 3,
		subcategory: 'creator-buzz',
	};
}

// ─── LLM Execution ─────────────────────────────────────────────

const MAX_CONCURRENT = 5;

async function executeGenerations(
	inputs: ContentGenerationInput[],
): Promise<ContentGenerationResult[]> {
	const results: ContentGenerationResult[] = [];
	const batches: ContentGenerationInput[][] = [];

	// Split into batches for concurrency control
	for (let i = 0; i < inputs.length; i += MAX_CONCURRENT) {
		batches.push(inputs.slice(i, i + MAX_CONCURRENT));
	}

	for (const batch of batches) {
		const batchResults = await Promise.allSettled(
			batch.map((input) => generateSingleContent(input)),
		);

		for (let i = 0; i < batchResults.length; i++) {
			const result = batchResults[i];
			if (result.status === 'fulfilled' && result.value) {
				results.push(result.value);
			} else if (result.status === 'rejected') {
				log.error(`Content generation failed for ${batch[i].category}: ${result.reason?.message}`);
			}
		}
	}

	return results;
}

async function generateSingleContent(
	input: ContentGenerationInput,
): Promise<ContentGenerationResult> {
	log.info(`Generating: ${input.category}${input.subcategory ? ` (${input.subcategory})` : ''} (model: ${input.model})`);

	const result = await generateText({
		model: openai(input.model),
		system: input.systemPrompt,
		prompt: input.userPrompt,
		maxOutputTokens: 1000,
		temperature: 0.7,
	});

	// Parse the response
	const text = result.text.trim();
	let content: GeneratedContent;

	try {
		// Strip markdown fences if present
		const jsonStr = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
		content = JSON.parse(jsonStr);
	} catch {
		// Fallback: treat entire response as body
		log.warn(`Failed to parse JSON for ${input.category}, using raw text`);
		content = {
			title: `${input.category} update`,
			body: text,
			tldr: text.slice(0, 120),
			durationSeconds: Math.ceil(text.split(/\s+/).length / 3), // ~3 words/sec for audio
		};
	}

	// Calculate cost
	const usage = result.usage;
	const inputTokens = usage.inputTokens ?? 0;
	const outputTokens = usage.outputTokens ?? 0;
	const cachedInputTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
	const cacheWriteTokens = usage.inputTokenDetails?.cacheWriteTokens ?? 0;

	const costBreakdown = calculateCost(input.model, {
		inputTokens,
		outputTokens,
		cachedInputTokens,
		cacheWriteTokens,
	});

	log.info(
		`Generated ${input.category}: "${content.title}" (${formatCost(costBreakdown.totalCost)})`,
	);

	return {
		content,
		input,
		model: input.model,
		promptTokens: inputTokens,
		completionTokens: outputTokens,
		costUSD: costBreakdown.totalCost,
	};
}
