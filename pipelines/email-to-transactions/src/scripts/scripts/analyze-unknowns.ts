import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { TransactionModel } from '@/schema/transaction.schema';

(async () => {
    await databaseLoader();

    const unknowns = await TransactionModel.find({
        category: 'unknown',
        type: 'debit',
    }).sort({ amount: -1 }).lean();

    console.log(`Total unknown debits: ${unknowns.length}`);

    // Group by what data we DO have
    const hasNarration = unknowns.filter(t => t.raw_narration && t.raw_narration.length > 3);
    const hasMerchant = unknowns.filter(t => t.merchant_name && t.merchant_name.length > 1);
    const hasUpiRef = unknowns.filter(t => t.upi_ref);
    const hasVpa = unknowns.filter(t => t.upi_receiver_vpa);
    const hasAccount = unknowns.filter(t => t.account_last4);
    const noData = unknowns.filter(t => !t.raw_narration && !t.merchant_name);

    console.log(`\nData availability:`);
    console.log(`  Has narration: ${hasNarration.length}`);
    console.log(`  Has merchant name: ${hasMerchant.length}`);
    console.log(`  Has UPI ref: ${hasUpiRef.length}`);
    console.log(`  Has VPA: ${hasVpa.length}`);
    console.log(`  Has account: ${hasAccount.length}`);
    console.log(`  No narration + no merchant: ${noData.length}`);

    // Group by merchant name patterns
    const merchantGroups: Record<string, { count: number; totalAmount: number; samples: string[] }> = {};
    for (const t of unknowns) {
        const key = t.merchant_name || '(no merchant)';
        if (!merchantGroups[key]) merchantGroups[key] = { count: 0, totalAmount: 0, samples: [] };
        merchantGroups[key].count++;
        merchantGroups[key].totalAmount += t.amount;
        if (merchantGroups[key].samples.length < 2) {
            merchantGroups[key].samples.push(
                `Rs ${t.amount} | ${t.channel} | ${t.account_last4 || '?'} | ${(t.raw_narration || '').substring(0, 80)}`
            );
        }
    }

    console.log(`\n=== Unknown merchant groups (by name) ===`);
    const sortedGroups = Object.entries(merchantGroups)
        .sort((a, b) => b[1].totalAmount - a[1].totalAmount);
    for (const [name, g] of sortedGroups.slice(0, 25)) {
        console.log(`\n  "${name}" — ${g.count} txns, Rs ${Math.round(g.totalAmount).toLocaleString('en-IN')}`);
        g.samples.forEach(s => console.log(`    ${s}`));
    }

    // Group by narration patterns (first word/keyword)
    const narrationPatterns: Record<string, number> = {};
    for (const t of hasNarration) {
        const narr = t.raw_narration!;
        // Extract first meaningful segment
        let key: string;
        if (narr.startsWith('UPI/DR/') || narr.startsWith('UPI/CR/')) {
            const parts = narr.split('/');
            key = `UPI→${parts[3] || '?'}`;
        } else if (narr.startsWith('UPI/')) {
            const parts = narr.split('/');
            key = `UPI→${parts[1] || '?'}`;
        } else if (narr.startsWith('IB:')) {
            key = 'IB:transfer';
        } else if (narr.includes('NEFT')) {
            key = 'NEFT';
        } else {
            key = narr.split(/[\s\/]+/)[0];
        }
        narrationPatterns[key] = (narrationPatterns[key] || 0) + 1;
    }

    console.log(`\n=== Narration patterns ===`);
    const sortedPatterns = Object.entries(narrationPatterns).sort((a, b) => b[1] - a[1]);
    for (const [pat, count] of sortedPatterns.slice(0, 30)) {
        console.log(`  ${pat}: ${count}`);
    }

    // Amount distribution of unknowns
    const ranges = [
        { label: '< Rs 100', min: 0, max: 100 },
        { label: 'Rs 100-500', min: 100, max: 500 },
        { label: 'Rs 500-2000', min: 500, max: 2000 },
        { label: 'Rs 2000-10000', min: 2000, max: 10000 },
        { label: 'Rs 10K-50K', min: 10000, max: 50000 },
        { label: '> Rs 50K', min: 50000, max: Infinity },
    ];
    console.log(`\n=== Amount distribution ===`);
    for (const r of ranges) {
        const count = unknowns.filter(t => t.amount >= r.min && t.amount < r.max).length;
        console.log(`  ${r.label}: ${count}`);
    }

    // Potential enrichment strategies
    console.log(`\n=== Enrichment potential ===`);

    // 1. VPA-based: can infer merchant from VPA
    const vpaGroups: Record<string, number> = {};
    for (const t of hasVpa) {
        vpaGroups[t.upi_receiver_vpa!] = (vpaGroups[t.upi_receiver_vpa!] || 0) + 1;
    }
    console.log(`\nVPAs that could identify merchants:`);
    Object.entries(vpaGroups).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([vpa, count]) => {
        console.log(`  ${vpa}: ${count} txns`);
    });

    // 2. Recurring amounts (same amount + same merchant = subscription?)
    const recurringKey: Record<string, number> = {};
    for (const t of unknowns) {
        const key = `${t.amount}|${t.merchant_name || ''}`;
        recurringKey[key] = (recurringKey[key] || 0) + 1;
    }
    const recurring = Object.entries(recurringKey).filter(([, count]) => count >= 3);
    if (recurring.length > 0) {
        console.log(`\nRecurring patterns (same amount >= 3x):`);
        recurring.sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([key, count]) => {
            const [amount, merchant] = key.split('|');
            console.log(`  Rs ${amount} × ${count} — merchant: "${merchant || 'unknown'}"`);
        });
    }

    process.exit(0);
})();
