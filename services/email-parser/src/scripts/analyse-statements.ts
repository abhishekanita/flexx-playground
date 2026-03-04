import * as fs from 'fs';
import * as path from 'path';

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// ── Load Data ───────────────────────────────────────────────────────────────

const sbiStatements = JSON.parse(fs.readFileSync(path.join(DOWNLOADS_DIR, 'sbi-statements-parsed.json'), 'utf-8'));
const kotakStatements = JSON.parse(fs.readFileSync(path.join(DOWNLOADS_DIR, 'kotak-statements-parsed.json'), 'utf-8'));

// ── Normalize dates to comparable format ────────────────────────────────────

function parseDate(dateStr: string): Date {
    // SBI: "DD-MM-YY" e.g. "01-12-25"
    const sbiMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{2})$/);
    if (sbiMatch) {
        const year = parseInt(sbiMatch[3]) + 2000;
        return new Date(year, parseInt(sbiMatch[2]) - 1, parseInt(sbiMatch[1]));
    }
    // Kotak bank.in: "DD Mon YYYY" e.g. "01 Feb 2026"
    const kotakNewMatch = dateStr.match(/^(\d{2})\s+(\w{3})\s+(\d{4})$/);
    if (kotakNewMatch) {
        return new Date(`${kotakNewMatch[1]} ${kotakNewMatch[2]} ${kotakNewMatch[3]}`);
    }
    // Kotak kotak.com: "DD Mon, YYYY" e.g. "02 Nov, 2025"
    const kotakOldMatch = dateStr.match(/^(\d{2})\s+(\w{3}),\s+(\d{4})$/);
    if (kotakOldMatch) {
        return new Date(`${kotakOldMatch[1]} ${kotakOldMatch[2]} ${kotakOldMatch[3]}`);
    }
    return new Date(dateStr);
}

function monthKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

// ── Unified Transaction Type ────────────────────────────────────────────────

interface Txn {
    date: Date;
    month: string;
    bank: string;
    description: string;
    type: 'debit' | 'credit';
    amount: number;
    balance: number;
    channel: string;
    merchant: string;
    category: string;
}

// ── Better categorization ───────────────────────────────────────────────────

