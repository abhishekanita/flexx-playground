import { ApifyClient } from 'apify-client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '@/config';
import { uploadToS3 } from '@/utils/aws';

const REQUEST_DELAY_MS = 2000;
const MAX_RETRIES = 3;

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function extractHashtags(caption: string): string[] {
    const matches = caption.match(/#[\w\u0900-\u097F]+/g);
    return matches ? matches.map(tag => tag.toLowerCase()) : [];
}

export class InstagramPlugin {
    private client: ApifyClient;

    constructor() {
        this.client = new ApifyClient({ token: config.apify.apiToken });
    }

    async searchReelsByKeyword(keyword: string, limit: number = 30): Promise<any[]> {
        // Instagram Hashtag Scraper supports both hashtags and plain keyword search,
        // and can filter results to reels only via resultsType
        const items = await this.runActorWithRetry('reGe1ST3OBgYZSsZJ', {
            hashtags: [keyword],
            resultsLimit: limit,
            resultsType: 'reels',
        });
        return items;
    }

    async scrapeAccountReels(username: string, limit: number = 30): Promise<any[]> {
        const handle = username.replace(/^@/, '');
        // Instagram Reel Scraper — fetches reels from a specific profile
        const items = await this.runActorWithRetry('xMc5Ga1oCONPmWJIa', {
            usernames: [handle],
            resultsLimit: limit,
        });
        return items;
    }

    async fetchReelComments(shortcode: string, limit: number = 50): Promise<any[]> {
        const items = await this.runActorWithRetry('apify/instagram-comment-scraper', {
            directUrls: [`https://www.instagram.com/reel/${shortcode}/`],
            resultsLimit: limit,
        });
        return items;
    }

    async downloadReelVideo(videoUrl: string, outputPath: string): Promise<string> {
        const dir = path.dirname(outputPath);
        fs.mkdirSync(dir, { recursive: true });

        const response = await axios.get(videoUrl, {
            responseType: 'stream',
            timeout: 120000,
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }

    async uploadVideoToS3(localPath: string, reelId: string): Promise<string> {
        const fileBuffer = fs.readFileSync(localPath);
        const s3Key = `instagram/reels/${reelId}.mp4`;
        const url = await uploadToS3(config.aws.privateBucketName, s3Key, fileBuffer, 'video/mp4', fileBuffer.length);
        return url;
    }

    private async runActorWithRetry(actorId: string, input: any): Promise<any[]> {
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const run = await this.client.actor(actorId).call(input);
                const { items } = await this.client.dataset(run.defaultDatasetId).listItems();
                await sleep(REQUEST_DELAY_MS);
                return items;
            } catch (err: any) {
                if (attempt < MAX_RETRIES) {
                    const backoff = attempt * 15000;
                    console.log(`  Apify error (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${backoff / 1000}s...`);
                    await sleep(backoff);
                    continue;
                }
                throw err;
            }
        }
        throw new Error('Max retries exceeded');
    }
}
