import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { YouTubeProcessorService } from '@/services/processing/youtube-processor.service';

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const processor = new YouTubeProcessorService();
        const stats = await processor.processAll();

        logger.green('\n=== YouTube Processing Summary ===');
        logger.info(`  Videos processed: ${stats.processed}`);
        logger.info(`  KB entries created: ${stats.processed}`);
        logger.info(`  Errors: ${stats.errors}`);

        await mongoose.disconnect();
        logger.info('Database disconnected');
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
