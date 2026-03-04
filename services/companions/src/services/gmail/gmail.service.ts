import { gmail_v1 } from 'googleapis';
import { nanoid } from 'nanoid';
import { GmailPlugin, gmailPlugin } from '@/plugins/gmail/gmail.plugin';
import { GmailOAuthTokens } from '@/plugins/gmail/gmail.type';
import { GmailConnectionModel } from '@/schema';
import { GmailFilterService, FilterStats } from './gmail-filter.service';
import { GmailParserService, ParserStats } from './gmail-parser.service';
import { buildFinancialEmailQuery } from './gmail-queries';
import logger, { ServiceLogger } from '@/utils/logger';
import { formatCost } from '@/utils/ai-cost';

// ─────────────────────────────────────────────────────────────────────────────
// Gmail Service — Main orchestrator: auth → fetch → filter → parse → store
// ─────────────────────────────────────────────────────────────────────────────

export interface DumpResult {
    connectionId: string;
    email: string;
    fetchedCount: number;
    filterStats: FilterStats;
    parserStats: ParserStats;
    totalCostUsd: number;
    durationMs: number;
}

export class GmailService {
    private log: ServiceLogger;
    private plugin: GmailPlugin;
    private filterService: GmailFilterService;
    private parserService: GmailParserService;

    constructor() {
        this.log = logger.createServiceLogger('GmailService');
        this.plugin = gmailPlugin;
        this.filterService = new GmailFilterService();
        this.parserService = new GmailParserService();
    }

    /**
     * Full one-time dump: authenticate → fetch → filter → parse → store.
     */
    async runFullDump(monthsBack = 3): Promise<DumpResult> {
        const startTime = Date.now();

        // ─── Step 1: Authenticate ────────────────────────────────────────────
        this.log.info('Step 1: Authenticating with Gmail...');
        const tokens = await this.authenticate();
        const connectionId = await this.saveConnection(tokens);
        const gmail = this.plugin.authenticateWithTokens(tokens.accessToken, tokens.refreshToken);

        this.log.green(`Connected as: ${tokens.email} (connectionId: ${connectionId})`);

        // ─── Step 2: Fetch (Stage A - server-side filter) ────────────────────
        this.log.info(`\nStep 2: Fetching financial emails (last ${monthsBack} months)...`);
        const query = buildFinancialEmailQuery(monthsBack);
        const messageIds = await this.plugin.fetchMessageIds(gmail, query);

        this.log.info(`Stage A (query): ${messageIds.length} messages matched server-side filter`);

        if (messageIds.length === 0) {
            this.log.warn('No financial emails found. Check Gmail query or date range.');
            return this.buildResult(connectionId, tokens.email, 0, emptyFilterStats(), emptyParserStats(), startTime);
        }

        // Fetch full message content
        this.log.info(`Fetching ${messageIds.length} full messages...`);
        const messages = await this.plugin.fetchMessages(gmail, messageIds);
        this.log.info(`Fetched ${messages.length} messages successfully`);

        // ─── Step 3: Filter (Stage B + C) ────────────────────────────────────
        this.log.info('\nStep 3: Filtering through whitelist + AI...');
        const { filtered, stats: filterStats } = await this.filterService.filterMessages(messages);

        this.log.info(
            `Filter results: ${filterStats.whitelistMatched} whitelist + ${filterStats.aiClassified} AI classified = ${filtered.length} financial emails`
        );
        this.log.info(`Discarded: ${filterStats.discarded} non-financial, AI cost: ${formatCost(filterStats.aiCostUsd)}`);

        if (filtered.length === 0) {
            this.log.warn('No emails passed filtering. All were classified as non-financial.');
            return this.buildResult(connectionId, tokens.email, messages.length, filterStats, emptyParserStats(), startTime);
        }

        // ─── Step 4: Parse + Store ───────────────────────────────────────────
        this.log.info(`\nStep 4: Parsing ${filtered.length} financial emails...`);
        const parserStats = await this.parserService.parseEmails(filtered, connectionId);

        // ─── Update sync state ───────────────────────────────────────────────
        await GmailConnectionModel.updateOne(
            { connectionId },
            {
                $set: {
                    'syncState.totalFetched': messages.length,
                    'syncState.totalFiltered': filtered.length,
                    'syncState.totalProcessed': parserStats.totalParsed,
                    'syncState.lastSyncAt': new Date(),
                },
            }
        );

        return this.buildResult(connectionId, tokens.email, messages.length, filterStats, parserStats, startTime);
    }

