/**
 * Run the email financial data pipeline for a user.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/run-pipeline.ts
 *
 * Reads Gmail credentials from abhishek-gmail-integration.json (same as experiments).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

// Init logger before anything else
import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { pipelineOrchestrator } from '@/services/pipeline/pipeline-orchestrator.service';
import { gmailPlugin } from '@/plugins/gmail.plugin';
import { Types } from 'mongoose';

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');

async function main() {
    await databaseLoader();

    // Load user credentials
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        logger.error(`Credentials file not found: ${CREDENTIALS_PATH}`);
        process.exit(1);
    }

    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const accessToken = creds.accessToken || creds.access_token;
    const refreshToken = creds.refreshToken || creds.refresh_token;

    if (!refreshToken) {
        logger.error('No refresh token found in credentials file');
        process.exit(1);
    }

    // Refresh the access token
    logger.info('Refreshing access token...');
    let freshToken: string;
    try {
        freshToken = await gmailPlugin.refreshAccessToken(refreshToken);
        logger.info('Access token refreshed successfully');
    } catch (err: any) {
        logger.warn(`Token refresh failed, using existing: ${err.message}`);
        freshToken = accessToken;
    }

    // Parse userId/integrationId — handles both plain string and MongoDB Extended JSON {"$oid": "..."}
    const parseObjectId = (val: any): Types.ObjectId => {
        if (!val) return new Types.ObjectId();
        if (typeof val === 'string') return new Types.ObjectId(val);
        if (val.$oid) return new Types.ObjectId(val.$oid);
        return new Types.ObjectId();
    };

    const userId = parseObjectId(creds.userId);
    const integrationId = parseObjectId(creds.integrationId || creds._id);

    logger.info(`Running pipeline for user ${userId}...`);

    const run = await pipelineOrchestrator.runPipeline({
        userId,
        integrationId,
        accessToken: freshToken,
        refreshToken,
        trigger: 'manual',
    });

    // Print results
    logger.info('=== Pipeline Complete ===');
    logger.info(`Status: ${run.status}`);
    logger.info(`Stats: ${JSON.stringify(run.stats, null, 2)}`);

    for (const stage of run.stages) {
        const duration =
            stage.startedAt && stage.completedAt
                ? `${new Date(stage.completedAt).getTime() - new Date(stage.startedAt).getTime()}ms`
                : '-';
        logger.info(`  ${stage.name}: ${stage.status} (${duration})`);
        if (stage.metadata) {
            logger.info(`    ${JSON.stringify(stage.metadata)}`);
        }
    }

    if (run.error) {
        logger.error(`Error: ${run.error}`);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
