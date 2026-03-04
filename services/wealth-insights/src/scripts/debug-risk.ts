import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { config } from '@/config/config';
import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { AnalysisEngine } from '@/core/analyse';

async function main() {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../parsed.json'), 'utf-8'));
    const data: MFDetailedStatementData = raw.data || raw;

    await mongoose.connect(config.db.uri + '/' + config.db.name);

    const engine = new AnalysisEngine();
    const analysis = await engine.analyse(data, 'debug-risk', { skipEnrichment: false });

    const rm = analysis.riskMetrics;
    if (!rm) { console.log('No risk metrics'); process.exit(0); }

    console.log('\nPortfolio Risk Metrics:');
    console.log(`  Volatility:    ${rm.portfolioVolatility}`);
    console.log(`  Sharpe Ratio:  ${rm.sharpeRatio}`);
    console.log(`  Sortino Ratio: ${rm.sortinoRatio}`);
    console.log(`  Max Drawdown:  ${rm.maxDrawdown}`);
    console.log(`  Recovery Days: ${rm.drawdownRecoveryDays}`);

    console.log(`\nScheme Risk Metrics (${rm.schemeRiskMetrics.length}):`);
    for (const m of rm.schemeRiskMetrics) {
        console.log(`  ${m.schemeName.substring(0, 45).padEnd(45)} | vol=${m.volatility.toFixed(2)} | sharpe=${m.sharpeRatio.toFixed(2)} | sortino=${m.sortinoRatio.toFixed(2)} | mdd=${m.maxDrawdown.toFixed(2)} | pts=${m.dataPoints}`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
