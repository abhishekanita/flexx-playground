import { InstagramReelModel } from '@/schema';
import { InstagramAccountConfig } from '@/types';
import { InstagramPlugin, extractHashtags, sleep } from '@/plugins/instagram/instagram.plugin';
import { createExportSession, saveJSON } from '@/utils/data-export';
import logger, { ServiceLogger } from '@/utils/logger';
import instagramConfig from '@/config/instagram-accounts.json';
import path from 'path';
import fs from 'fs';

interface ScrapingStats {
    accountName: string;
    reelsFound: number;
    newReelsSaved: number;
    errors: number;
}

const VIDEOS_DIR = path.join(process.cwd(), 'data', 'instagram', 'videos');

export class InstagramScraperService {
    private logger: ServiceLogger;
    private exportDir: string = '';
    private plugin: InstagramPlugin;
    private limitPerSearch: number = 200;

    constructor() {
        this.logger = logger.createServiceLogger('InstagramScraper');
        this.plugin = new InstagramPlugin();
    }

    private async saveReel(item: any, source: string): Promise<boolean> {
        const reelId = item.id || item.pk || item.shortCode;
        if (!reelId) {
            this.logger.warn(`  Skipping item with no ID`);
            return false;
        }

        const existing = await InstagramReelModel.findOne({ reelId: String(reelId) });
        if (existing) {
            this.logger.info(`    Skipping existing: ${reelId}`);
            return false;
        }

        const shortcode = item.shortCode || item.shortcode || '';
        const caption = item.caption || '';
        const hashtags = extractHashtags(caption);

        // Fetch comments
        let comments: any[] = [];
        // if (shortcode) {
        //     try {
        //         this.logger.info(`    Fetching comments for ${shortcode}...`);
        //         const rawComments = await this.plugin.fetchReelComments(shortcode, 50);
        //         comments = rawComments.map((c: any) => ({
        //             commentId: c.id || c.pk || String(Date.now()),
        //             username: c.ownerUsername || c.username || 'unknown',
        //             text: c.text || '',
        //             likeCount: c.likesCount || c.likeCount || 0,
        //             timestamp: new Date(c.timestamp || c.createdAt || Date.now()),
        //         }));
        //     } catch (err: any) {
        //         this.logger.warn(`    Could not fetch comments: ${err.message}`);
        //     }
        // }

        // Download video
        let videoLocalPath: string | undefined;
        let videoS3Url: string | undefined;
        const videoUrl = item.videoUrl || item.video_url || '';

        if (videoUrl) {
            try {
                const localPath = path.join(VIDEOS_DIR, `${reelId}.mp4`);
                this.logger.info(`    Downloading video...`);
                videoLocalPath = await this.plugin.downloadReelVideo(videoUrl, localPath);

                this.logger.info(`    Uploading to S3...`);
                videoS3Url = await this.plugin.uploadVideoToS3(localPath, String(reelId));
            } catch (err: any) {
                this.logger.warn(`    Video download/upload failed: ${err.message}`);
            }
        }

        const doc = {
            reelId: String(reelId),
            shortcode,
            username: item.ownerUsername || item.username || source,
            caption,
            likeCount: item.likesCount || item.likeCount || 0,
            commentCount: item.commentsCount || item.commentCount || 0,
            viewCount: item.videoViewCount || item.viewCount || 0,
            playCount: item.videoPlayCount || item.playCount || 0,
            publishedAt: new Date(item.timestamp || item.takenAt || Date.now()),
            videoUrl,
            thumbnailUrl: item.displayUrl || item.thumbnailUrl || undefined,
            hashtags,
            comments,
            videoLocalPath,
            videoS3Url,
            scrapedAt: new Date(),
            processed: false,
        };

        await InstagramReelModel.create(doc);

        if (this.exportDir) {
            saveJSON(this.exportDir, `${doc.username}-${reelId}`, {
                raw: item,
                transformed: doc,
            });
        }

        this.logger.green(`    Saved: "${caption.substring(0, 60)}..." with ${comments.length} comments`);
        return true;
    }

