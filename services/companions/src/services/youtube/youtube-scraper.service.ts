import { YouTubeVideoModel } from '@/schema';
import { YouTubeChannelConfig } from '@/types';
import { youtubePlugin } from '@/plugins/youtube/youtube.plugin';
import { createExportSession, saveJSON } from '@/utils/data-export';
import logger, { ServiceLogger } from '@/utils/logger';
import channels from '@/config/youtube-channels.json';

interface ScrapingStats {
    channelName: string;
    videosFound: number;
    newVideosSaved: number;
    errors: number;
}

export class YouTubeScraperService {
    private logger: ServiceLogger;
    private exportDir: string = '';

    constructor() {
        this.logger = logger.createServiceLogger('YouTubeScraper');
    }

    async scrapeChannel(channelConfig: YouTubeChannelConfig): Promise<ScrapingStats> {
        const stats: ScrapingStats = {
            channelName: channelConfig.name,
            videosFound: 0,
            newVideosSaved: 0,
            errors: 0,
        };

        try {
            this.logger.info(`Starting scrape for channel: ${channelConfig.name}`);

            const channelInfo = await youtubePlugin.getChannelInfo(channelConfig.id);
            this.logger.info(`  Uploads playlist: ${channelInfo.uploadsPlaylistId}`);

            const allVideoIds = await youtubePlugin.fetchAllVideoIds(channelInfo.uploadsPlaylistId);
            stats.videosFound = allVideoIds.length;
            this.logger.info(`  Found ${allVideoIds.length} videos`);

            const existingVideos = await YouTubeVideoModel.find(
                { videoId: { $in: allVideoIds } },
                { videoId: 1 }
            );
            const existingIds = new Set(existingVideos.map((v) => v.videoId));
            const newVideoIds = allVideoIds.filter((id) => !existingIds.has(id));
            this.logger.info(`  New videos to scrape: ${newVideoIds.length}`);

            if (newVideoIds.length === 0) {
                this.logger.info(`  No new videos, skipping channel`);
                return stats;
            }

            const videoDetails = await youtubePlugin.fetchVideoDetails(newVideoIds);
            this.logger.info(`  Fetched details for ${videoDetails.length} videos`);

            for (const video of videoDetails) {
                try {
                    const videoId = video.id!;

                    const thumbnailUrl =
                        video.snippet?.thumbnails?.high?.url ||
                        video.snippet?.thumbnails?.medium?.url ||
                        video.snippet?.thumbnails?.default?.url;

                    const doc = {
                        videoId,
                        channelId: video.snippet?.channelId || channelConfig.id,
                        channelName: video.snippet?.channelTitle || channelConfig.name,
                        title: video.snippet?.title || '',
                        description: video.snippet?.description || '',
                        publishedAt: new Date(video.snippet?.publishedAt || Date.now()),
                        viewCount: parseInt(video.statistics?.viewCount || '0', 10),
                        likeCount: parseInt(video.statistics?.likeCount || '0', 10),
                        commentCount: parseInt(video.statistics?.commentCount || '0', 10),
                        duration: video.contentDetails?.duration || '',
                        tags: video.snippet?.tags || [],
                        thumbnailUrl,
                        scrapedAt: new Date(),
                        processed: false,
                    };

                    await YouTubeVideoModel.create(doc);

                    if (this.exportDir) {
                        saveJSON(this.exportDir, `${channelConfig.handle}-${videoId}`, {
                            raw: video,
                            transformed: doc,
                        });
                    }

                    stats.newVideosSaved++;
                    this.logger.green(
                        `    Saved: "${(video.snippet?.title || '').substring(0, 50)}..."`
                    );
                } catch (err: any) {
                    stats.errors++;
                    this.logger.error(`    Error processing video ${video.id}: ${err.message}`);
                }
            }
        } catch (err: any) {
            stats.errors++;
            this.logger.error(`Error scraping channel ${channelConfig.name}: ${err.message}`);
        }

        this.logger.info(
            `Completed ${channelConfig.name}: ${stats.videosFound} found, ${stats.newVideosSaved} new, ${stats.errors} errors`
        );

        return stats;
    }

    async scrapeAll(): Promise<ScrapingStats[]> {
        const channelList = channels as YouTubeChannelConfig[];
        const allStats: ScrapingStats[] = [];

        this.exportDir = createExportSession('youtube');
        this.logger.info(`Starting YouTube scraping for ${channelList.length} channels`);
        this.logger.info(`Raw data export: ${this.exportDir}`);

        for (const channelConfig of channelList) {
            if (channelConfig.id === 'REPLACE_WITH_CHANNEL_ID') {
                this.logger.warn(`  Skipping ${channelConfig.name} - channel ID not configured`);
                continue;
            }

            const stats = await this.scrapeChannel(channelConfig);
            allStats.push(stats);
        }

        const totalFound = allStats.reduce((sum, s) => sum + s.videosFound, 0);
        const totalSaved = allStats.reduce((sum, s) => sum + s.newVideosSaved, 0);
        const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);

        this.logger.info(`\nYouTube scraping complete:`);
        this.logger.info(`  Channels processed: ${allStats.length}`);
        this.logger.info(`  Total videos found: ${totalFound}`);
        this.logger.info(`  New videos saved: ${totalSaved}`);
        this.logger.info(`  Errors: ${totalErrors}`);

        return allStats;
    }
}
