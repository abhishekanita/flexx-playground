import * as fs from 'fs';
import * as path from 'path';
import { AnalysisEngine } from '@/core/analyse';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';

export const runAnalysis = async (parsedJsonPath?: string) => {
    try {
        // Load parsed JSON — accepts either a MongoDB doc (with .data wrapper) or raw MFDetailedStatementData
        const rawPath = path.resolve(__dirname, parsedJsonPath || '../../parsed.json');
        const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

        const data: MFDetailedStatementData = raw.data || raw;
        const requestId = raw.requestId || 'test-run';

        console.log('━━━ Analysis Engine ━━━\n');
        console.log(`Investor: ${data.investor.name}`);
        console.log(`Period: ${data.statementPeriod.from} → ${data.statementPeriod.to}`);
        console.log(`Folios: ${data.folios.length}`);
        console.log(`Total Cost: ₹${data.totalCostValue.toLocaleString('en-IN')}`);
        console.log(`Total Market: ₹${data.totalMarketValue.toLocaleString('en-IN')}`);
        console.log('');

        const engine = new AnalysisEngine();

        // Run with enrichment (Phase 2)
        console.log('Running analysis with enrichment...\n');
        const result = await engine.analyse(data, requestId, {
            skipEnrichment: false,
            // holdingsDir: path.resolve(__dirname, '../../holdings'), // uncomment if you have local holdings files
        });

        // ─── Portfolio Summary ───
        const ps = result.portfolioSummary;
        console.log('── Portfolio Summary ──');
        console.log(`  Cost Value:       ₹${ps.totalCostValue.toLocaleString('en-IN')}`);
        console.log(`  Market Value:     ₹${ps.totalMarketValue.toLocaleString('en-IN')}`);
        console.log(`  Unrealised Gain:  ₹${ps.totalUnrealisedGain.toLocaleString('en-IN')} (${ps.totalUnrealisedGainPct.toFixed(2)}%)`);
        console.log(`  Total Invested:   ₹${ps.totalInvested.toLocaleString('en-IN')}`);
        console.log(`  Total Withdrawn:  ₹${ps.totalWithdrawn.toLocaleString('en-IN')}`);
        console.log(`  Lifetime P&L:     ₹${ps.lifetimePnL.toLocaleString('en-IN')} (${ps.lifetimeReturnPct.toFixed(2)}%)`);
        console.log(`  Active Folios:    ${ps.activeFolioCount}`);
        console.log(`  Closed Folios:    ${ps.closedFolioCount}`);
        console.log('');

        console.log('  Fund House Breakdown:');
        for (const fh of ps.fundHouseSummary) {
            console.log(`    ${fh.fundHouse}: ₹${fh.marketValue.toLocaleString('en-IN')} (${fh.weight.toFixed(1)}%) | Gain: ${fh.gainPct.toFixed(1)}%`);
        }
        console.log('');

        // ─── XIRR ───
        const xi = result.xirrAnalysis;
        console.log('── XIRR Analysis ──');
        console.log(`  Portfolio XIRR:           ${isNaN(xi.portfolioXIRR) ? 'N/A' : xi.portfolioXIRR.toFixed(2) + '%'}`);
        console.log(`  Portfolio XIRR (ex-chrg): ${isNaN(xi.portfolioXIRRExCharges) ? 'N/A' : xi.portfolioXIRRExCharges.toFixed(2) + '%'}`);
        console.log('');

        console.log('  Scheme-Level XIRR:');
        const sortedSchemes = [...xi.schemeXIRR].sort((a, b) => b.marketValue - a.marketValue);
        for (const s of sortedSchemes) {
            if (s.marketValue <= 0) continue;
            const xirrStr = isNaN(s.xirr) ? 'N/A' : s.xirr.toFixed(2) + '%';
            console.log(`    ${s.schemeName.substring(0, 45).padEnd(45)} | ₹${s.marketValue.toLocaleString('en-IN').padStart(12)} | XIRR: ${xirrStr.padStart(8)} | ${s.reliability}`);
        }
        console.log('');

        // ─── Benchmark Comparison ───
        if (result.benchmarkComparison) {
            const bc = result.benchmarkComparison;
            console.log('── Benchmark Comparison ──');
            console.log('  Portfolio Benchmarks:');
            for (const pb of bc.portfolioBenchmarks) {
                console.log(`    ${pb.benchmarkName.padEnd(20)} | CAGR: ${pb.cagr.toFixed(2)}% | Vol: ${pb.volatility.toFixed(1)}% | MaxDD: ${pb.maxDrawdown.toFixed(1)}%`);
            }
            console.log('');
            console.log('  Fund vs Benchmark:');
            for (const fvb of bc.fundVsBenchmark.filter((f) => f.includeInSummary)) {
                const gapSign = fvb.gapPctPoints >= 0 ? '+' : '';
                console.log(`    ${fvb.schemeName.substring(0, 40).padEnd(40)} | XIRR: ${fvb.schemeXIRR.toFixed(1)}% vs ${fvb.benchmarkName}: ${fvb.benchmarkCAGR.toFixed(1)}% | Gap: ${gapSign}${fvb.gapPctPoints.toFixed(1)}pp`);
            }
            console.log('');
        } else {
            console.log('── Benchmark Comparison: SKIPPED (no benchmark data) ──\n');
        }

        // ─── TER Analysis ───
        if (result.terAnalysis) {
            const ter = result.terAnalysis;
            console.log('── TER Analysis ──');
            console.log(`  Potential Annual Savings: ₹${ter.potentialAnnualSavings.toLocaleString('en-IN')}`);
            for (const s of ter.schemes.slice(0, 5)) {
                const terStr = s.directTER !== null ? s.directTER.toFixed(2) + '%' : 'N/A';
                console.log(`    ${s.schemeName.substring(0, 45).padEnd(45)} | ${s.plan.padEnd(7)} | TER: ${terStr} | Cost: ₹${s.annualCostAmount.toLocaleString('en-IN')}`);
            }
            console.log('');
        } else {
            console.log('── TER Analysis: SKIPPED (no metadata) ──\n');
        }

        // ─── Active Holdings ───
        console.log('── Active Holdings ──');
        for (const h of result.activeHoldings) {
            console.log(`  ${h.schemeName.substring(0, 50).padEnd(50)} | ₹${h.marketValue.toLocaleString('en-IN').padStart(12)} | ${h.weight.toFixed(1)}% | Gain: ${h.unrealisedGainPct.toFixed(1)}%`);
        }
        console.log('');

        // ─── Coverage ───
        if (result.coverageAnalysis) {
            const cv = result.coverageAnalysis;
            console.log('── Coverage ──');
            console.log(`  Holdings Coverage: ${cv.holdingsCoveragePct.toFixed(1)}% (₹${cv.holdingsCoverageMV.toLocaleString('en-IN')})`);
            console.log(`  Unmapped:          ${cv.unmappedPct.toFixed(1)}% (₹${cv.unmappedMV.toLocaleString('en-IN')})`);
            console.log('');
        }

        // ─── Cashflow Analysis ───
        const cf = result.cashflowAnalysis;
        console.log('── Cashflow Analysis ──');
        for (const yr of cf.annualCashflows) {
            console.log(`  ${yr.year}: Invested ₹${yr.invested.toLocaleString('en-IN')} | Withdrawn ₹${yr.withdrawn.toLocaleString('en-IN')} | Net ₹${yr.netCashflow.toLocaleString('en-IN')}`);
        }
        console.log('');

        // ─── Closed / Redeemed Folios ───
        const closedFolios = data.folios.filter((f) => f.closingUnitBalance <= 0 && f.transactions.some(t => t.amount !== null && t.amount < 0));
        if (closedFolios.length > 0) {
            console.log('── Closed/Redeemed Folios ──');
            for (const f of closedFolios) {
                const totalInvested = f.transactions.filter(t => t.amount !== null && t.amount > 0).reduce((s, t) => s + (t.amount || 0), 0);
                const totalRedeemed = f.transactions.filter(t => t.amount !== null && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount || 0), 0);
                const pnl = totalRedeemed - totalInvested;
                const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
                console.log(`  ${f.scheme.current_name.substring(0, 42).padEnd(42)} | Invested: ₹${totalInvested.toLocaleString('en-IN')} | Redeemed: ₹${totalRedeemed.toLocaleString('en-IN')} | P&L: ₹${pnl.toLocaleString('en-IN')} (${pnlPct.toFixed(1)}%)`);
            }
            console.log('');
        }

        // ─── What-If Scenarios ───
        if (result.whatIfScenarios && result.whatIfScenarios.scenarios.length > 0) {
            console.log('── What-If Scenarios ──');
            for (const scenario of result.whatIfScenarios.scenarios) {
                const sign = scenario.difference.userDidBetter ? '(you did better)' : '(missed opportunity)';
                console.log(`  [${scenario.id}] ${scenario.name}`);
                console.log(`    ${scenario.description}`);
                console.log(`    Actual:       ₹${scenario.actual.currentValue.toLocaleString('en-IN')}${scenario.actual.xirr ? ` (${scenario.actual.xirr.toFixed(1)}% XIRR)` : ''}`);
                console.log(`    Hypothetical: ₹${scenario.hypothetical.hypotheticalValue.toLocaleString('en-IN')}${scenario.hypothetical.hypotheticalXirr ? ` (${scenario.hypothetical.hypotheticalXirr.toFixed(1)}% XIRR)` : ''}`);
                console.log(`    Difference:   ₹${scenario.difference.absoluteAmount.toLocaleString('en-IN')} ${sign}`);
                if (scenario.dataPointsForNarrative.framing) {
                    console.log(`    → ${scenario.dataPointsForNarrative.framing}`);
                }
                console.log('');
            }
        } else {
            console.log('── What-If Scenarios: NONE ──\n');
        }

        // ─── Dashboard Data ───
        if (result.dashboardData) {
            const dd = result.dashboardData;
            console.log('── Dashboard Data ──');
            console.log(`  Hero Stats:`);
            console.log(`    Current Value:   ₹${dd.heroStats.currentValueRs.toLocaleString('en-IN')}`);
            console.log(`    Unrealised Gain: ₹${dd.heroStats.unrealisedGainRs.toLocaleString('en-IN')} (${dd.heroStats.unrealisedGainPct.toFixed(1)}%)`);
            console.log(`    XIRR:            ${dd.heroStats.xirr.toFixed(1)}%`);
            console.log(`    Active Funds:    ${dd.heroStats.activeFunds}`);
            console.log(`  Real World Equivalents: ${dd.realWorldEquivalents.length} items`);
            for (const rwe of dd.realWorldEquivalents) {
                console.log(`    ${rwe.emoji} ${rwe.label}: ${rwe.displayCount} (${rwe.subtext})`);
            }
            console.log(`  Fund Race: ${dd.fundRace.length} entries`);
            console.log(`  Portfolio Map: ${dd.portfolioMap.length} blocks`);
            console.log(`  Heatmap: ${dd.heatmap.length} years`);
            console.log(`  Benchmark Bars: ${dd.benchmarkBars.length} bars`);
            console.log(`  Fund Cards: ${dd.fundCards.length} cards`);
            for (const fc of dd.fundCards.slice(0, 3)) {
                console.log(`    ${fc.shortName.padEnd(18)} | ${fc.personality} | ${fc.gainPct.toFixed(1)}% gain | ${fc.weightPct.toFixed(1)}%`);
            }
            console.log(`  Closed Funds: ${dd.closedFunds.length}`);
            console.log('');
        }

        // ─── Enrichment Meta ───
        console.log('── Enrichment Meta ──');
        console.log(`  Data Sources: ${result.enrichmentMeta.dataSourcesUsed.join(', ')}`);
        console.log(`  Benchmarks:   ${result.enrichmentMeta.benchmarkDataAvailable ? 'Yes' : 'No'}`);
        console.log(`  Metadata:     ${result.enrichmentMeta.fundMetadataAvailable ? 'Yes' : 'No'}`);
        console.log(`  Holdings:     ${result.enrichmentMeta.holdingsCoverage.toFixed(1)}%`);
        console.log('');

        // ─── Insights Layer ───
        console.log('── LLM Insights Layer ──');
        const skipLLM = !process.env.OPENAI_API_KEY;
        const insights = await engine.generateInsights(data, result, { skipLLM });

        // Behavioral signals (always available)
        const bh = insights.behavioral;
        console.log('  Behavioral Signals:');
        console.log(`    Investment cadence:   ${bh.investmentCadence.totalPurchases} purchases, avg ${bh.investmentCadence.avgDaysBetweenPurchases} days apart`);
        console.log(`    Consistency score:    ${bh.investmentCadence.consistencyScore}/100 (invested in ${bh.investmentCadence.investmentMonths} of ${bh.investmentCadence.totalMonthsInRange} months)`);
        console.log(`    Longest gap:          ${bh.investmentCadence.longestGapDays} days${bh.investmentCadence.longestGapPeriod ? ` (${bh.investmentCadence.longestGapPeriod.from} → ${bh.investmentCadence.longestGapPeriod.to})` : ''}`);
        console.log(`    Avg purchase amount:  ₹${bh.amountPatterns.avgPurchaseAmount.toLocaleString('en-IN')} (median: ₹${bh.amountPatterns.medianPurchaseAmount.toLocaleString('en-IN')})`);
        console.log(`    Round number bias:    ${(bh.amountPatterns.roundNumberBias * 100).toFixed(0)}%`);
        console.log(`    Amount trend:         ${bh.amountPatterns.trendDirection}`);
        console.log(`    Timing - dip buys:    ${bh.timingSignals.purchasesDuringDips}/${bh.timingSignals.totalPurchasesWithNAV} (score: ${bh.timingSignals.dipBuyerScore})`);
        console.log(`    Timing - peak buys:   ${bh.timingSignals.purchasesDuringPeaks}/${bh.timingSignals.totalPurchasesWithNAV} (score: ${bh.timingSignals.peakBuyerScore})`);
        if (bh.emotionalSignals.panicSelling.length > 0)
            console.log(`    Panic selling events:  ${bh.emotionalSignals.panicSelling.length}`);
        if (bh.emotionalSignals.fomoChasing.length > 0)
            console.log(`    FOMO chasing events:   ${bh.emotionalSignals.fomoChasing.length}`);
        if (bh.emotionalSignals.lossAversion.length > 0)
            console.log(`    Loss aversion signals: ${bh.emotionalSignals.lossAversion.length}`);
        console.log(`    Diversification:      ${bh.diversificationBehavior.fundHousesUsed} fund houses, ${bh.diversificationBehavior.schemesInvested} schemes (${bh.diversificationBehavior.activeSchemesNow} active)`);
        console.log(`    New fund frequency:   ${bh.diversificationBehavior.newFundFrequency}`);
        console.log('');

        // Anomalies (always available)
        if (insights.anomalies.length > 0) {
            console.log('  Anomalies Detected:');
            for (const a of insights.anomalies) {
                const icon = a.severity === 'critical' ? '!!!' : a.severity === 'warning' ? ' ! ' : ' i ';
                console.log(`    [${icon}] ${a.title}`);
            }
            console.log('');
        }

        // InsightCards (new format)
        if (insights.insightCards) {
            console.log('  InsightCards:');
            console.log(`    Greeting: ${insights.insightCards.greeting}`);
            console.log(`    Home Summary: ${insights.insightCards.homeSummary}`);
            console.log(`    Cards (${insights.insightCards.cards.length}):`);
            for (const card of insights.insightCards.cards) {
                console.log(`      [P${card.priority}] ${card.emoji} ${card.title} (${card.type}/${card.sentiment})`);
                console.log(`        ${card.headline}`);
                if (card.context) console.log(`        ${card.context}`);
            }
            console.log('');
        }

        // LLM narratives (only if API key available)
        if (insights.narratives && insights.narratives.headline) {
            console.log('  LLM-Generated Narratives:');
            console.log(`    Headline:    ${insights.narratives.headline}`);
            console.log('');
            if (insights.narratives.performanceStory) {
                console.log(`    Performance: ${insights.narratives.performanceStory}`);
                console.log('');
            }
            if (insights.narratives.behavioralObservation) {
                console.log(`    Behavior:    ${insights.narratives.behavioralObservation}`);
                console.log('');
            }
            if (insights.narratives.riskExplanation) {
                console.log(`    Risk:        ${insights.narratives.riskExplanation}`);
                console.log('');
            }
            if (insights.narratives.holdingInsights.length > 0) {
                console.log('    Holding Insights:');
                for (const hi of insights.narratives.holdingInsights) {
                    const name = (hi.schemeName || (hi as any).scheme || '').substring(0, 35).padEnd(35);
                    console.log(`      ${name} → ${hi.insight}`);
                }
                console.log('');
            }
            if (insights.narratives.anomalies.length > 0) {
                console.log('    Anomaly Explanations:');
                for (const a of insights.narratives.anomalies) {
                    console.log(`      [${a.severity.toUpperCase()}] ${a.title}`);
                    console.log(`        ${a.explanation}`);
                }
                console.log('');
            }
        } else {
            console.log('  LLM Narratives: SKIPPED (no OPENAI_API_KEY)\n');
        }

        console.log('━━━ Analysis Complete ━━━');
    } catch (err) {
        console.error('Analysis failed:', err);
    }
};
