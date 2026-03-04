import { google, youtube_v3 } from 'googleapis';
import { config } from '@/config';
import logger from '@/utils/logger';
import type { YouTubeChannelConfig, CreatorVideo } from './types';

const log = logger.createServiceLogger('YouTubePlugin');

export class YouTubePlugin {
	private client: youtube_v3.Youtube | null = null;

	private createClient(): youtube_v3.Youtube | null {
		if (this.client) return this.client;

		const apiKey = config.youtube.apiKey;
		if (!apiKey) {
			log.warn('YOUTUBE_API_KEY not configured — YouTube plugin disabled');
			return null;
		}

		this.client = google.youtube({ version: 'v3', auth: apiKey });
		return this.client;
	}

	/**
	 * Fetch recent videos from configured finance creator channels.
	 * Returns metadata only — no video downloads or transcripts.
	 *
	 * ~8 API quota units per run (10,000/day limit = safe)
	 */
	async getRecentCreatorVideos(
		channels: YouTubeChannelConfig[],
		hoursBack: number = 48,
	): Promise<CreatorVideo[]> {
		const youtube = this.createClient();
		if (!youtube) return [];

		const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
		log.info(`Fetching creator videos from ${channels.length} channels (last ${hoursBack}h)`);

		try {
			// Step 1: Get uploads playlist IDs for all channels (1 batch call)
			const channelResponse = await youtube.channels.list({
				part: ['contentDetails'],
				id: channels.map((c) => c.id),
			});

			const channelMap = new Map<string, string>(); // channelId → uploadsPlaylistId
			for (const ch of channelResponse.data.items || []) {
				const playlistId = ch.contentDetails?.relatedPlaylists?.uploads;
				if (ch.id && playlistId) {
					channelMap.set(ch.id, playlistId);
				}
			}

			// Step 2: Fetch recent playlist items per channel (filter to last hoursBack)
			const recentVideoIds: { videoId: string; channel: YouTubeChannelConfig }[] = [];

			const playlistResults = await Promise.allSettled(
				channels.map(async (channel) => {
					const playlistId = channelMap.get(channel.id);
					if (!playlistId) return [];

					const response = await youtube.playlistItems.list({
						part: ['snippet'],
						playlistId,
						maxResults: 10,
					});

					const items = response.data.items || [];
					const recent = items.filter((item) => {
						const publishedAt = item.snippet?.publishedAt;
						return publishedAt && new Date(publishedAt) >= cutoff;
					});

					return recent.map((item) => ({
						videoId: item.snippet?.resourceId?.videoId || '',
						channel,
					}));
				}),
			);

			for (const result of playlistResults) {
				if (result.status === 'fulfilled') {
					recentVideoIds.push(...result.value.filter((v) => v.videoId));
				}
			}

			if (recentVideoIds.length === 0) {
				log.info('No recent creator videos found');
				return [];
			}

			// Step 3: Batch fetch video details (snippet + statistics)
			const videoIds = recentVideoIds.map((v) => v.videoId);
			const videoIdToChannel = new Map(recentVideoIds.map((v) => [v.videoId, v.channel]));

			const videos: CreatorVideo[] = [];

			// YouTube API allows max 50 video IDs per call
			for (let i = 0; i < videoIds.length; i += 50) {
				const batch = videoIds.slice(i, i + 50);
				const detailsResponse = await youtube.videos.list({
					part: ['snippet', 'statistics'],
					id: batch,
				});

				for (const video of detailsResponse.data.items || []) {
					const channel = videoIdToChannel.get(video.id || '');
					if (!video.id || !channel) continue;

					const snippet = video.snippet;
					const stats = video.statistics;

					videos.push({
						videoId: video.id,
						title: snippet?.title || '',
						description: (snippet?.description || '').slice(0, 200),
						tags: snippet?.tags || [],
						channelName: channel.name,
						channelHandle: channel.handle,
						viewCount: Number(stats?.viewCount || 0),
						likeCount: Number(stats?.likeCount || 0),
						commentCount: Number(stats?.commentCount || 0),
						publishedAt: new Date(snippet?.publishedAt || Date.now()),
						thumbnailUrl: snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || '',
					});
				}
			}

			log.info(`Fetched ${videos.length} recent creator videos from ${channels.length} channels`);
			return videos;
		} catch (err: any) {
			log.error(`YouTube API error: ${err.message}`);
			return [];
		}
	}
}

export const youtubePlugin = new YouTubePlugin();
