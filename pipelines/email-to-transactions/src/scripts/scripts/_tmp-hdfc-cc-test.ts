import '@/loaders/logger';
import * as fs from 'fs';
import * as path from 'path';
import { parseHdfcCcStatement } from '@/pipelines/parsers/providers/banks/hdfc-cc-statement.parser';

const outDir = path.join(process.cwd(), 'output', 'hdfc-cc');
const files = fs.readdirSync(outDir).filter(f => f.startsWith('statement-') && f.endsWith('.txt')).sort();

console.log(`Testing ${files.length} HDFC CC statements\n`);

let totalErrors = 0;

for (const file of files) {
    const text = fs.readFileSync(path.join(outDir, file), 'utf-8');
    const result = parseHdfcCcStatement(text);

    const allTxns = [...result.domesticTransactions, ...result.internationalTransactions];
    const debits = allTxns.filter(t => !t.isCredit);
    const credits = allTxns.filter(t => t.isCredit);
    const totalDebits = debits.reduce((s, t) => s + t.amount, 0);
    const totalCredits = credits.reduce((s, t) => s + t.amount, 0);

    const errors: string[] = [];
    if (!result.cardNumber) errors.push('missing cardNumber');
    if (!result.statementDate) errors.push('missing statementDate');
    if (!result.paymentDueDate) errors.push('missing paymentDueDate');
    if (result.totalDues === 0 && allTxns.length > 0) errors.push('totalDues=0 but has txns');
    if (allTxns.length === 0) errors.push('NO TRANSACTIONS PARSED');

    // Check for zero-amount transactions
    const zeroAmt = allTxns.filter(t => t.amount === 0);
    if (zeroAmt.length > 0) errors.push(`${zeroAmt.length} zero-amount txns`);

    // Check for missing dates
    const noDate = allTxns.filter(t => !t.date);
    if (noDate.length > 0) errors.push(`${noDate.length} missing-date txns`);

    totalErrors += errors.length;

    const status = errors.length === 0 ? '✓' : '✗';
    console.log(`${status} ${file} (${result.format})`);
    console.log(`  Card: ${result.cardNumber} | Statement: ${result.statementDate} | Due: ${result.paymentDueDate}`);
    console.log(`  Period: ${result.billingPeriod.from} to ${result.billingPeriod.to}`);
    console.log(`  Total Dues: ${result.totalDues} | Min Due: ${result.minimumDue}`);
    console.log(`  Limits: ${result.creditLimit} / ${result.availableCreditLimit} / ${result.availableCashLimit}`);
    console.log(`  Summary: Open=${result.accountSummary.openingBalance} Pay=${result.accountSummary.paymentsCredits} Purch=${result.accountSummary.purchasesDebits} Finance=${result.accountSummary.financeCharges}`);
    console.log(`  Domestic: ${result.domesticTransactions.length} txns | Intl: ${result.internationalTransactions.length} txns`);
    console.log(`  Debits: ${debits.length} = ${totalDebits.toFixed(2)} | Credits: ${credits.length} = ${totalCredits.toFixed(2)}`);
    console.log(`  EMI Loans: ${result.emiLoans.length}`);
    if (result.gstSummary) console.log(`  GST: IGST=${result.gstSummary.igst} Total=${result.gstSummary.total}`);
    if (errors.length > 0) console.log(`  ERRORS: ${errors.join(', ')}`);

    // Print all transactions for inspection
    for (const t of allTxns) {
        const type = t.isCredit ? 'CR' : 'DR';
        const intl = t.isInternational ? ' [INTL]' : '';
        const fx = t.foreignCurrency ? ` (${t.foreignCurrency} ${t.foreignAmount})` : '';
        const rp = t.rewardPoints ? ` [${t.rewardPoints}pts]` : '';
        console.log(`    ${t.index}. ${t.date} ${type} ${t.amount.toFixed(2)}${fx}${rp}${intl} | ${t.description}${t.refNumber ? ' Ref:' + t.refNumber : ''}`);
    }
    console.log();
}

console.log(`\n=== TOTAL: ${files.length} files, ${totalErrors} errors ===`);

// Save one full parsed JSON for inspection
if (files.length > 0) {
    const sampleText = fs.readFileSync(path.join(outDir, files[files.length - 1]), 'utf-8');
    const sampleResult = parseHdfcCcStatement(sampleText);
    fs.writeFileSync(path.join(outDir, 'parsed-sample.json'), JSON.stringify(sampleResult, null, 2));
    console.log('Saved parsed-sample.json');
}
