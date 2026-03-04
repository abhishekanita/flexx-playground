import { google, youtube_v3 } from 'googleapis';
import { execFile } from 'child_process';
import path from 'path';
import { config } from '@/config';
import { YouTubeChannel, TranscriptSegment } from '@/types';

const TRANSCRIPT_SCRIPT = path.join(__dirname, 'fetch-transcript.py');

export class YouTubePlugin {
    private client: youtube_v3.Youtube | null = null;

    private createClient(): youtube_v3.Youtube {
        if (this.client) return this.client;

        this.client = google.youtube({
            version: 'v3',
            auth: config.youtube.apiKey,
        });

        return this.client;
    }

    async getChannelInfo(channelId: string): Promise<YouTubeChannel> {
        const youtube = this.createClient();

        const response = await youtube.channels.list({
            part: ['snippet', 'contentDetails'],
            id: [channelId],
        });

        const channel = response.data.items?.[0];
        if (!channel) {
            throw new Error(`Channel not found: ${channelId}`);
        }

        return {
            id: channel.id!,
            name: channel.snippet?.title || '',
            handle: channel.snippet?.customUrl || '',
            uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || '',
        };
    }

    async fetchAllVideoIds(uploadsPlaylistId: string): Promise<string[]> {
        const youtube = this.createClient();
        const videoIds: string[] = [];
        let nextPageToken: string | undefined;

        do {
            const response = await youtube.playlistItems.list({
                part: ['snippet'],
                playlistId: uploadsPlaylistId,
                maxResults: 50,
                pageToken: nextPageToken,
            });

            const items = response.data.items || [];
            for (const item of items) {
                const videoId = item.snippet?.resourceId?.videoId;
                if (videoId) {
                    videoIds.push(videoId);
                }
            }

            nextPageToken = response.data.nextPageToken || undefined;
        } while (nextPageToken);

        return videoIds;
    }

    async fetchVideoDetails(videoIds: string[]) {
        const youtube = this.createClient();
        const allVideos: youtube_v3.Schema$Video[] = [];

        for (let i = 0; i < videoIds.length; i += 50) {
            const batch = videoIds.slice(i, i + 50);

            const response = await youtube.videos.list({
                part: ['snippet', 'contentDetails', 'statistics'],
                id: batch,
            });

            if (response.data.items) {
                allVideos.push(...response.data.items);
            }
        }

        return allVideos;
    }

    async fetchTranscript(
        videoId: string,
        lang?: string
    ): Promise<TranscriptSegment[] | null> {
        const languages = lang ? lang : 'hi,en';

        return new Promise((resolve) => {
            const args = [TRANSCRIPT_SCRIPT, videoId, languages];
            if (config.scraperApi?.apiKey) {
                args.push(config.scraperApi.apiKey);
            }
            execFile('python3', args, { timeout: 60000 }, (error, stdout, stderr) => {
                if (error) {
                    const exitCode = (error as any).code;
                    if (exitCode === 2) {
                        console.error(`[fetchTranscript] rate limited for ${videoId} — YouTube IP block`);
                    } else {
                        console.error(`[fetchTranscript] error for ${videoId}: ${error.message}`);
                    }
                    resolve(null);
                    return;
                }

                const output = stdout.trim();
                if (!output || output === 'null') {
                    console.error(`[fetchTranscript] no transcript available for ${videoId}`);
                    resolve(null);
                    return;
                }

                try {
                    const result = JSON.parse(output);
                    if (!Array.isArray(result) || result.length === 0) {
                        resolve(null);
                        return;
                    }
                    resolve(result as TranscriptSegment[]);
                } catch (err: any) {
                    console.error(`[fetchTranscript] parse error for ${videoId}: ${err.message}`);
                    resolve(null);
                }
            });
        });
    }

    sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const youtubePlugin = new YouTubePlugin();