    /**
     * Run dump with existing connection (skip OAuth).
     */
    async runDumpWithConnection(connectionId: string, monthsBack = 3): Promise<DumpResult> {
        const startTime = Date.now();

        const connection = await GmailConnectionModel.findOne({ connectionId });
        if (!connection) throw new Error(`Connection not found: ${connectionId}`);

        const gmail = this.plugin.authenticateWithTokens(connection.accessToken, connection.refreshToken);

        this.log.info(`Using existing connection: ${connection.email}`);

        const query = buildFinancialEmailQuery(monthsBack);
        const messageIds = await this.plugin.fetchMessageIds(gmail, query);
        this.log.info(`Stage A: ${messageIds.length} messages matched`);

        if (messageIds.length === 0) {
            return this.buildResult(connectionId, connection.email, 0, emptyFilterStats(), emptyParserStats(), startTime);
        }

        const messages = await this.plugin.fetchMessages(gmail, messageIds);
        const { filtered, stats: filterStats } = await this.filterService.filterMessages(messages);

        if (filtered.length === 0) {
            return this.buildResult(connectionId, connection.email, messages.length, filterStats, emptyParserStats(), startTime);
        }

        const parserStats = await this.parserService.parseEmails(filtered, connectionId);

        await GmailConnectionModel.updateOne(
            { connectionId },
            {
                $set: {
                    'syncState.totalFetched': messages.length,
                    'syncState.totalFiltered': filtered.length,
                    'syncState.totalProcessed': parserStats.totalParsed,
                    'syncState.lastSyncAt': new Date(),
                },
            }
        );

        return this.buildResult(connectionId, connection.email, messages.length, filterStats, parserStats, startTime);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private async authenticate(): Promise<GmailOAuthTokens> {
        // Check for existing active connection
        const existing = await GmailConnectionModel.findOne({ status: 'active' }).sort({ connectedAt: -1 });

        if (existing) {
            this.log.info(`Found existing connection for ${existing.email}`);
            // Check if token is still valid
            if (existing.tokenExpiresAt > new Date()) {
                this.log.info('Token still valid, reusing...');
                return {
                    accessToken: existing.accessToken,
                    refreshToken: existing.refreshToken,
                    expiresAt: existing.tokenExpiresAt,
                    email: existing.email,
                };
            }
            this.log.warn('Token expired, re-authenticating...');
        }

        return this.plugin.authenticateInteractive();
    }

    private async saveConnection(tokens: GmailOAuthTokens): Promise<string> {
        // Upsert by email
        const existing = await GmailConnectionModel.findOne({ email: tokens.email });

        if (existing) {
            await GmailConnectionModel.updateOne(
                { email: tokens.email },
                {
                    $set: {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        tokenExpiresAt: tokens.expiresAt,
                        status: 'active',
                    },
                }
            );
            return existing.connectionId;
        }

        const connectionId = nanoid(12);
        await GmailConnectionModel.create({
            connectionId,
            email: tokens.email,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: tokens.expiresAt,
            status: 'active',
            syncState: {
                totalFetched: 0,
                totalFiltered: 0,
                totalProcessed: 0,
            },
            connectedAt: new Date(),
        });

        return connectionId;
    }

    private buildResult(
        connectionId: string,
        email: string,
        fetchedCount: number,
        filterStats: FilterStats,
        parserStats: ParserStats,
        startTime: number
    ): DumpResult {
        const totalCost = filterStats.aiCostUsd + parserStats.aiCostUsd;
        const durationMs = Date.now() - startTime;

        return {
            connectionId,
            email,
            fetchedCount,
            filterStats,
            parserStats,
            totalCostUsd: totalCost,
            durationMs,
        };
    }

    /**
     * Print a formatted summary of dump results.
     */
    printSummary(result: DumpResult): void {
        const durationSec = (result.durationMs / 1000).toFixed(1);

        this.log.info('\n' + '═'.repeat(60));
        this.log.green('  GMAIL DUMP COMPLETE');
        this.log.info('═'.repeat(60));
        this.log.info(`  Email:          ${result.email}`);
        this.log.info(`  Connection ID:  ${result.connectionId}`);
        this.log.info(`  Duration:       ${durationSec}s`);
        this.log.info('');
        this.log.info('  ── Pipeline Stats ──');
        this.log.info(`  Stage A (query):     ${result.fetchedCount} fetched`);
        this.log.info(`  Stage B (whitelist): ${result.filterStats.whitelistMatched} matched`);
        this.log.info(`  Stage C (AI):        ${result.filterStats.aiClassified} classified, ${result.filterStats.discarded} discarded`);
        this.log.info(`  New senders flagged: ${result.filterStats.newSendersFlagged}`);
        this.log.info('');
        this.log.info('  ── Parsing Stats ──');
        this.log.info(`  Total parsed:        ${result.parserStats.totalParsed}`);
        this.log.info(`  Template extractions:${result.parserStats.templateExtractions}`);
        this.log.info(`  AI extractions:      ${result.parserStats.aiExtractions}`);
        this.log.info(`  Templates generated: ${result.parserStats.templatesGenerated}`);
        this.log.info(`  Parse errors:        ${result.parserStats.errors}`);
        this.log.info('');
        this.log.info('  ── Cost ──');
        this.log.info(`  Filter AI cost:      ${formatCost(result.filterStats.aiCostUsd)}`);
        this.log.info(`  Parser AI cost:      ${formatCost(result.parserStats.aiCostUsd)}`);
        this.log.info(`  Total AI cost:       ${formatCost(result.totalCostUsd)}`);
        this.log.info('═'.repeat(60));
    }
}

// ─── Helper functions ────────────────────────────────────────────────────────

function emptyFilterStats(): FilterStats {
    return { total: 0, whitelistMatched: 0, aiClassified: 0, discarded: 0, aiCostUsd: 0, newSendersFlagged: 0 };
}

function emptyParserStats(): ParserStats {
    return { totalParsed: 0, templateExtractions: 0, aiExtractions: 0, templatesGenerated: 0, aiCostUsd: 0, errors: 0 };
}
