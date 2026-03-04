/**
 * Test Gmail OAuth flow in isolation.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/scripts/gmail/test-gmail-auth.ts
 */
import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { gmailPlugin } from '@/plugins/gmail/gmail.plugin';
import logger from '@/utils/logger';

async function main() {
    const log = logger.createServiceLogger('TestGmailAuth');

    log.info('Connecting to database...');
    await databaseLoader();

    log.info('Starting Gmail OAuth flow...');
    log.info('A browser window should open for authentication.');

    try {
        const tokens = await gmailPlugin.authenticateInteractive();

        log.green('\nAuthentication successful!');
        log.info(`  Email:         ${tokens.email}`);
        log.info(`  Access Token:  ${tokens.accessToken.substring(0, 20)}...`);
        log.info(`  Refresh Token: ${tokens.refreshToken.substring(0, 20)}...`);
        log.info(`  Expires At:    ${tokens.expiresAt.toISOString()}`);

        // Quick test — list 5 messages
        const gmail = gmailPlugin.authenticateWithTokens(tokens.accessToken, tokens.refreshToken);
        const ids = await gmailPlugin.fetchMessageIds(gmail, 'newer_than:1d', 5);
        log.info(`\nTest fetch: found ${ids.length} messages from last 24h`);
    } catch (err: any) {
        log.error(`Authentication failed: ${err.message}`);
    }

    process.exit(0);
}

main();
