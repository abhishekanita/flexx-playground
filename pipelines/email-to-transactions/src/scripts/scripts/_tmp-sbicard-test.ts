import '@/loaders/logger';
import * as fs from 'fs';
import * as path from 'path';
import { parseSbiCardCcStatement } from '@/pipelines/parsers/providers/banks/sbicard-cc-statement.parser';

const outDir = path.join(process.cwd(), 'output', 'sbicard');
const files = fs.readdirSync(outDir).filter(f => f.endsWith('.txt')).sort();

console.log(`Testing ${files.length} SBI Card statement(s)\n`);

for (const file of files) {
    const text = fs.readFileSync(path.join(outDir, file), 'utf-8');
    const result = parseSbiCardCcStatement(text);

    const debits = result.transactions.filter(t => !t.isCredit);
    const credits = result.transactions.filter(t => t.isCredit);
    const totalDebits = debits.reduce((s, t) => s + t.amount, 0);
    const totalCredits = credits.reduce((s, t) => s + t.amount, 0);

    const errors: string[] = [];
    if (!result.cardNumber) errors.push('missing cardNumber');
    if (!result.statementDate) errors.push('missing statementDate');
    if (!result.paymentDueDate) errors.push('missing paymentDueDate');
    if (result.transactions.length === 0) errors.push('NO TRANSACTIONS');
    const zeroAmt = result.transactions.filter(t => t.amount === 0);
    if (zeroAmt.length > 0) errors.push(`${zeroAmt.length} zero-amount txns`);
    const noDate = result.transactions.filter(t => !t.date);
    if (noDate.length > 0) errors.push(`${noDate.length} missing-date txns`);

    const status = errors.length === 0 ? '✓' : '✗';
    console.log(`${status} ${file}`);
    console.log(`  Card: ${result.cardNumber} | ${result.cardHolder}`);
    console.log(`  Stmt: ${result.statementNumber} | Date: ${result.statementDate} | Due: ${result.paymentDueDate}`);
    console.log(`  Period: ${result.billingPeriod.from} to ${result.billingPeriod.to}`);
    console.log(`  TAD: ${result.totalAmountDue} | Min: ${result.minimumAmountDue}`);
    console.log(`  Limits: ${result.creditLimit} / ${result.cashLimit} | Avail: ${result.availableCreditLimit} / ${result.availableCashLimit}`);
    console.log(`  Summary: Prev=${result.previousBalance} Pay=${result.paymentsCredits} Fee=${result.feeTaxesInterest} Outstanding=${result.totalOutstanding}`);
    console.log(`  Reward: ${JSON.stringify(result.rewardPoints)}`);
    console.log(`  Txns: ${result.transactions.length} (${debits.length} debits, ${credits.length} credits)`);
    console.log(`  Debits: ${totalDebits.toFixed(2)} | Credits: ${totalCredits.toFixed(2)}`);
    if (errors.length > 0) console.log(`  ERRORS: ${errors.join(', ')}`);

    for (const t of result.transactions) {
        const type = t.isCredit ? 'CR' : 'DR';
        const fx = t.foreignCurrency ? ` (${t.foreignCurrency} ${t.foreignAmount})` : '';
        console.log(`    ${t.index}. ${t.date} ${type} ${t.amount.toFixed(2)}${fx} | ${t.description}`);
    }
    console.log();
}

// Save parsed JSON
if (files.length > 0) {
    const text = fs.readFileSync(path.join(outDir, files[0]), 'utf-8');
    const result = parseSbiCardCcStatement(text);
    fs.writeFileSync(path.join(outDir, 'parsed-sample.json'), JSON.stringify(result, null, 2));
    console.log('Saved parsed-sample.json');
}