function recategorize(desc: string, merchant: string, amount: number, type: string): string {
    const d = (desc + ' ' + merchant).toLowerCase();

    // Self transfers / Sweep (exclude from spending analysis)
    if (d.includes('sweep') || d.includes('fd premat') || d.includes('fd maturity'))
        return 'Sweep/FD (Internal)';
    if (d.includes('upilite') && type === 'debit' && amount === 2000)
        return 'UPI Lite Top-up';

    // Person-to-person transfers (identify by name patterns)
    if (d.match(/upi\/.*(abhishek|aggar)/i) && type === 'debit')
        return 'Self Transfer';
    if (d.match(/upi\/.*(abhishek|aggar)/i) && type === 'credit')
        return 'Self Transfer';

    // Rent
    if (d.includes('rent') || d.includes('harsh kumar cho'))
        return 'Rent';

    // Food & Dining
    if (d.includes('swiggy') || d.includes('zomato') || d.includes('bistro') ||
        d.includes('kfc') || d.includes('yum yum') || d.includes('choudhary sweet') ||
        d.includes('daalchini') || d.includes('biryani') || d.includes('food') ||
        d.includes('restaurant') || d.includes('cafe') || d.includes('tiffin') ||
        d.includes('a k tiffins'))
        return 'Food & Dining';

    // Groceries
    if (d.includes('blinkit') || d.includes('bigbasket') || d.includes('1mg') ||
        d.includes('tata 1mg') || d.includes('grofers') || d.includes('zepto'))
        return 'Groceries & Health';

    // Subscriptions
    if (d.includes('netflix') || d.includes('spotify') || d.includes('apple') ||
        d.includes('youtube') || d.includes('hotstar') || d.includes('google') ||
        d.includes('eleven labs') || d.includes('airblack') || d.includes('mandateexecute'))
        return 'Subscriptions';

    // Bills & Recharges
    if (d.includes('airtel') || d.includes('jio') || d.includes('vodafone') ||
        d.includes('recharge') || d.includes('prepaid') || d.includes('bill'))
        return 'Bills & Recharges';

    // Shopping
    if (d.includes('amazon') || d.includes('flipkart') || d.includes('myntra') ||
        d.includes('ajio') || d.includes('nykaa') || d.includes('meesho'))
        return 'Shopping';

    // Transport
    if (d.includes('uber') || d.includes('ola') || d.includes('rapido') || d.includes('metro'))
        return 'Transport';

    // Travel
    if (d.includes('makemy') || d.includes('make my') || d.includes('irctc') ||
        d.includes('flight') || d.includes('hotel') || d.includes('booking') ||
        d.includes('bookmyshow'))
        return 'Travel & Entertainment';

    // Insurance / EMI / Investments
    if (d.includes('nach') || d.includes('groww') || d.includes('clearing corp') ||
        d.includes('indian clearing'))
        return 'EMI / SIP / Insurance';

    // Bank charges
    if (d.includes('chrg') || d.includes('charge') || d.includes('fee') || d.includes('gst') ||
        d.includes('debit card') || d.includes('image debit'))
        return 'Bank Charges';

    // Services
    if (d.includes('urban') || d.includes('urbanclap') || d.includes('clove') ||
        d.includes('apify') || d.includes('payprogloba') || d.includes('aws'))
        return 'Services & Software';

    // NEFT/CLG (cheque clearing - family/regular transfers)
    if (d.includes('clg to') || d.includes('neft') || d.includes('surbhi') ||
        d.includes('karan kalra'))
        return 'Family Transfers';

    // Other person transfers
    if (d.match(/upi\/[a-z]/i) && (type === 'debit' || type === 'credit'))
        return 'Person Transfers';

    // Refund
    if (d.includes('refund') || d.includes('rev-upi') || d.includes('reversal'))
        return 'Refund';

    // Interest
    if (d.includes('interest') || d.includes('int.pd'))
        return 'Interest Earned';

    return 'Other';
}

// ── Build unified transaction list ──────────────────────────────────────────

const allTxns: Txn[] = [];

for (const stmt of sbiStatements) {
    for (const t of stmt.transactions) {
        const date = parseDate(t.date);
        allTxns.push({
            date,
            month: monthKey(date),
            bank: 'SBI',
            description: t.description,
            type: t.type,
            amount: t.amount,
            balance: t.balance,
            channel: t.channel,
            merchant: t.merchant,
            category: recategorize(t.description, t.merchant, t.amount, t.type),
        });
    }
}

for (const stmt of kotakStatements) {
    for (const t of stmt.transactions) {
        const date = parseDate(t.date);
        allTxns.push({
            date,
            month: monthKey(date),
            bank: 'KOTAK',
            description: t.description,
            type: t.type,
            amount: t.amount,
            balance: t.balance,
            channel: t.channel,
            merchant: t.merchant,
            category: recategorize(t.description, t.merchant, t.amount, t.type),
        });
    }
}

// Sort by date
allTxns.sort((a, b) => a.date.getTime() - b.date.getTime());

// ── Filter last 3 months (Dec 2025, Jan 2026, Feb 2026) ────────────────────

const targetMonths = ['2025-12', '2026-01', '2026-02'];
const recentTxns = allTxns.filter(t => targetMonths.includes(t.month));

// Categories to exclude from "real spending" analysis
const internalCategories = new Set([
    'Sweep/FD (Internal)', 'UPI Lite Top-up', 'Self Transfer',
    'Family Transfers', 'Person Transfers', 'Refund', 'Interest Earned',
]);

const spendingTxns = recentTxns.filter(
    t => t.type === 'debit' && !internalCategories.has(t.category),
);

const incomeTxns = recentTxns.filter(
    t => t.type === 'credit' && !internalCategories.has(t.category),
);

// ── Analysis ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
    return '₹' + Math.round(n).toLocaleString('en-IN');
}

