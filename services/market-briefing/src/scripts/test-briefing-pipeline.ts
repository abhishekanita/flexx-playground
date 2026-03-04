/**
 * Test script for the Daily Briefing Content Pipeline.
 *
 * Creates mock user profiles, runs the full pipeline, then assembles
 * personalized briefings to verify content is different per user.
 *
 * Run: NODE_ENV=dev npx ts-node --files -r tsconfig-paths/register src/scripts/test-briefing-pipeline.ts
 */
import mongoose from 'mongoose';
import { config } from '@/config/config';
import { UserProfile, ContentPiece, PipelineRun, NewsArticle } from '@/schema';
import { PipelineOrchestrator } from '@/services/briefing/pipeline-orchestrator';
import { assembleBriefing } from '@/services/briefing/briefing-assembler';
import { formatCost } from '@/utils/ai-cost';
import type { MarketSignals } from '@/services/briefing/types';

// ─── Helpers ────────────────────────────────────────────────────

const divider = (title: string) => {
	console.log('\n' + '═'.repeat(70));
	console.log(`  ${title}`);
	console.log('═'.repeat(70));
};

const section = (title: string) => console.log(`\n--- ${title} ---`);

// ─── Mock User Data ─────────────────────────────────────────────

const MOCK_USERS = [
	{
		userId: 'test-user-aggressive-tech',
		holdings: [
			{ symbol: 'TCS', exchange: 'NSE' },
			{ symbol: 'INFY', exchange: 'NSE' },
			{ symbol: 'HCLTECH', exchange: 'NSE' },
		],
		mfHoldings: [
			{ schemeCode: 122639, schemeName: 'Parag Parikh Flexi Cap Direct Growth' },
		],
		interests: ['technology', 'AI', 'startups'],
		riskProfile: 'aggressive' as const,
		incomeBracket: '20L+' as const,
		ageGroup: '26-35' as const,
		location: { city: 'Bangalore', state: 'Karnataka' },
		sipDates: [1, 15],
		preferredLanguage: 'hinglish' as const,
		notificationPrefs: { pushEnabled: true, briefingTime: '07:30' },
	},
	{
		userId: 'test-user-moderate-diversified',
		holdings: [
			{ symbol: 'RELIANCE', exchange: 'NSE' },
			{ symbol: 'HDFCBANK', exchange: 'NSE' },
			{ symbol: 'ITC', exchange: 'NSE' },
		],
		mfHoldings: [
			{ schemeCode: 118989, schemeName: 'HDFC Mid-Cap Opportunities Direct Growth' },
			{ schemeCode: 125497, schemeName: 'SBI Small Cap Direct Growth' },
		],
		interests: ['gold', 'real estate', 'tax planning'],
		riskProfile: 'moderate' as const,
		incomeBracket: '10-20L' as const,
		ageGroup: '36-50' as const,
		location: { city: 'Mumbai', state: 'Maharashtra' },
		sipDates: [5],
		preferredLanguage: 'hinglish' as const,
		notificationPrefs: { pushEnabled: true, briefingTime: '08:00' },
	},
	{
		userId: 'test-user-conservative-beginner',
		holdings: [
			{ symbol: 'SBIN', exchange: 'NSE' },
		],
		mfHoldings: [
			{ schemeCode: 122639, schemeName: 'Parag Parikh Flexi Cap Direct Growth' },
		],
		interests: ['savings', 'FD rates', 'rbi'],
		riskProfile: 'conservative' as const,
		incomeBracket: '5-10L' as const,
		ageGroup: '18-25' as const,
		location: { city: 'Delhi', state: 'Delhi' },
		sipDates: [1],
		preferredLanguage: 'hi' as const,
		notificationPrefs: { pushEnabled: true, briefingTime: '09:00' },
	},
];

// ─── Main ───────────────────────────────────────────────────────