    async scrapeAccount(accountConfig: InstagramAccountConfig): Promise<ScrapingStats> {
        const stats: ScrapingStats = {
            accountName: accountConfig.username,
            reelsFound: 0,
            newReelsSaved: 0,
            errors: 0,
        };

        try {
            this.logger.info(`Starting scrape for @${accountConfig.username} (${accountConfig.category})`);

            const items = await this.plugin.scrapeAccountReels(accountConfig.username, 30);
            stats.reelsFound = items.length;
            this.logger.info(`  Found ${items.length} reels`);

            for (const item of items) {
                try {
                    const saved = await this.saveReel(item, accountConfig.username);
                    if (saved) stats.newReelsSaved++;
                } catch (err: any) {
                    stats.errors++;
                    this.logger.error(`    Error processing reel: ${err.message}`);
                }
            }
        } catch (err: any) {
            stats.errors++;
            this.logger.error(`Error scraping @${accountConfig.username}: ${err.message}`);
        }

        this.logger.info(
            `Completed @${accountConfig.username}: ${stats.reelsFound} found, ${stats.newReelsSaved} new, ${stats.errors} errors`
        );

        return stats;
    }

    async scrapeByKeyword(keyword: string): Promise<ScrapingStats> {
        const stats: ScrapingStats = {
            accountName: `keyword:${keyword}`,
            reelsFound: 0,
            newReelsSaved: 0,
            errors: 0,
        };

        try {
            this.logger.info(`Searching reels for keyword: "${keyword}"`);

            const items = await this.plugin.searchReelsByKeyword(keyword, this.limitPerSearch);
            console.log('items', items[0]);
            stats.reelsFound = items.length;
            this.logger.info(`  Found ${items.length} reels for "${keyword}"`);

            for (const item of items) {
                try {
                    const saved = await this.saveReel(item, keyword);
                    if (saved) stats.newReelsSaved++;
                } catch (err: any) {
                    stats.errors++;
                    this.logger.error(`    Error processing reel: ${err.message}`);
                }
            }
        } catch (err: any) {
            stats.errors++;
            this.logger.error(`Error searching keyword "${keyword}": ${err.message}`);
        }

        this.logger.info(`Completed "${keyword}": ${stats.reelsFound} found, ${stats.newReelsSaved} new, ${stats.errors} errors`);

        return stats;
    }

    async scrapeAll(): Promise<ScrapingStats[]> {
        const accounts = instagramConfig.accounts as InstagramAccountConfig[];
        const keywords = instagramConfig.keywords as string[];
        const allStats: ScrapingStats[] = [];

        this.exportDir = createExportSession('instagram');
        fs.mkdirSync(VIDEOS_DIR, { recursive: true });

        this.logger.info(`Starting Instagram scraping: ${accounts.length} accounts, ${keywords.length} keywords`);
        this.logger.info(`Raw data export: ${this.exportDir}`);

        // // Scrape accounts
        // for (const account of accounts) {
        //     if (account.username === 'REPLACE_WITH_USERNAME') {
        //         this.logger.warn(`  Skipping ${account.username} - not configured`);
        //         continue;
        //     }

        //     const stats = await this.scrapeAccount(account);
        //     allStats.push(stats);
        //     await sleep(3000);
        // }

        // Scrape by keywords
        for (const keyword of keywords) {
            const stats = await this.scrapeByKeyword(keyword);
            allStats.push(stats);
            await sleep(3000);
        }

        const totalFound = allStats.reduce((sum, s) => sum + s.reelsFound, 0);
        const totalSaved = allStats.reduce((sum, s) => sum + s.newReelsSaved, 0);
        const totalErrors = allStats.reduce((sum, s) => sum + s.errors, 0);

        this.logger.info(`\nInstagram scraping complete:`);
        this.logger.info(`  Sources processed: ${allStats.length}`);
        this.logger.info(`  Total reels found: ${totalFound}`);
        this.logger.info(`  New reels saved: ${totalSaved}`);
        this.logger.info(`  Errors: ${totalErrors}`);

        return allStats;
    }
}
