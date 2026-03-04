/**
 * Standalone script to run the full sync flow on parsed JSON files.
 * Usage: called from run-scripts.ts or directly
 */
import * as fs from 'fs';
import * as path from 'path';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { syncService } from '@/services/user/sync.service';
import { snapshotService } from '@/services/user/snapshot.service';
import { transactionService } from '@/services/user/transaction.service';
import { folioService } from '@/services/user/folio.service';
import { insightsService } from '@/services/user/insights.service';

export const runSync = async (parsedJsonPath: string, label: string) => {
    try {
        const rawPath = path.resolve(__dirname, parsedJsonPath);
        if (!fs.existsSync(rawPath)) {
            console.log(`[${label}] File not found: ${rawPath}`);
            return;
        }

        const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
        const data: MFDetailedStatementData = raw.data || raw;

        console.log(`\n${'━'.repeat(60)}`);
        console.log(`  SYNC: ${label}`);
        console.log(`${'━'.repeat(60)}`);
        console.log(`  Investor: ${data.investor.name}`);
        console.log(`  PAN:      ${data.investor.pan}`);
        console.log(`  Period:   ${data.statementPeriod.from} → ${data.statementPeriod.to}`);
        console.log(`  Folios:   ${data.folios.length}`);
        console.log(`  Total MV: ₹${data.totalMarketValue.toLocaleString('en-IN')}`);
        console.log('');

        // Run sync
        console.log('  [1/4] Syncing folios + transactions...');
        const result = await syncService.sync(data);

        console.log(`\n  ── Sync Results ──`);
        console.log(`    Folios upserted:       ${result.foliosUpserted}`);
        console.log(`    Transactions inserted:  ${result.transactionsInserted}`);
        console.log(`    Transactions duplicate: ${result.transactionsDuplicated}`);
        console.log(`    Snapshot updated:       ${result.snapshotUpdated}`);
        console.log(`    Insights triggered:     ${result.insightsTriggered}`);
        console.log('');

        // Verify data in collections
        console.log('  [2/4] Verifying stored data...');

        const folios = await folioService.getAllFolios(data.investor.pan);
        const activeFolios = folios.filter(f => f.status === 'active');
        const closedFolios = folios.filter(f => f.status === 'closed');
        console.log(`    Folios in DB:  ${folios.length} (${activeFolios.length} active, ${closedFolios.length} closed)`);

        const txCount = await transactionService.getTransactionCount(data.investor.pan);
        console.log(`    Transactions:  ${txCount}`);

        const snapshot = await snapshotService.getSnapshot(data.investor.pan);
        if (snapshot) {
            console.log(`    Snapshot:`);
            console.log(`      Market Value:    ₹${snapshot.summary.totalMarketValue.toLocaleString('en-IN')}`);
            console.log(`      Unrealised Gain: ₹${snapshot.summary.totalUnrealisedGain.toLocaleString('en-IN')} (${snapshot.summary.totalUnrealisedGainPct.toFixed(1)}%)`);
            console.log(`      Active Folios:   ${snapshot.summary.activeFolioCount}`);
            console.log(`      Lifetime P&L:    ₹${snapshot.summary.lifetimePnL.toLocaleString('en-IN')}`);
            console.log(`      Holdings:        ${snapshot.holdings.length}`);
            console.log(`      Sync Count:      ${snapshot.syncCount}`);
            console.log(`      Last Synced:     ${snapshot.lastSyncedAt}`);
        }
        console.log('');

        // Run sync again to verify dedup
        console.log('  [3/4] Running sync AGAIN (testing dedup)...');
        const result2 = await syncService.sync(data);
        console.log(`    Folios upserted:       ${result2.foliosUpserted}`);
        console.log(`    Transactions inserted:  ${result2.transactionsInserted} (should be 0)`);
        console.log(`    Transactions duplicate: ${result2.transactionsDuplicated}`);
        console.log(`    Insights triggered:     ${result2.insightsTriggered} (should be false)`);

        const txCount2 = await transactionService.getTransactionCount(data.investor.pan);
        console.log(`    Total txns after 2nd:  ${txCount2} (should equal ${txCount})`);
        console.log(`    Dedup working:         ${txCount2 === txCount ? 'YES ✓' : 'NO ✗'}`);
        console.log('');

        // Force-regenerate insights (always regenerate to pick up new dashboard fields)
        console.log('  [4/4] Generating insights (analysis + dashboard + cards)...');
        let insights: Awaited<ReturnType<typeof insightsService.getLatest>> = null;

        console.log('    Generating now (full analysis with enrichment)...');
        try {
            insights = await insightsService.generateAndStore(
                data.investor.pan,
                data.investor.email,
                data,
                'manual',
                { skipEnrichment: false },
            );
        } catch (err: any) {
            console.log(`    Insights generation failed: ${err.message}`);
        }
        if (insights) {
            console.log(`    Insights version:  ${insights.version}`);
            console.log(`    Trigger:           ${insights.trigger}`);
            console.log(`    Cards status:      ${insights.insightCardsStatus}`);
            if (insights.dashboardData) {
                const dd = insights.dashboardData;
                console.log(`    Dashboard Data:`);
                console.log(`      Hero XIRR:       ${dd.heroStats.xirr.toFixed(1)}%`);
                console.log(`      Fund Race:       ${dd.fundRace.length} entries`);
                console.log(`      Fund Cards:      ${dd.fundCards.length} cards`);
                console.log(`      Heatmap Years:   ${dd.heatmap.length}`);
                console.log(`      Equivalents:     ${dd.realWorldEquivalents.length}`);
                for (const rwe of dd.realWorldEquivalents) {
                    console.log(`        ${rwe.emoji} ${rwe.label}: ${rwe.displayCount}`);
                }
            }
            if (insights.insightCards) {
                console.log(`    Insight Cards:     ${insights.insightCards.cards.length}`);
                console.log(`      Greeting: ${insights.insightCards.greeting}`);
                console.log(`      Summary:  ${insights.insightCards.homeSummary}`);
                for (const card of insights.insightCards.cards) {
                    console.log(`      [P${card.priority}] ${card.emoji} ${card.title}: ${card.headline.slice(0, 100)}${card.headline.length > 100 ? '...' : ''}`);
                }
            }
        } else {
            console.log('    Insights: not yet available (still generating async)');
        }

        console.log(`\n  DONE: ${label}`);
        console.log(`${'━'.repeat(60)}\n`);

    } catch (err) {
        console.error(`[${label}] Sync failed:`, err);
    }
};

export const runBothSyncs = async () => {
    // await runSync('../../parsed-ashu.json', "Ashu's Portfolio");
    await runSync('../../parsed.json', "Apurv's Portfolio");
};
