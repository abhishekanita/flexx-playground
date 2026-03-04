import { ApifyClient } from 'apify-client';
import { config } from '@/config';
import logger from '@/utils/logger';
import type { InstagramAccountConfig, CreatorReel } from './types';

const log = logger.createServiceLogger('InstagramPlugin');

const MAX_RETRIES = 3;
const REQUEST_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractHashtags(caption: string): string[] {
	const matches = caption.match(/#[\w\u0900-\u097F]+/g);
	return matches ? matches.map((tag) => tag.toLowerCase()) : [];
}

export class InstagramPlugin {
	private client: ApifyClient | null = null;

	private createClient(): ApifyClient | null {
		if (this.client) return this.client;

		const apiToken = config.apify.apiToken;
		if (!apiToken) {
			log.warn('APIFY_API_TOKEN not configured — Instagram plugin disabled');
			return null;
		}

		this.client = new ApifyClient({ token: apiToken });
		return this.client;
	}

	/**
	 * Fetch recent reels from configured finance creator accounts + keyword searches.
	 * Returns metadata only — no video downloads.
	 */
	async getRecentCreatorReels(
		accounts: InstagramAccountConfig[],
		keywords: string[],
		reelsPerAccount: number = 5,
		reelsPerKeyword: number = 10,
	): Promise<CreatorReel[]> {
		const client = this.createClient();
		if (!client) return [];

		log.info(`Fetching creator reels from ${accounts.length} accounts + ${keywords.length} keywords`);

		const tasks: Promise<CreatorReel[]>[] = [];

		// Account scrapes
		for (const account of accounts) {
			tasks.push(
				this.scrapeAccountReels(client, account, reelsPerAccount),
			);
		}

		// Keyword searches
		for (const keyword of keywords) {
			tasks.push(
				this.searchReelsByKeyword(client, keyword, reelsPerKeyword),
			);
		}

		const results = await Promise.allSettled(tasks);

		const allReels: CreatorReel[] = [];
		const seenIds = new Set<string>();

		for (const result of results) {
			if (result.status === 'fulfilled') {
				for (const reel of result.value) {
					if (!seenIds.has(reel.reelId)) {
						seenIds.add(reel.reelId);
						allReels.push(reel);
					}
				}
			} else {
				log.warn(`Instagram scrape task failed: ${result.reason?.message || 'Unknown error'}`);
			}
		}

		log.info(`Fetched ${allReels.length} unique creator reels`);
		return allReels;
	}

	private async scrapeAccountReels(
		client: ApifyClient,
		account: InstagramAccountConfig,
		limit: number,
	): Promise<CreatorReel[]> {
		try {
			const items = await this.runActorWithRetry(client, 'xMc5Ga1oCONPmWJIa', {
				usernames: [account.username],
				resultsLimit: limit,
			});

			return items.map((item) => this.parseReelItem(item, account.displayName, 'account'));
		} catch (err: any) {
			log.warn(`Failed to scrape account @${account.username}: ${err.message}`);
			return [];
		}
	}

	private async searchReelsByKeyword(
		client: ApifyClient,
		keyword: string,
		limit: number,
	): Promise<CreatorReel[]> {
		try {
			const items = await this.runActorWithRetry(client, 'reGe1ST3OBgYZSsZJ', {
				hashtags: [keyword],
				resultsLimit: limit,
				resultsType: 'reels',
			});

			return items.map((item) => this.parseReelItem(item, '', 'keyword-search'));
		} catch (err: any) {
			log.warn(`Failed to search keyword "${keyword}": ${err.message}`);
			return [];
		}
	}

	/**
	 * Defensive field-name parsing for Apify response variance.
	 * Different actors return fields with different casing/naming.
	 */
	private parseReelItem(
		item: any,
		fallbackDisplayName: string,
		source: 'account' | 'keyword-search',
	): CreatorReel {
		const caption = (item.caption || item.text || item.description || '').slice(0, 300);
		const username = item.ownerUsername || item.username || item.owner?.username || '';

		return {
			reelId: item.id || item.reelId || item.shortCode || item.shortcode || '',
			caption,
			hashtags: extractHashtags(caption),
			username,
			displayName: fallbackDisplayName || item.ownerFullName || item.owner?.fullName || username,
			likeCount: Number(item.likesCount ?? item.likeCount ?? item.likes ?? 0),
			viewCount: Number(item.videoViewCount ?? item.viewCount ?? item.videoPlayCount ?? item.playCount ?? 0),
			commentCount: Number(item.commentsCount ?? item.commentCount ?? item.comments ?? 0),
			publishedAt: new Date(item.timestamp || item.takenAt || item.publishedAt || Date.now()),
			thumbnailUrl: item.displayUrl || item.thumbnailUrl || item.imageUrl || '',
			source,
		};
	}

	private async runActorWithRetry(client: ApifyClient, actorId: string, input: any): Promise<any[]> {
		for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
			try {
				const run = await client.actor(actorId).call(input);
				const { items } = await client.dataset(run.defaultDatasetId).listItems();
				await sleep(REQUEST_DELAY_MS);
				return items;
			} catch (err: any) {
				if (attempt < MAX_RETRIES) {
					const backoff = attempt * 15000;
					log.warn(`Apify error (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${backoff / 1000}s...`);
					await sleep(backoff);
					continue;
				}
				throw err;
			}
		}
		throw new Error('Max retries exceeded');
	}
}

export const instagramPlugin = new InstagramPlugin();
