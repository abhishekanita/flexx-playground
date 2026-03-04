import '@/loaders/logger';
import mongoose from 'mongoose';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '@/config';
import { InstagramReelModel } from '@/schema';

const WHISPER_MODEL = 'base';

function extractAudio(videoPath: string, audioPath: string): boolean {
    try {
        execSync(`ffmpeg -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y`, {
            stdio: 'pipe',
            timeout: 120000,
        });
        return true;
    } catch (err: any) {
        logger.error(`  ffmpeg error: ${err.message}`);
        return false;
    }
}

function runWhisper(audioPath: string): string | null {
    try {
        const output = execSync(`whisper-cli -m models/ggml-${WHISPER_MODEL}.bin -l auto -f "${audioPath}" --no-timestamps`, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 300000,
        });
        return output.trim();
    } catch (err: any) {
        logger.error(`  whisper error: ${err.message}`);
        return null;
    }
}

export async function fetchInstaTranscripts() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const reels = await InstagramReelModel.find(
            { transcript: { $in: [null, undefined, ''] }, videoLocalPath: { $ne: null } },
            { reelId: 1, caption: 1, videoLocalPath: 1, username: 1 }
        ).lean();

        logger.info(`Found ${reels.length} reels without transcripts`);

        let transcribed = 0;
        let failed = 0;

        for (const reel of reels) {
            logger.info(`[${transcribed + failed + 1}/${reels.length}] @${reel.username} - ${reel.caption?.substring(0, 50)}...`);

            const videoPath = reel.videoLocalPath!;
            if (!fs.existsSync(videoPath)) {
                logger.warn(`  Video file not found: ${videoPath}`);
                failed++;
                continue;
            }

            const audioPath = videoPath.replace(/\.mp4$/, '.wav');

            // Extract audio
            const extracted = extractAudio(videoPath, audioPath);
            if (!extracted) {
                failed++;
                continue;
            }
            console.log('extracted', extracted);

            // Run whisper
            const transcript = runWhisper(audioPath);

            // Clean up temp audio
            try {
                fs.unlinkSync(audioPath);
            } catch {}

            if (transcript) {
                await InstagramReelModel.updateOne({ _id: reel._id }, { $set: { transcript } });
                transcribed++;
                logger.green(`  Transcribed (${transcript.length} chars)`);
            } else {
                failed++;
                logger.warn(`  No transcript generated`);
            }
        }

        logger.green(`\n=== Instagram Transcript Summary ===`);
        logger.info(`  Total eligible: ${reels.length}`);
        logger.info(`  Transcribed: ${transcribed}`);
        logger.info(`  Failed: ${failed}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}
