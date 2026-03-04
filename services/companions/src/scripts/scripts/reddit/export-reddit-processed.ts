import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import redditService from '@/services/reddit/reddit.service';

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const processedPath = await redditService.exportProcessed('csv');
        logger.green(`Processed CSV exported: ${processedPath}`);

        const knowledgePath = await redditService.exportKnowledgeSearch('csv');
        logger.green(`Knowledge CSV exported: ${knowledgePath}`);

        // Also export full JSON with extraction data (use_cases, knowledge_qa, etc.)
        const jsonPath = await redditService.exportProcessed('json');
        logger.green(`Full JSON exported: ${jsonPath}`);

        await mongoose.disconnect();
        logger.info('Done');
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
