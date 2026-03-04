import logger from '@/utils/logger';
import { UserProfile, ContentPiece } from '@/schema';
import type { IUserProfile } from '@/schema';
import type { IContentPiece } from '@/schema';
import type { BriefingResult, ScoredContentPiece } from './types';

const log = logger.createServiceLogger('BriefingAssembler');

// ─── Category ordering for briefing flow ────────────────────────

const CATEGORY_ORDER: Record<string, number> = {
	'crash-alert': 0,
	'market-pulse': 1,
	'portfolio-update': 2,
	'stock-deep-dive': 3,
	'mf-watch': 4,
	'rbi-update': 5,
	'gold-commodity': 6,
	'news-digest': 7,
	'comparison': 8,
	'tax-tip': 9,
	'action-item': 10,
	'learn': 11,
};

// ─── Assemble Briefing for a User ───────────────────────────────

export async function assembleBriefing(
	userId: string,
	maxPieces: number = 7,
): Promise<BriefingResult> {
	log.info(`Assembling briefing for user ${userId}`);

	// 1. Load user profile
	const user = await UserProfile.findOne({ userId }).lean();
	if (!user) {
		throw new Error(`User profile not found: ${userId}`);
	}

	// 2. Query today's published content pieces
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);

	const pieces = await ContentPiece.find({
		date: { $gte: todayStart },
		status: 'published',
	}).lean();

	log.info(`Found ${pieces.length} published content pieces for today`);

	if (pieces.length === 0) {
		return {
			userId,
			date: todayStart,
			pieces: [],
			totalDurationSeconds: 0,
			generatedAt: new Date(),
		};
	}

	// 3. Score each piece for this user
	const scored = pieces
		.map((piece) => scorePiece(piece as IContentPiece, user as IUserProfile))
		.filter((s) => s.score > 0);

	// 4. Sort by score descending, pick top N
	scored.sort((a, b) => b.score - a.score);
	const topPieces = scored.slice(0, maxPieces);

	// 5. Reorder by briefing flow (category order)
	topPieces.sort((a, b) => {
		const orderA = CATEGORY_ORDER[a.category] ?? 99;
		const orderB = CATEGORY_ORDER[b.category] ?? 99;
		return orderA - orderB;
	});

	const totalDuration = topPieces.reduce((sum, p) => sum + p.durationSeconds, 0);

	log.info(
		`Assembled briefing: ${topPieces.length} pieces, ${totalDuration}s total duration`,
	);

	return {
		userId,
		date: todayStart,
		pieces: topPieces,
		totalDurationSeconds: totalDuration,
		generatedAt: new Date(),
	};
}

// ─── Scoring Logic ──────────────────────────────────────────────

function scorePiece(piece: IContentPiece, user: IUserProfile): ScoredContentPiece {
	let score = 0;

	const tags = piece.tags;

	// Universal content: +15
	if (tags.isUniversal) {
		score += 15;
	}

	// Holdings match: +10 per matching symbol
	const userSymbols = new Set(user.holdings.map((h) => h.symbol.toUpperCase()));
	for (const sym of tags.symbols) {
		if (userSymbols.has(sym.toUpperCase()) || userSymbols.has(sym.replace('.NS', '').toUpperCase())) {
			score += 10;
			break; // Only count once
		}
	}

	// MF holdings match: +8 per matching scheme
	const userSchemeCodes = new Set(user.mfHoldings.map((m) => m.schemeCode));
	for (const code of tags.schemeCodes) {
		if (userSchemeCodes.has(code)) {
			score += 8;
			break;
		}
	}

	// Interest match: +5 per matching interest
	const userInterests = new Set(user.interests.map((i) => i.toLowerCase()));
	for (const interest of tags.interests) {
		if (userInterests.has(interest.toLowerCase())) {
			score += 5;
			break;
		}
	}

	// Demographic match: +3
	if (tags.riskLevels.includes(user.riskProfile)) score += 3;
	if (tags.incomeBrackets.includes(user.incomeBracket)) score += 3;
	if (tags.ageGroups.includes(user.ageGroup)) score += 3;

	// Priority multiplier (priority 1 = full score, priority 5 = 0.2x)
	const priorityMultiplier = 1 / piece.priority;
	score *= priorityMultiplier;

	return {
		contentPieceId: piece._id,
		category: piece.category,
		title: piece.title,
		body: piece.body,
		tldr: piece.tldr,
		durationSeconds: piece.durationSeconds,
		sources: piece.sources,
		score,
		priority: piece.priority,
	};
}

// ─── Batch Assembly (for all users) ─────────────────────────────

export async function assembleAllBriefings(): Promise<Map<string, BriefingResult>> {
	const users = await UserProfile.find({}).lean();
	const results = new Map<string, BriefingResult>();

	log.info(`Assembling briefings for ${users.length} users`);

	for (const user of users) {
		try {
			const briefing = await assembleBriefing(user.userId);
			results.set(user.userId, briefing);
		} catch (err: any) {
			log.error(`Failed to assemble briefing for ${user.userId}: ${err.message}`);
		}
	}

	return results;
}
