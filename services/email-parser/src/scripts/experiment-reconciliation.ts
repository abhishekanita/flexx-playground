import * as fs from 'fs';
import * as path from 'path';

// ── Config ──────────────────────────────────────────────────────────────────
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// ── Types ───────────────────────────────────────────────────────────────────

interface BankTxn {
    date: Date;
    dateStr: string;
    description: string;
    type: 'debit' | 'credit';
    amount: number;
    balance: number;
    channel: string;
    merchant: string;
    bank: string;
    category: string;
    upiId?: string;
}

interface EmailReceipt {
    senderId: string;
    senderName: string;
    date: Date;
    dateStr: string;
    amount: number;
    merchantName: string;
    orderId?: string;
    lineItems?: { name: string; quantity?: number; price: number }[];
    source: 'template' | 'direct';
}

interface MatchResult {
    bankTxn: BankTxn;
    emailReceipt: EmailReceipt;
    matchScore: number;
    matchType: 'exact_amount_date' | 'fuzzy_amount_date' | 'amount_only' | 'merchant_date';
    enrichment: {
        hasLineItems: boolean;
        hasOrderId: boolean;
        itemCount: number;
    };
}

// ── Date Helpers ────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
    // SBI: "DD-MM-YY" e.g. "01-12-25"
    const sbiMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (sbiMatch) {
        const year = parseInt(sbiMatch[3]) + 2000;
        return new Date(year, parseInt(sbiMatch[2]) - 1, parseInt(sbiMatch[1]));
    }
    // Kotak bank.in: "DD Mon YYYY"
    const kotakNewMatch = dateStr.match(/^(\d{2})\s+(\w{3})\s+(\d{4})$/);
    if (kotakNewMatch) {
        return new Date(`${kotakNewMatch[1]} ${kotakNewMatch[2]} ${kotakNewMatch[3]}`);
    }
    // Kotak kotak.com: "DD Mon, YYYY"
    const kotakOldMatch = dateStr.match(/^(\d{2})\s+(\w{3}),\s+(\d{4})$/);
    if (kotakOldMatch) {
        return new Date(`${kotakOldMatch[1]} ${kotakOldMatch[2]} ${kotakOldMatch[3]}`);
    }
    return new Date(dateStr);
}

function dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(a: Date, b: Date): number {
    return Math.abs(Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)));
}

function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Categorization (same as analyse-statements.ts) ──────────────────────────

function categorize(desc: string, merchant: string, amount: number, type: string): string {
    const d = (desc + ' ' + merchant).toLowerCase();

    if (d.includes('sweep') || d.includes('fd premat') || d.includes('fd maturity'))
        return 'Sweep/FD (Internal)';
    if (d.includes('upilite') && type === 'debit' && amount === 2000)
        return 'UPI Lite Top-up';
    if (d.match(/upi\/.*(abhishek|aggar)/i) && type === 'debit')
        return 'Self Transfer';
    if (d.match(/upi\/.*(abhishek|aggar)/i) && type === 'credit')
        return 'Self Transfer';
    if (d.includes('rent') || d.includes('harsh kumar cho'))
        return 'Rent';
    if (d.includes('swiggy') || d.includes('zomato') || d.includes('bistro') ||
        d.includes('kfc') || d.includes('daalchini') || d.includes('biryani') ||
        d.includes('food') || d.includes('restaurant') || d.includes('cafe'))
        return 'Food & Dining';
    if (d.includes('blinkit') || d.includes('bigbasket') || d.includes('1mg') || d.includes('zepto'))
        return 'Groceries & Health';
    if (d.includes('netflix') || d.includes('spotify') || d.includes('apple') ||
        d.includes('youtube') || d.includes('hotstar') || d.includes('google'))
        return 'Subscriptions';
    if (d.includes('airtel') || d.includes('jio') || d.includes('recharge') || d.includes('bill'))
        return 'Bills & Recharges';
    if (d.includes('amazon') || d.includes('flipkart') || d.includes('myntra'))
        return 'Shopping';
    if (d.includes('uber') || d.includes('ola') || d.includes('rapido') || d.includes('metro'))
        return 'Transport';
    if (d.includes('makemy') || d.includes('irctc') || d.includes('bookmyshow'))
        return 'Travel & Entertainment';
    if (d.includes('nach') || d.includes('groww') || d.includes('clearing corp'))
        return 'EMI / SIP / Insurance';
    if (d.includes('chrg') || d.includes('charge') || d.includes('fee') || d.includes('gst'))
        return 'Bank Charges';
    if (d.includes('refund') || d.includes('rev-upi'))
        return 'Refund';
    if (d.includes('interest') || d.includes('int.pd'))
        return 'Interest Earned';
    if (d.includes('neft') || d.includes('clg to'))
        return 'Family Transfers';
    if (d.match(/upi\/[a-z]/i))
        return 'Person Transfers';

    return 'Other';
}

