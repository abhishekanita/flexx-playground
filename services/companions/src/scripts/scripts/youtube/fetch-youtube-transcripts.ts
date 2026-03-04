import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { YouTubeVideoModel } from '@/schema';
import { youtubePlugin } from '@/plugins/youtube/youtube.plugin';

const MIN_DURATION_SECONDS = 600; // 10 minutes

function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return parseInt(match[1] || '0', 10) * 3600 +
        parseInt(match[2] || '0', 10) * 60 +
        parseInt(match[3] || '0', 10);
}

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        // Find videos without transcripts, 10min+ duration
        const videos = await YouTubeVideoModel.find(
            { transcript: { $in: [null, undefined, ''] } },
            { videoId: 1, title: 1, duration: 1, channelName: 1 }
        ).lean();

        // Filter to 10min+ and sort longest first
        const eligible = videos
            .map((v) => ({ ...v, durationSeconds: parseDuration(v.duration || '') }))
            .filter((v) => v.durationSeconds >= MIN_DURATION_SECONDS)
            .sort((a, b) => b.durationSeconds - a.durationSeconds);

        logger.info(`Found ${videos.length} videos without transcripts`);
        logger.info(`Eligible (${MIN_DURATION_SECONDS / 60}min+): ${eligible.length}`);

        let fetched = 0;
        let failed = 0;

        for (const video of eligible) {
            const mins = Math.floor(video.durationSeconds / 60);
            const secs = video.durationSeconds % 60;
            logger.info(`[${fetched + failed + 1}/${eligible.length}] (${mins}m${secs}s) ${video.title?.substring(0, 60)}...`);

            const segments = await youtubePlugin.fetchTranscript(video.videoId);

            if (segments) {
                const fullTranscript = segments.map((s) => s.text).join(' ');
                await YouTubeVideoModel.updateOne(
                    { _id: video._id },
                    { $set: { transcript: fullTranscript, transcriptSegments: segments } }
                );
                fetched++;
                logger.green(`  ✓ Got ${segments.length} segments`);
            } else {
                failed++;
                logger.warn(`  ✗ No transcript available`);
            }

            await youtubePlugin.sleep(3000);
        }

        logger.green(`\n=== Transcript Backfill Summary ===`);
        logger.info(`  Total eligible: ${eligible.length}`);
        logger.info(`  Transcripts fetched: ${fetched}`);
        logger.info(`  Failed/unavailable: ${failed}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
