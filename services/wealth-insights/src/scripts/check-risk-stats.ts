import mongoose from 'mongoose';
import { config } from '@/config/config';
import '@/schema/market/groww-scheme.schema';

async function main() {
    await mongoose.connect(config.db.uri + '/' + config.db.name);
    const db = mongoose.connection.db;
    if (!db) { console.error('No DB'); process.exit(1); }

    const coll = db.collection('mfs.market.groww-schemes');
    const docs = await coll.find({ 'riskStats.sharpe': { $ne: null } })
        .project({ schemeName: 1, isin: 1, riskStats: 1 })
        .limit(20)
        .toArray();

    console.log('Groww Risk Stats from DB:\n');
    for (const d of docs) {
        const name = (d.schemeName || '').substring(0, 45).padEnd(45);
        const rs = d.riskStats || {};
        console.log(`${name} | sharpe: ${rs.sharpe} | stdDev: ${rs.stdDev} | sortino: ${rs.sortino}`);
    }

    await mongoose.disconnect();
}

main().catch(console.error);