// ── Merchant Normalization ──────────────────────────────────────────────────

function normalizeMerchant(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/bundl\s*technologies?/i, 'swiggy')
        .replace(/uber\s*india/i, 'uber')
        .replace(/ola\s*cabs/i, 'ola')
        .replace(/flipkart\s*internet/i, 'flipkart')
        .replace(/amazon\s*seller/i, 'amazon')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
}

function merchantSimilarity(a: string, b: string): number {
    const na = normalizeMerchant(a);
    const nb = normalizeMerchant(b);

    if (na === nb) return 1.0;
    if (na.includes(nb) || nb.includes(na)) return 0.8;

    // Word overlap
    const wordsA = new Set(na.split(/\s+/));
    const wordsB = new Set(nb.split(/\s+/));
    const intersection = [...wordsA].filter(w => wordsB.has(w));
    if (intersection.length > 0) return 0.5;

    return 0;
}

// ── Load Bank Statements ────────────────────────────────────────────────────

function loadBankTxns(): BankTxn[] {
    const txns: BankTxn[] = [];

    const sbiPath = path.join(DOWNLOADS_DIR, 'sbi-statements-parsed.json');
    const kotakPath = path.join(DOWNLOADS_DIR, 'kotak-statements-parsed.json');

    if (fs.existsSync(sbiPath)) {
        const sbiStatements = JSON.parse(fs.readFileSync(sbiPath, 'utf-8'));
        for (const stmt of sbiStatements) {
            for (const t of stmt.transactions) {
                const date = parseDate(t.date);
                txns.push({
                    date,
                    dateStr: dateKey(date),
                    description: t.description,
                    type: t.type,
                    amount: t.amount,
                    balance: t.balance,
                    channel: t.channel,
                    merchant: t.merchant,
                    bank: 'SBI',
                    category: categorize(t.description, t.merchant, t.amount, t.type),
                    upiId: t.upiId,
                });
            }
        }
        console.log(`  Loaded ${txns.length} SBI transactions`);
    } else {
        console.log(`  SBI statements not found at ${sbiPath}`);
    }

    const sbiCount = txns.length;

    if (fs.existsSync(kotakPath)) {
        const kotakStatements = JSON.parse(fs.readFileSync(kotakPath, 'utf-8'));
        for (const stmt of kotakStatements) {
            for (const t of stmt.transactions) {
                const date = parseDate(t.date);
                txns.push({
                    date,
                    dateStr: dateKey(date),
                    description: t.description,
                    type: t.type,
                    amount: t.amount,
                    balance: t.balance,
                    channel: t.channel,
                    merchant: t.merchant,
                    bank: 'KOTAK',
                    category: categorize(t.description, t.merchant, t.amount, t.type),
                    upiId: t.upiId,
                });
            }
        }
        console.log(`  Loaded ${txns.length - sbiCount} Kotak transactions`);
    } else {
        console.log(`  Kotak statements not found at ${kotakPath}`);
    }

    return txns.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ── Load Email Extractions ──────────────────────────────────────────────────

function loadEmailReceipts(): EmailReceipt[] {
    const receipts: EmailReceipt[] = [];

    const resultsPath = path.join(DOWNLOADS_DIR, 'experiment-template-gen-results.json');

    if (!fs.existsSync(resultsPath)) {
        console.log(`  No email extraction results found at ${resultsPath}`);
        console.log(`  Run experiment-template-gen.ts first to generate email extractions.`);
        return receipts;
    }

    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

    for (const senderResult of results) {
        if (!senderResult.comparisons) continue;

        for (const comp of senderResult.comparisons) {
            // Prefer template result if it has valid amount, otherwise use direct result
            const templateOk = comp.templateResult?.amount && comp.templateResult.amount > 0;
            const directOk = comp.directResult?.amount && comp.directResult.amount > 0;

            if (templateOk) {
                const dateStr = comp.templateResult.date || comp.directResult?.date || '';
                const date = dateStr ? new Date(dateStr) : new Date();
                receipts.push({
                    senderId: senderResult.senderId,
                    senderName: senderResult.senderName,
                    date: isNaN(date.getTime()) ? new Date() : date,
                    dateStr: isNaN(date.getTime()) ? '' : dateKey(date),
                    amount: comp.templateResult.amount,
                    merchantName: senderResult.senderName,
                    orderId: comp.templateResult.orderId || undefined,
                    lineItems: comp.templateResult.lineItems?.length > 0 ? comp.templateResult.lineItems : undefined,
                    source: 'template',
                });
            } else if (directOk) {
                const date = new Date(comp.directResult.date);
                receipts.push({
                    senderId: senderResult.senderId,
                    senderName: senderResult.senderName,
                    date: isNaN(date.getTime()) ? new Date() : date,
                    dateStr: isNaN(date.getTime()) ? '' : dateKey(date),
                    amount: comp.directResult.amount,
                    merchantName: comp.directResult.merchantName || senderResult.senderName,
                    orderId: comp.directResult.orderId || undefined,
                    lineItems: comp.directResult.lineItems || undefined,
                    source: 'direct',
                });
            }
        }
    }

    console.log(`  Loaded ${receipts.length} email receipts from experiment results`);
    return receipts;
}

// ── Matching Logic ──────────────────────────────────────────────────────────

function matchTransactions(bankTxns: BankTxn[], emailReceipts: EmailReceipt[]): {
    matches: MatchResult[];
    unmatchedBank: BankTxn[];
    unmatchedEmail: EmailReceipt[];
} {
    const matches: MatchResult[] = [];
    const usedBankIds = new Set<number>();
    const usedEmailIds = new Set<number>();

    // Pass 1: Exact amount + same date
    for (let ei = 0; ei < emailReceipts.length; ei++) {
        if (usedEmailIds.has(ei)) continue;
        const receipt = emailReceipts[ei];

        for (let bi = 0; bi < bankTxns.length; bi++) {
            if (usedBankIds.has(bi)) continue;
            const txn = bankTxns[bi];
            if (txn.type !== 'debit') continue;

            if (Math.abs(txn.amount - receipt.amount) < 1 && dayDiff(txn.date, receipt.date) === 0) {
                matches.push({
                    bankTxn: txn,
                    emailReceipt: receipt,
                    matchScore: 1.0,
                    matchType: 'exact_amount_date',
                    enrichment: {
                        hasLineItems: !!(receipt.lineItems && receipt.lineItems.length > 0),
                        hasOrderId: !!receipt.orderId,
                        itemCount: receipt.lineItems?.length || 0,
                    },
                });
                usedBankIds.add(bi);
                usedEmailIds.add(ei);
                break;
            }
        }
    }

    // Pass 2: Fuzzy amount (within 5%) + date within 1 day
    for (let ei = 0; ei < emailReceipts.length; ei++) {
        if (usedEmailIds.has(ei)) continue;
        const receipt = emailReceipts[ei];

        for (let bi = 0; bi < bankTxns.length; bi++) {
            if (usedBankIds.has(bi)) continue;
            const txn = bankTxns[bi];
            if (txn.type !== 'debit') continue;

            const amountDiff = Math.abs(txn.amount - receipt.amount) / Math.max(txn.amount, 1);
            if (amountDiff < 0.05 && dayDiff(txn.date, receipt.date) <= 1) {
                matches.push({
                    bankTxn: txn,
                    emailReceipt: receipt,
                    matchScore: 0.8,
                    matchType: 'fuzzy_amount_date',
                    enrichment: {
                        hasLineItems: !!(receipt.lineItems && receipt.lineItems.length > 0),
                        hasOrderId: !!receipt.orderId,
                        itemCount: receipt.lineItems?.length || 0,
                    },
                });
                usedBankIds.add(bi);
                usedEmailIds.add(ei);
                break;
            }
        }
    }

    // Pass 3: Amount match only (date might be off due to processing delay)
    for (let ei = 0; ei < emailReceipts.length; ei++) {
        if (usedEmailIds.has(ei)) continue;
        const receipt = emailReceipts[ei];

        for (let bi = 0; bi < bankTxns.length; bi++) {
            if (usedBankIds.has(bi)) continue;
            const txn = bankTxns[bi];
            if (txn.type !== 'debit') continue;

            if (Math.abs(txn.amount - receipt.amount) < 1 && dayDiff(txn.date, receipt.date) <= 3) {
                const sim = merchantSimilarity(txn.merchant, receipt.merchantName);
                if (sim > 0.3) {
                    matches.push({
                        bankTxn: txn,
                        emailReceipt: receipt,
                        matchScore: 0.5 + sim * 0.3,
                        matchType: 'amount_only',
                        enrichment: {
                            hasLineItems: !!(receipt.lineItems && receipt.lineItems.length > 0),
                            hasOrderId: !!receipt.orderId,
                            itemCount: receipt.lineItems?.length || 0,
                        },
                    });
                    usedBankIds.add(bi);
                    usedEmailIds.add(ei);
                    break;
                }
            }
        }
    }

    const unmatchedBank = bankTxns.filter((_, i) => !usedBankIds.has(i));
    const unmatchedEmail = emailReceipts.filter((_, i) => !usedEmailIds.has(i));

    return { matches, unmatchedBank, unmatchedEmail };
}

// ── Formatting ──────────────────────────────────────────────────────────────

function fmt(n: number): string {
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

function bar(value: number, max: number, width = 20): string {
    const filled = Math.round((value / Math.max(max, 1)) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║   EXPERIMENT 3: Cross-Source Reconciliation — Bank Stmts + Emails      ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

    // ── Load Data ──
    console.log('  Loading data sources...\n');
    const bankTxns = loadBankTxns();
    const emailReceipts = loadEmailReceipts();

    if (bankTxns.length === 0) {
        console.log('\n  No bank transactions found. Run parse-sbi-statements.ts and parse-kotak-statements.ts first.');
        return;
    }

    // Filter to Jan 2026 for focused analysis
    const targetMonth = '2026-01';
    const janBankTxns = bankTxns.filter(t => monthKey(t.date) === targetMonth);
    const janEmailReceipts = emailReceipts.filter(r => monthKey(r.date) === targetMonth);

    console.log(`\n  Focus period: January 2026`);
    console.log(`  Bank transactions:  ${janBankTxns.length} (${janBankTxns.filter(t => t.type === 'debit').length} debits, ${janBankTxns.filter(t => t.type === 'credit').length} credits)`);
    console.log(`  Email receipts:     ${janEmailReceipts.length}`);

    // ── Overview ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  1. DATA OVERVIEW                                                   │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const totalBankDebit = janBankTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const totalBankCredit = janBankTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalEmailAmount = janEmailReceipts.reduce((s, r) => s + r.amount, 0);

    const internalCategories = new Set([
        'Sweep/FD (Internal)', 'UPI Lite Top-up', 'Self Transfer',
        'Family Transfers', 'Person Transfers', 'Refund', 'Interest Earned',
    ]);
    const realSpendTxns = janBankTxns.filter(t => t.type === 'debit' && !internalCategories.has(t.category));
    const totalRealSpend = realSpendTxns.reduce((s, t) => s + t.amount, 0);

    console.log(`  Bank — Total Out:     ${fmt(totalBankDebit)}`);
    console.log(`  Bank — Total In:      ${fmt(totalBankCredit)}`);
    console.log(`  Bank — Real Spending: ${fmt(totalRealSpend)} (excl. transfers, sweeps)`);
    console.log(`  Email — Total Amount: ${fmt(totalEmailAmount)}`);

    // By category
    const catSpend = new Map<string, { amount: number; count: number }>();
    for (const t of janBankTxns.filter(t => t.type === 'debit')) {
        const e = catSpend.get(t.category) || { amount: 0, count: 0 };
        e.amount += t.amount;
        e.count++;
        catSpend.set(t.category, e);
    }

    console.log(`\n  Bank spending by category (Jan 2026):`);
    const sortedCats = [...catSpend.entries()].sort((a, b) => b[1].amount - a[1].amount);
    const maxCat = sortedCats[0]?.[1].amount || 1;
    for (const [cat, data] of sortedCats) {
        console.log(`    ${cat.padEnd(25)} ${fmt(data.amount).padStart(12)} (${String(data.count).padStart(3)} txns)  ${bar(data.amount, maxCat)}`);
    }

    // ── Matching ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  2. RECONCILIATION RESULTS                                          │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    if (janEmailReceipts.length === 0) {
        console.log('  No email receipts available for matching.');
        console.log('  Run experiment-template-gen.ts first, then re-run this experiment.');
        console.log('\n  Proceeding with UPI Lite analysis using bank data only...\n');
    } else {
        const { matches, unmatchedBank, unmatchedEmail } = matchTransactions(janBankTxns, janEmailReceipts);

        console.log(`  Total matches found: ${matches.length}`);
        console.log(`  Unmatched bank txns: ${unmatchedBank.length}`);
        console.log(`  Unmatched email receipts: ${unmatchedEmail.length}`);

        const matchByType = {
            exact: matches.filter(m => m.matchType === 'exact_amount_date'),
            fuzzy: matches.filter(m => m.matchType === 'fuzzy_amount_date'),
            amount: matches.filter(m => m.matchType === 'amount_only'),
            merchant: matches.filter(m => m.matchType === 'merchant_date'),
        };

        console.log(`\n  Match quality:`);
        console.log(`    Exact (amount + date):     ${matchByType.exact.length}`);
        console.log(`    Fuzzy (amount ~5%, ±1 day): ${matchByType.fuzzy.length}`);
        console.log(`    Amount only (±3 days):      ${matchByType.amount.length}`);

        // Enrichment stats
        const withLineItems = matches.filter(m => m.enrichment.hasLineItems).length;
        const withOrderId = matches.filter(m => m.enrichment.hasOrderId).length;
        const totalItems = matches.reduce((s, m) => s + m.enrichment.itemCount, 0);

        console.log(`\n  Enrichment from email receipts:`);
        console.log(`    Txns with line items: ${withLineItems}/${matches.length} (${((withLineItems / Math.max(matches.length, 1)) * 100).toFixed(0)}%)`);
        console.log(`    Txns with order ID:   ${withOrderId}/${matches.length}`);
        console.log(`    Total items extracted: ${totalItems}`);

        // Show matched transactions
        if (matches.length > 0) {
            console.log(`\n  ${'Bank Description'.padEnd(35)} ${'Amount'.padStart(10)} ${'Email Sender'.padEnd(15)} ${'Match'.padEnd(15)} ${'Items'.padStart(5)}`);
            console.log(`  ${'─'.repeat(85)}`);
            for (const m of matches) {
                console.log(
                    `  ${m.bankTxn.description.substring(0, 35).padEnd(35)} ` +
                    `${fmt(m.bankTxn.amount).padStart(10)} ` +
                    `${m.emailReceipt.senderName.padEnd(15)} ` +
                    `${m.matchType.padEnd(15)} ` +
                    `${String(m.enrichment.itemCount).padStart(5)}`,
                );
            }
        }

        // Unmatched email receipts → likely UPI Lite or off-statement spending
        if (unmatchedEmail.length > 0) {
            console.log(`\n  Unmatched email receipts (not in bank statements):`);
            for (const r of unmatchedEmail) {
                console.log(`    ${r.senderName.padEnd(15)} ${fmt(r.amount).padStart(10)} ${r.dateStr.padEnd(12)} "${r.orderId || 'no-id'}"`);
            }
            const unmatchedTotal = unmatchedEmail.reduce((s, r) => s + r.amount, 0);
            console.log(`    Total unmatched: ${fmt(unmatchedTotal)} (potential UPI Lite / wallet spending)`);
        }

        // Match rate
        const debitTxns = janBankTxns.filter(t => t.type === 'debit');
        const matchRate = (matches.length / Math.max(debitTxns.length, 1)) * 100;
        const matchedAmount = matches.reduce((s, m) => s + m.bankTxn.amount, 0);
        const amountCoverage = (matchedAmount / Math.max(totalBankDebit, 1)) * 100;

        console.log(`\n  Match rate: ${matchRate.toFixed(1)}% of bank debits matched with email receipts`);
        console.log(`  Amount coverage: ${fmt(matchedAmount)} / ${fmt(totalBankDebit)} = ${amountCoverage.toFixed(1)}%`);
    }

    // ── UPI Lite Analysis ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  3. UPI LITE — THE BLACK HOLE                                       │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    const upiLiteTxns = janBankTxns.filter(t => t.category === 'UPI Lite Top-up');
    const upiLiteTotal = upiLiteTxns.reduce((s, t) => s + t.amount, 0);
    const upiLiteCount = upiLiteTxns.length;

    console.log(`  UPI Lite top-ups in Jan 2026: ${upiLiteCount}`);
    console.log(`  Total topped up:              ${fmt(upiLiteTotal)}`);
    console.log(`  Average top-up:               ${fmt(upiLiteTotal / Math.max(upiLiteCount, 1))}`);

    if (upiLiteTxns.length > 0) {
        console.log(`\n  Top-up transactions:`);
        for (const t of upiLiteTxns) {
            console.log(`    ${dateKey(t.date)} ${t.bank.padEnd(6)} ${fmt(t.amount).padStart(10)} ${t.description.substring(0, 40)}`);
        }
    }

    console.log(`\n  This ${fmt(upiLiteTotal)} in UPI Lite spending is completely invisible in bank statements.`);
    console.log(`  It shows up only as top-up transactions, not as individual purchases.`);
    console.log(`  Email receipts from Swiggy, Uber, etc. are the ONLY way to see where this money went.`);

    // ── Spending Visibility Analysis ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  4. SPENDING VISIBILITY — What Bank Statements Miss                 │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    // Categories where bank description is vague
    const vagueCategories = ['UPI Lite Top-up', 'Other', 'Person Transfers'];
    const vagueTxns = janBankTxns.filter(t => t.type === 'debit' && vagueCategories.includes(t.category));
    const vagueTotal = vagueTxns.reduce((s, t) => s + t.amount, 0);

    // Categories where bank description has merchant but no line items
    const merchantOnlyCategories = ['Food & Dining', 'Shopping', 'Groceries & Health', 'Transport'];
    const merchantOnlyTxns = janBankTxns.filter(t => t.type === 'debit' && merchantOnlyCategories.includes(t.category));
    const merchantOnlyTotal = merchantOnlyTxns.reduce((s, t) => s + t.amount, 0);

    console.log(`  Spending with vague/no description:   ${fmt(vagueTotal)} (${vagueTxns.length} txns)`);
    console.log(`    Includes: UPI Lite, Other, Person Transfers`);
    console.log(`    Email receipts would reveal: actual merchants, items, prices`);
    console.log();
    console.log(`  Spending with merchant but no details: ${fmt(merchantOnlyTotal)} (${merchantOnlyTxns.length} txns)`);
    console.log(`    Includes: Food & Dining, Shopping, Groceries, Transport`);
    console.log(`    Email receipts would add: line items, order IDs, exact merchants`);
    console.log();
    console.log(`  Total enrichable spending: ${fmt(vagueTotal + merchantOnlyTotal)} = ${(((vagueTotal + merchantOnlyTotal) / Math.max(totalRealSpend, 1)) * 100).toFixed(0)}% of real spending`);

    // ── Key Insights ──
    console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
    console.log('│  5. KEY INSIGHTS                                                    │');
    console.log('└──────────────────────────────────────────────────────────────────────┘\n');

    console.log(`  1. UPI Lite is a ${fmt(upiLiteTotal)}/month black hole — only email receipts illuminate it`);
    console.log(`  2. ${(((vagueTotal + merchantOnlyTotal) / Math.max(totalRealSpend, 1)) * 100).toFixed(0)}% of spending can be enriched with email receipt data`);
    console.log(`  3. Bank statements know WHO you paid, emails know WHAT you bought`);
    console.log(`  4. Combined view: bank txn (amount, date, channel) + email (items, prices, order ID)`);

    if (emailReceipts.length > 0) {
        const withItems = emailReceipts.filter(r => r.lineItems && r.lineItems.length > 0).length;
        console.log(`  5. ${withItems}/${emailReceipts.length} email receipts contain line items — granular spending data`);
    }

    // ── Save Results ──
    const output = {
        period: targetMonth,
        bankSummary: {
            totalTransactions: janBankTxns.length,
            totalDebits: janBankTxns.filter(t => t.type === 'debit').length,
            totalDebitAmount: totalBankDebit,
            totalCredits: janBankTxns.filter(t => t.type === 'credit').length,
            totalCreditAmount: totalBankCredit,
            realSpending: totalRealSpend,
        },
        emailSummary: {
            totalReceipts: janEmailReceipts.length,
            totalAmount: totalEmailAmount,
            bySender: [...new Set(janEmailReceipts.map(r => r.senderId))].map(sid => ({
                senderId: sid,
                count: janEmailReceipts.filter(r => r.senderId === sid).length,
                totalAmount: janEmailReceipts.filter(r => r.senderId === sid).reduce((s, r) => s + r.amount, 0),
            })),
        },
        upiLite: {
            topUpCount: upiLiteCount,
            topUpTotal: upiLiteTotal,
            note: 'This spending is invisible in bank statements. Only visible via email receipts.',
        },
        visibility: {
            vagueSpending: vagueTotal,
            merchantOnlySpending: merchantOnlyTotal,
            enrichableSpending: vagueTotal + merchantOnlyTotal,
            enrichablePct: ((vagueTotal + merchantOnlyTotal) / Math.max(totalRealSpend, 1)) * 100,
        },
    };

    const outputPath = path.join(DOWNLOADS_DIR, 'experiment-reconciliation.json');
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n  Results saved: ${outputPath}`);
}

main().catch(console.error);