async function main() {
	console.log('╔══════════════════════════════════════════════════════════════════════╗');
	console.log('║         DAILY BRIEFING PIPELINE — INTEGRATION TEST                   ║');
	console.log('╚══════════════════════════════════════════════════════════════════════╝');

	// Connect to MongoDB
	section('Connecting to MongoDB');
	await mongoose.connect(config.db.uri, { dbName: config.db.name });
	console.log(`  Connected to ${config.db.name}`);

	try {
		// ─── Step 1: Seed Mock Users ────────────────────────────
		divider('STEP 1: Seeding Mock User Profiles');

		for (const mockUser of MOCK_USERS) {
			await UserProfile.findOneAndUpdate(
				{ userId: mockUser.userId },
				{ $set: mockUser },
				{ upsert: true, new: true },
			);
			console.log(`  [OK] ${mockUser.userId} (${mockUser.holdings.length} stocks, ${mockUser.mfHoldings.length} MFs, interests: [${mockUser.interests.join(', ')}])`);
		}

		// ─── Step 2: Run Pipeline ───────────────────────────────
		divider('STEP 2: Running Daily Pipeline');

		const orchestrator = new PipelineOrchestrator();
		const startTime = Date.now();
		const pipelineRun = await orchestrator.runDailyPipeline('manual');
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

		console.log(`\n  Pipeline Status: ${pipelineRun.status}`);
		console.log(`  Total Time: ${elapsed}s`);
		console.log(`  Content Pieces: ${pipelineRun.stats.contentPiecesGenerated}`);
		console.log(`  LLM Cost: ${formatCost(pipelineRun.stats.totalLLMCost)}`);
		console.log(`  Data Fetch: ${(pipelineRun.stats.dataFetchTimeMs / 1000).toFixed(1)}s`);
		console.log(`  Content Gen: ${(pipelineRun.stats.contentGenTimeMs / 1000).toFixed(1)}s`);

		section('Pipeline Stages');
		for (const stage of pipelineRun.stages) {
			const duration = stage.completedAt && stage.startedAt
				? `${((stage.completedAt.getTime() - stage.startedAt.getTime()) / 1000).toFixed(1)}s`
				: '-';
			console.log(`  [${stage.status.padEnd(9)}] ${stage.name.padEnd(20)} ${duration}`);
			if (stage.metadata && Object.keys(stage.metadata).length > 0) {
				console.log(`             ${JSON.stringify(stage.metadata)}`);
			}
		}

		// ─── Step 2b: Persisted Articles Stats ─────────────────
		divider('STEP 2b: Persisted News Articles');

		const savedArticles = await NewsArticle.find({ pipelineRunId: pipelineRun._id }).lean();
		const totalArticles = await NewsArticle.countDocuments();
		const rssSaved = savedArticles.filter((a) => a.source === 'rss').length;
		const serpSaved = savedArticles.filter((a) => a.source === 'serp-news').length;

		console.log(`\n  Articles saved this run: ${savedArticles.length}`);
		console.log(`    RSS: ${rssSaved}`);
		console.log(`    SerpAPI: ${serpSaved}`);
		console.log(`  Total articles in DB: ${totalArticles}`);

		// Show category breakdown for RSS articles
		const categoryBreakdown = new Map<string, number>();
		for (const a of savedArticles) {
			if (a.feedCategory) {
				categoryBreakdown.set(a.feedCategory, (categoryBreakdown.get(a.feedCategory) || 0) + 1);
			}
		}
		if (categoryBreakdown.size > 0) {
			console.log('  RSS by category:');
			for (const [cat, count] of [...categoryBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
				console.log(`    ${cat}: ${count}`);
			}
		}

		// Show dedup stats from pipeline stage metadata
		const fetchStage = pipelineRun.stages.find((s) => s.name === 'fetch-data');
		if (fetchStage?.metadata) {
			console.log(`\n  Dedup stats:`);
			console.log(`    Unique stored: ${fetchStage.metadata.articlesStored || 0}`);
			console.log(`    Deduplicated: ${fetchStage.metadata.articlesDeduplicated || 0}`);
			console.log(`\n  External data:`);
			console.log(`    Macro quotes: ${fetchStage.metadata.macroQuotes ?? 'N/A'}`);
			console.log(`    FII/DII available: ${fetchStage.metadata.fiiDiiAvailable ?? 'N/A'}`);
		}

		// Show sample articles
		section('Sample Articles (first 5)');
		for (const a of savedArticles.slice(0, 5)) {
			console.log(`  [${a.source}] ${a.title}`);
			console.log(`    URL: ${a.url}`);
			console.log(`    Source: ${a.sourceName}${a.feedCategory ? ` (${a.feedCategory})` : ''}`);
		}

		// ─── Step 3: Inspect Generated Content ──────────────────
		divider('STEP 3: Narrative Content Pieces');

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);

		const allPieces = await ContentPiece.find({
			date: { $gte: todayStart },
			pipelineRunId: pipelineRun._id,
		}).lean();

		// Story type labels for display
		const storyLabels: Record<string, string> = {
			'market-pulse': 'BIG STORY',
			'portfolio-update': 'YOUR PORTFOLIO',
			'stock-deep-dive': 'OPPORTUNITY/RISK',
			'news-digest': 'NARRATIVE',
			'action-item': 'YOUR MOVE',
		};

		// Sort by priority for display
		const sorted = [...allPieces].sort((a, b) => a.priority - b.priority);

		console.log(`\n  Total pieces: ${sorted.length} (target: 6-8 narrative stories)`);
		console.log('  ' + '─'.repeat(66));

		for (const piece of sorted) {
			const tagSummary: string[] = [];
			if (piece.tags.isUniversal) tagSummary.push('UNIVERSAL');
			if (piece.tags.symbols.length) tagSummary.push(`symbols:[${piece.tags.symbols.join(',')}]`);
			if (piece.tags.schemeCodes.length) tagSummary.push(`mf:[${piece.tags.schemeCodes.join(',')}]`);
			if (piece.tags.interests.length) tagSummary.push(`interests:[${piece.tags.interests.join(',')}]`);

			const label = storyLabels[piece.category] || piece.category.toUpperCase();
			const sub = piece.subcategory ? ` (${piece.subcategory})` : '';

			console.log(`\n  [${piece.category.padEnd(16)}] P${piece.priority} | ${label}${sub}`);
			console.log(`    Title: ${piece.title}`);
			console.log(`    TLDR:  ${piece.tldr}`);
			console.log(`    Tags:  ${tagSummary.join(' | ') || 'none'}`);
			console.log(`    Model: ${piece.modelId} | Cost: ${formatCost(piece.costUSD)} | ${piece.durationSeconds}s read`);
			if (piece.sources.length > 0) {
				const withRef = piece.sources.filter((s: any) => s.articleId).length;
				console.log(`    Sources: ${piece.sources.length} (${withRef} with articleId ref)`);
			}

			// Show body preview (first 200 chars)
			const bodyPreview = piece.body.replace(/\n/g, ' ').slice(0, 200);
			console.log(`    Preview: ${bodyPreview}${piece.body.length > 200 ? '...' : ''}`);
		}

		// ─── Step 4: Assemble Per-User Briefings ────────────────
		divider('STEP 4: Per-User Briefing Assembly');

		for (const mockUser of MOCK_USERS) {
			section(`Briefing for: ${mockUser.userId}`);
			console.log(`  Profile: ${mockUser.riskProfile} | ${mockUser.incomeBracket} | ${mockUser.ageGroup}`);
			console.log(`  Holdings: ${mockUser.holdings.map((h) => h.symbol).join(', ')}`);
			console.log(`  MFs: ${mockUser.mfHoldings.map((m) => m.schemeCode).join(', ')}`);
			console.log(`  Interests: ${mockUser.interests.join(', ')}`);

			const briefing = await assembleBriefing(mockUser.userId);

			console.log(`\n  Total pieces: ${briefing.pieces.length} | Duration: ${briefing.totalDurationSeconds}s`);
			console.log('  ─'.repeat(35));

			for (let i = 0; i < briefing.pieces.length; i++) {
				const p = briefing.pieces[i];
				console.log(`  ${i + 1}. [${p.category}] ${p.title}`);
				console.log(`     Score: ${p.score.toFixed(1)} | Priority: ${p.priority} | ${p.durationSeconds}s`);
				console.log(`     TLDR: ${p.tldr}`);
			}
		}

		// ─── Step 5: Verify Personalization ─────────────────────
		divider('STEP 5: Personalization Verification');

		const briefings = new Map<string, string[]>();
		for (const mockUser of MOCK_USERS) {
			const briefing = await assembleBriefing(mockUser.userId);
			briefings.set(
				mockUser.userId,
				briefing.pieces.map((p) => `${p.category}:${p.title}`),
			);
		}

		// Check that briefings differ
		const userIds = [...briefings.keys()];
		for (let i = 0; i < userIds.length; i++) {
			for (let j = i + 1; j < userIds.length; j++) {
				const a = briefings.get(userIds[i])!;
				const b = briefings.get(userIds[j])!;
				const shared = a.filter((x) => b.includes(x));
				const unique = a.length + b.length - shared.length * 2;

				console.log(`\n  ${userIds[i].replace('test-user-', '')} vs ${userIds[j].replace('test-user-', '')}:`);
				console.log(`    Shared pieces: ${shared.length}`);
				console.log(`    Unique pieces: ${unique}`);
				console.log(`    Personalization: ${unique > 0 ? 'YES — briefings differ' : 'NO — identical briefings'}`);
			}
		}

		divider('ALL TESTS COMPLETE');
	} finally {
		// Cleanup: remove test users (optional — comment out to keep data)
		// for (const mockUser of MOCK_USERS) {
		//   await UserProfile.deleteOne({ userId: mockUser.userId });
		// }

		await mongoose.disconnect();
		console.log('\n  Disconnected from MongoDB');
	}
}

main().catch((err) => {
	console.error('Pipeline test failed:', err);
	mongoose.disconnect();
	process.exit(1);
});
