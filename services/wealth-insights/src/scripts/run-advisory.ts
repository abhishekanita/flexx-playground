/**
 * Test script for the advisory data layer.
 * Runs: analysis → fitness score → insight states → card journeys → actionables
 *
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/run-advisory.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { AnalysisEngine } from '@/core/analyse';
import { computeDashboardData } from '@/core/analyse/modules/dashboard-data.computer';
import { insightStateService } from '@/services/advisory/insight-state.service';
import { cardJourneyService } from '@/services/advisory/card-journey.service';
import { computeActionables } from '@/core/advisory/actionables';
import { computePeerPercentile, computeShadowIndex, computeFICountdown } from '@/core/analyse/standalone';
import { config } from '@/config/config';

// Ensure schemas are registered
import '@/schema/user/user-insight-states.schema';
import '@/schema/user/user-card-journeys.schema';

async function main() {
    // ── Load Data ────────────────────────────────────────────────────────────
    const rawPath = path.resolve(__dirname, '../../parsed.json');
    if (!fs.existsSync(rawPath)) {
        console.error('parsed.json not found. Run the parser first.');
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
    const data: MFDetailedStatementData = raw.data || raw;
    const pan = data.investor.pan;

    console.log('\n' + '━'.repeat(60));
    console.log('  ADVISORY DATA LAYER — End-to-End Test');
    console.log('━'.repeat(60));
    console.log(`  Investor: ${data.investor.name}`);
    console.log(`  PAN:      ${pan}`);
    console.log(`  Folios:   ${data.folios.length}`);
    console.log('');

    // ── Connect to MongoDB ──────────────────────────────────────────────────
    console.log('  Connecting to MongoDB...');
    await mongoose.connect(config.db.uri + '/' + config.db.name);
    console.log('  Connected.\n');

    try {
        // ── Step 1: Run Analysis ────────────────────────────────────────────
        console.log('  [1/6] Running analysis engine...');
        const engine = new AnalysisEngine();
        const analysis = await engine.analyse(data, 'advisory-test', { skipEnrichment: false });
        console.log('    Analysis complete.\n');

        // ── Step 2: Dashboard Data + Fitness Score + Unique Numbers ─────────
        console.log('  [2/6] Computing dashboard data (with fitness & unique numbers)...');
        const dashboard = computeDashboardData(analysis);

        if (dashboard.fitnessScore) {
            const fs = dashboard.fitnessScore;
            console.log('    Fitness Score:');
            console.log(`      Composite: ${fs.composite}/100 (${fs.label})`);
            console.log(`      Performance:  ${fs.dimensions.performance}`);
            console.log(`      Efficiency:   ${fs.dimensions.efficiency}`);
            console.log(`      Structure:    ${fs.dimensions.structure}`);
            console.log(`      Discipline:   ${fs.dimensions.discipline}`);
        }

        if (dashboard.uniqueNumbers) {
            const un = dashboard.uniqueNumbers;
            console.log('    Unique Numbers:');
            console.log(`      Days Invested:    ${un.daysInvested}`);
            console.log(`      Daily Earnings:   ₹${un.dailyEarnings.toLocaleString('en-IN')}`);
            console.log(`      Investor Type:    ${un.investorType}`);
            console.log(`      Cost of Inaction: ₹${un.costOfInaction.toLocaleString('en-IN')}`);
            if (un.loyaltyBadge) {
                console.log(`      Loyalty Badge:    ${un.loyaltyBadge.schemeName} (${un.loyaltyBadge.holdingDays} days)`);
            }
        }
        console.log('');

        // ── Step 3: Insight State Evaluation ────────────────────────────────
        console.log('  [3/6] Evaluating 18 insight conditions...');
        const evalResult = await insightStateService.evaluateAndUpsert(pan, analysis);
        console.log(`    Total: ${evalResult.total} | READY: ${evalResult.ready} | PENDING: ${evalResult.pending}\n`);

        // Show all states grouped
        const grouped = await insightStateService.getAllGrouped(pan);
        for (const [category, states] of Object.entries(grouped)) {
            if (states.length === 0) continue;
            console.log(`    ${category.toUpperCase()}:`);
            for (const s of states) {
                const status = s.status.padEnd(9);
                const score = String(s.relevanceScore).padStart(3);
                console.log(`      [${status}] ${s.insightKey.padEnd(30)} score=${score}`);
            }
        }
        console.log('');

        // ── Step 4: Card Journeys for READY states ──────────────────────────
        console.log('  [4/6] Checking assembled card journeys...');
        const readyStates = await insightStateService.getReadyStates(pan, 20);
        console.log(`    ${readyStates.length} READY insight(s) with card journeys:\n`);

        for (const state of readyStates) {
            const cards = await cardJourneyService.getResolved(pan, state.insightKey as any, analysis);
            if (cards) {
                console.log(`    ${state.insightKey} (${cards.length} cards):`);
                for (const card of cards) {
                    console.log(`      [${card.slot.padEnd(10)}] ${card.title}`);
                    console.log(`                     ${card.body.slice(0, 100)}${card.body.length > 100 ? '...' : ''}`);
                }
                console.log('');
            }
        }

        // ── Step 5: Actionables ─────────────────────────────────────────────
        console.log('  [5/6] Computing actionables...');
        const actionables = computeActionables(analysis);
        console.log(`    ${actionables.length} actionable(s):\n`);

        for (const a of actionables) {
            console.log(`    [${a.relevanceScore.toString().padStart(3)}] ${a.id}`);
            console.log(`         ${a.title}`);
            console.log(`         ${a.description.slice(0, 120)}${a.description.length > 120 ? '...' : ''}`);
            console.log('');
        }

        // ── Step 6: Standalone Features ──────────────────────────────────
        console.log('  [6/6] Computing standalone features...');
        const peerPercentile = computePeerPercentile(analysis);
        const shadowIndex = computeShadowIndex(data, analysis);
        const fiCountdown = computeFICountdown(analysis);

        if (peerPercentile) {
            console.log(`    Peer Percentile: Top ${100 - peerPercentile.overallPercentile}% (${peerPercentile.personality})`);
        }
        if (shadowIndex) {
            console.log(`    Shadow Index: Alpha ${shadowIndex.portfolioLevel.alpha >= 0 ? '+' : ''}₹${Math.abs(shadowIndex.portfolioLevel.alpha).toLocaleString('en-IN')}`);
        }
        if (fiCountdown) {
            const baseline = fiCountdown.projections.find(p => p.isBaseline);
            console.log(`    FI Countdown: ${fiCountdown.progressPct.toFixed(1)}% done, ${baseline ? baseline.yearsToFI + 'y to FI' : 'N/A'}`);
        }
        console.log('');

        // ── Build resolved journeys map ──────────────────────────────────
        const resolvedJourneys: Record<string, any[]> = {};
        for (const state of readyStates) {
            const cards = await cardJourneyService.getResolved(pan, state.insightKey as any, analysis);
            if (cards) resolvedJourneys[state.insightKey] = cards;
        }

        // ── Export JSON for HTML viewer ───────────────────────────────────
        const exportData = {
            generatedAt: new Date().toISOString(),
            investor: { name: data.investor.name, pan: pan.slice(0, 3) + '****' + pan.slice(-2) },
            portfolioSummary: {
                totalInvested: analysis.portfolioSummary.totalInvested,
                totalMarketValue: analysis.portfolioSummary.totalMarketValue,
                totalUnrealisedGain: analysis.portfolioSummary.totalUnrealisedGain,
                totalUnrealisedGainPct: analysis.portfolioSummary.totalUnrealisedGainPct,
                activeFolioCount: analysis.portfolioSummary.activeFolioCount,
                portfolioXIRR: analysis.xirrAnalysis.portfolioXIRR,
            },
            dashboard,
            insightStates: Object.fromEntries(
                Object.entries(grouped).map(([cat, states]) => [cat, states.map(s => ({
                    insightKey: s.insightKey,
                    status: s.status,
                    relevanceScore: s.relevanceScore,
                }))])
            ),
            cardJourneys: resolvedJourneys,
            actionables,
            riskMetrics: analysis.riskMetrics ? {
                portfolioVolatility: analysis.riskMetrics.portfolioVolatility,
                sharpeRatio: analysis.riskMetrics.sharpeRatio,
                sortinoRatio: analysis.riskMetrics.sortinoRatio,
                maxDrawdown: analysis.riskMetrics.maxDrawdown,
            } : null,
            activeHoldings: analysis.activeHoldings.map(h => ({
                schemeName: h.schemeName,
                marketValue: h.marketValue,
                weight: h.weight,
                unrealisedGainPct: h.unrealisedGainPct,
                plan: h.plan,
            })),
            whatIfScenarios: analysis.whatIfScenarios?.scenarios.map(s => ({
                id: s.id,
                name: s.name,
                description: s.description,
                relevanceScore: s.relevanceScore,
                actual: s.actual,
                hypothetical: s.hypothetical,
                difference: s.difference,
                dataPointsForNarrative: s.dataPointsForNarrative,
            })) ?? [],
            peerPercentile,
            shadowIndex,
            fiCountdown,
        };

        const jsonPath = path.resolve(__dirname, '../../dashboard-data.json');
        const jsonStr = JSON.stringify(exportData, null, 2);
        fs.writeFileSync(jsonPath, jsonStr);
        console.log(`\n  Exported dashboard-data.json (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)`);

        // Embed data into dashboard.html so it works when opened as file://
        const htmlPath = path.resolve(__dirname, '../../dashboard.html');
        if (fs.existsSync(htmlPath)) {
            let html = fs.readFileSync(htmlPath, 'utf-8');
            // Remove old embedded data if present
            html = html.replace(/<script id="embedded-data">[\s\S]*?<\/script>\n?/, '');
            // Inject before closing </body>
            const embedTag = `<script id="embedded-data">window.__DASHBOARD_DATA__=${JSON.stringify(exportData)};</script>\n`;
            html = html.replace('</body>', embedTag + '</body>');
            fs.writeFileSync(htmlPath, html);
            console.log('  Embedded data into dashboard.html');
        }

        // ── Verify MongoDB Documents ────────────────────────────────────────
        console.log('\n  ── MongoDB Verification ──');
        const stateCount = await mongoose.connection.db!.collection('mfs.user.insight-states').countDocuments({ pan });
        const journeyCount = await mongoose.connection.db!.collection('mfs.user.card-journeys').countDocuments({ pan });
        console.log(`    insight-states:  ${stateCount} docs`);
        console.log(`    card-journeys:   ${journeyCount} docs`);

        console.log('\n' + '━'.repeat(60));
        console.log('  ADVISORY TEST COMPLETE');
        console.log('━'.repeat(60) + '\n');

    } finally {
        await mongoose.disconnect();
    }
}

main().catch(err => {
    console.error('Advisory test failed:', err);
    process.exit(1);
});