function bar(value: number, max: number, width = 30): string {
    const filled = Math.round((value / max) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║          FINANCIAL ANALYSIS — Last 3 Months (Dec 25 - Feb 26)          ║
║                    SBI + Kotak Combined View                           ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

// ── 1. Monthly Overview ─────────────────────────────────────────────────────

console.log('┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  1. MONTHLY MONEY FLOW                                              │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

for (const month of targetMonths) {
    const mTxns = recentTxns.filter(t => t.month === month);
    const totalDebit = mTxns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const totalCredit = mTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

    const realSpend = mTxns
        .filter(t => t.type === 'debit' && !internalCategories.has(t.category))
        .reduce((s, t) => s + t.amount, 0);

    const sbiDebits = mTxns.filter(t => t.type === 'debit' && t.bank === 'SBI').reduce((s, t) => s + t.amount, 0);
    const kotakDebits = mTxns.filter(t => t.type === 'debit' && t.bank === 'KOTAK').reduce((s, t) => s + t.amount, 0);

    console.log(`  ${monthLabel(month)}`);
    console.log(`    Total Out:      ${fmt(totalDebit).padStart(12)}    (SBI: ${fmt(sbiDebits)}, Kotak: ${fmt(kotakDebits)})`);
    console.log(`    Total In:       ${fmt(totalCredit).padStart(12)}`);
    console.log(`    Real Spending:  ${fmt(realSpend).padStart(12)}    (excl. transfers, sweeps, UPI Lite)`);
    console.log(`    Txn Count:      ${String(mTxns.length).padStart(12)}`);
    console.log();
}

// ── 2. Spending by Category ─────────────────────────────────────────────────

console.log('┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  2. WHERE YOUR MONEY GOES (Real Spending Only)                      │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

const catTotals = new Map<string, { total: number; count: number; monthly: Map<string, number> }>();

for (const t of spendingTxns) {
    const existing = catTotals.get(t.category) || { total: 0, count: 0, monthly: new Map() };
    existing.total += t.amount;
    existing.count++;
    existing.monthly.set(t.month, (existing.monthly.get(t.month) || 0) + t.amount);
    catTotals.set(t.category, existing);
}

const sortedCats = [...catTotals.entries()].sort((a, b) => b[1].total - a[1].total);
const maxCatTotal = sortedCats[0]?.[1].total || 1;
const totalSpending = sortedCats.reduce((s, [, v]) => s + v.total, 0);

console.log(`  ${'Category'.padEnd(25)} ${'3-Mo Total'.padStart(12)} ${'Avg/Mo'.padStart(10)} ${'%'.padStart(5)}  Visual`);
console.log(`  ${'─'.repeat(85)}`);

for (const [cat, data] of sortedCats) {
    const pct = ((data.total / totalSpending) * 100).toFixed(1);
    const avg = data.total / 3;
    console.log(
        `  ${cat.padEnd(25)} ${fmt(data.total).padStart(12)} ${fmt(avg).padStart(10)} ${pct.padStart(5)}% ${bar(data.total, maxCatTotal, 20)}`,
    );
}

console.log(`\n  ${'TOTAL'.padEnd(25)} ${fmt(totalSpending).padStart(12)} ${fmt(totalSpending / 3).padStart(10)}`);

// ── 3. Month-over-month by category ────────────────────────────────────────

console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  3. MONTH-OVER-MONTH SPENDING TREND                                │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

console.log(`  ${'Category'.padEnd(25)} ${'Dec 25'.padStart(10)} ${'Jan 26'.padStart(10)} ${'Feb 26'.padStart(10)}  Trend`);
console.log(`  ${'─'.repeat(70)}`);

for (const [cat, data] of sortedCats.slice(0, 10)) {
    const dec = data.monthly.get('2025-12') || 0;
    const jan = data.monthly.get('2026-01') || 0;
    const feb = data.monthly.get('2026-02') || 0;

    let trend = '';
    if (feb > jan && jan > dec) trend = '📈 Rising';
    else if (feb < jan && jan < dec) trend = '📉 Falling';
    else if (feb > jan) trend = '↗ Up';
    else if (feb < jan) trend = '↘ Down';
    else trend = '→ Flat';

    console.log(
        `  ${cat.padEnd(25)} ${fmt(dec).padStart(10)} ${fmt(jan).padStart(10)} ${fmt(feb).padStart(10)}  ${trend}`,
    );
}

// ── 4. Top merchants ────────────────────────────────────────────────────────

console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  4. TOP MERCHANTS / PAYEES                                          │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

const merchantTotals = new Map<string, { total: number; count: number; category: string }>();

for (const t of spendingTxns) {
    // Normalize merchant names
    let name = t.merchant
        .replace(/UPI\//, '')
        .replace(/\/.*/, '')  // take first part of UPI description
        .replace(/\d{5,}/g, '')
        .trim();

    if (name.length < 2) name = t.description.substring(0, 30);
    name = name.substring(0, 25);

    const existing = merchantTotals.get(name) || { total: 0, count: 0, category: t.category };
    existing.total += t.amount;
    existing.count++;
    merchantTotals.set(name, existing);
}

const sortedMerchants = [...merchantTotals.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 15);

console.log(`  ${'Merchant'.padEnd(28)} ${'Total'.padStart(12)} ${'Count'.padStart(6)} ${'Avg'.padStart(10)} ${'Category'.padEnd(20)}`);
console.log(`  ${'─'.repeat(80)}`);

for (const [name, data] of sortedMerchants) {
    console.log(
        `  ${name.padEnd(28)} ${fmt(data.total).padStart(12)} ${String(data.count).padStart(6)} ${fmt(data.total / data.count).padStart(10)} ${data.category.padEnd(20)}`,
    );
}

// ── 5. Recurring payments detection ─────────────────────────────────────────

console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  5. RECURRING / SUBSCRIPTION PAYMENTS DETECTED                      │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

// Find debits that appear in 2+ months with similar amounts
const recurringCandidates = new Map<string, { amounts: number[]; months: Set<string>; dates: string[] }>();

for (const t of recentTxns.filter(t => t.type === 'debit')) {
    const d = t.description.toLowerCase();
    let key = '';

    if (d.includes('netflix')) key = 'Netflix';
    else if (d.includes('apple') && d.includes('execu')) key = 'Apple (iCloud/Services)';
    else if (d.includes('apple') && d.includes('mandat')) key = 'Apple Mandate';
    else if (d.includes('nach') || d.includes('clearing corp') || d.includes('groww')) key = 'NACH/SIP (Groww)';
    else if (d.includes('airtel') && (d.includes('prepaid') || d.includes('bil'))) key = 'Airtel Recharge';
    else if (d.includes('debit card')) key = 'Debit Card Fee';
    else if (d.includes('google') && d.includes('mandate')) key = 'Google Subscription';
    else continue;

    const existing = recurringCandidates.get(key) || { amounts: [], months: new Set(), dates: [] };
    existing.amounts.push(t.amount);
    existing.months.add(t.month);
    existing.dates.push(`${t.date} (${t.bank})`);
    recurringCandidates.set(key, existing);
}

for (const [name, data] of recurringCandidates) {
    const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    const monthCount = data.months.size;
    console.log(`  ${name.padEnd(28)} ${fmt(avg).padStart(10)}/mo   Seen in ${monthCount}/3 months`);
    for (const d of data.dates) {
        console.log(`    └ ${d}`);
    }
    console.log();
}

// ── 6. Large transactions ───────────────────────────────────────────────────

console.log('┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  6. LARGE TRANSACTIONS (> ₹5,000)                                  │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

const largeTxns = recentTxns
    .filter(t => t.amount >= 5000 && !internalCategories.has(t.category))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

console.log(`  ${'Date'.padEnd(14)} ${'Bank'.padEnd(6)} ${'Type'.padEnd(7)} ${'Amount'.padStart(12)} ${'Description'.padEnd(40)}`);
console.log(`  ${'─'.repeat(85)}`);

for (const t of largeTxns) {
    const dateStr = t.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
    console.log(
        `  ${dateStr.padEnd(14)} ${t.bank.padEnd(6)} ${t.type.padEnd(7)} ${fmt(t.amount).padStart(12)} ${t.description.substring(0, 40).padEnd(40)}`,
    );
}

// ── 7. Daily spending pattern ───────────────────────────────────────────────

console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  7. SPENDING BY DAY OF WEEK                                         │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayTotals = new Array(7).fill(0);
const dayCounts = new Array(7).fill(0);

for (const t of spendingTxns) {
    const day = t.date.getDay();
    dayTotals[day] += t.amount;
    dayCounts[day]++;
}

const maxDayTotal = Math.max(...dayTotals);

for (let i = 0; i < 7; i++) {
    const avg = dayCounts[i] > 0 ? dayTotals[i] / 13 : 0; // ~13 weeks in 3 months
    console.log(
        `  ${dayNames[i].padEnd(12)} ${fmt(dayTotals[i]).padStart(12)} total  ${fmt(avg).padStart(10)}/wk  ${bar(dayTotals[i], maxDayTotal, 25)}`,
    );
}

// ── 8. Bank-wise balance trend ──────────────────────────────────────────────

console.log('\n┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  8. ACCOUNT BALANCE SNAPSHOT (End of Month)                         │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

for (const month of targetMonths) {
    const sbiStmt = sbiStatements.find((s: any) => {
        const m = monthKey(parseDate(s.transactions?.[0]?.date || '01-01-25'));
        return m === month;
    });
    const kotakStmt = kotakStatements.find((s: any) => {
        const firstTxn = s.transactions?.[0];
        if (!firstTxn) return false;
        const m = monthKey(parseDate(firstTxn.date));
        return m === month;
    });

    const sbiClosing = sbiStmt?.closingBalance || 0;
    const kotakClosing = kotakStmt?.closingBalance || 0;

    console.log(`  ${monthLabel(month)}`);
    console.log(`    SBI:      ${fmt(sbiClosing).padStart(12)}`);
    console.log(`    Kotak:    ${fmt(kotakClosing).padStart(12)}`);
    console.log(`    Combined: ${fmt(sbiClosing + kotakClosing).padStart(12)}`);
    console.log();
}

// ── 9. Key Insights ─────────────────────────────────────────────────────────

console.log('┌──────────────────────────────────────────────────────────────────────┐');
console.log('│  9. KEY INSIGHTS                                                    │');
console.log('└──────────────────────────────────────────────────────────────────────┘\n');

const avgMonthlySpend = totalSpending / 3;
const foodSpend = catTotals.get('Food & Dining')?.total || 0;
const subsSpend = catTotals.get('Subscriptions')?.total || 0;
const billsSpend = catTotals.get('Bills & Recharges')?.total || 0;
const emiSpend = catTotals.get('EMI / SIP / Insurance')?.total || 0;
const servicesSpend = catTotals.get('Services & Software')?.total || 0;

const insights = [
    `Your average monthly spending (excluding transfers) is ${fmt(avgMonthlySpend)}`,
    `Food & Dining is your #1 spending category at ${fmt(foodSpend)} over 3 months (${fmt(foodSpend / 3)}/month)`,
    foodSpend / totalSpending > 0.3
        ? `⚠️  Food spending is ${((foodSpend / totalSpending) * 100).toFixed(0)}% of total — consider meal planning`
        : null,
    subsSpend > 0 ? `Subscriptions: ${fmt(subsSpend / 3)}/month (Netflix, Apple, etc.)` : null,
    emiSpend > 0 ? `EMI/SIP deductions: ${fmt(emiSpend / 3)}/month via NACH` : null,
    billsSpend > 0 ? `Bills & Recharges: ${fmt(billsSpend / 3)}/month` : null,
    servicesSpend > 0 ? `Services & Software: ${fmt(servicesSpend / 3)}/month (Apify, AWS, etc.)` : null,
    `You use UPI for ${recentTxns.filter(t => t.channel === 'UPI').length} out of ${recentTxns.length} transactions (${((recentTxns.filter(t => t.channel === 'UPI').length / recentTxns.length) * 100).toFixed(0)}%)`,
    `SBI is your primary spending account, Kotak is used mainly for transfers & receiving money`,
];

for (const insight of insights.filter(Boolean)) {
    console.log(`  • ${insight}`);
}

console.log('\n');
