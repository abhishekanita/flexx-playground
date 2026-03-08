import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { TransactionModel } from '@/schema/transaction.schema';
import { TransactionSignalModel } from '@/schema/transaction-signal.schema';
import { TransactionFolderModel } from '@/schema/transaction-folder.schema';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORY_COLORS: Record<string, string> = {
    food_delivery: '#FF6B35',
    cab_ride: '#0984E3',
    groceries: '#00B894',
    subscription: '#6C5CE7',
    ecommerce: '#E17055',
    flight: '#D63031',
    emi: '#636E72',
    restaurant: '#FDCB6E',
    ott: '#A29BFE',
    mobile_recharge: '#55EFC4',
    investment: '#00CEC9',
    transfer: '#74B9FF',
    train: '#FAB1A0',
    hotel: '#FF7675',
    rent: '#DFE6E9',
    atm_withdrawal: '#B2BEC3',
    pharmacy: '#81ECEC',
    salary: '#2ECC71',
    broadband: '#E056A0',
    electricity: '#F1C40F',
    insurance: '#8E44AD',
    unknown: '#B0B0A8',
    other: '#95A5A6',
};

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatMonth(key: string): string {
    const [y, m] = key.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${y}`;
}

interface MonthData {
    key: string; // "2025-03"
    label: string; // "Mar 2025"
    totalDebit: number;
    totalCredit: number;
    totalSpending?: number;
    totalTransfers?: number;
    netFlow: number;
    txnCount: number;
    debitCount: number;
    creditCount: number;
    spendingCount?: number;
    avgOrderValue: number;
    medianOrderValue: number;
    categoryBreakdown: { label: string; slug: string; color: string; amount: number; count: number; pct: number }[];
    dailyTimeline: { date: string; debit: number; credit: number; count: number }[];
    transactions: {
        date: string;
        amount: number;
        type: string;
        channel: string;
        category: string;
        merchant: string;
        narration: string;
        account: string;
        signals: number;
        enrichmentScore: number;
    }[];
    sourceBreakdown: { source: string; debit: number; credit: number; count: number }[];
    topMerchants: { name: string; amount: number; count: number }[];
}

// Categories that are not "spending" — exclude from spending analysis
const NON_SPENDING = new Set(['transfer', 'atm_withdrawal', 'investment', 'salary', 'credit_card_bill', 'rent']);

function isSpending(t: any): boolean {
    return t.type === 'debit' && !NON_SPENDING.has(t.category || 'unknown');
}

(async () => {
    await databaseLoader();

    const cutoffDate = new Date('2020-01-01');
    const allTxns = await TransactionModel.find({
        tx_date: { $gte: cutoffDate },
        amount: { $gt: 0, $lt: 500000 },
    }).sort({ tx_date: -1 }).lean();

    if (allTxns.length === 0) {
        console.log('No transactions found');
        process.exit(1);
    }

    // Group by month
    const monthMap: Record<string, typeof allTxns> = {};
    for (const t of allTxns) {
        const d = new Date(t.tx_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = [];
        monthMap[key].push(t);
    }
    const monthKeys = Object.keys(monthMap).sort().reverse();

    // Determine source label from account_last4 + channel
    function getSourceLabel(t: any): string {
        const acct = t.account_last4;
        const channel = t.channel || 'UNKNOWN';

        // UPI Lite — off-bank wallet spends
        if (channel === 'UPI_LITE') return 'PhonePe UPI Lite';

        // Bank accounts
        if (acct === '4051') return 'SBI A/c 4051';
        if (acct === '9778') return 'Kotak A/c 9778';
        if (acct === '7214') return 'SBI A/c 7214';
        if (channel === 'NACH') return 'Auto-Debit (NACH)';

        // UPI app context
        const ctx = t.context as any;
        if (ctx?.phonepe) return 'PhonePe Wallet';
        if (ctx?.paytm) return 'Paytm Wallet';
        if (t.upi_app === 'PhonePe') return 'PhonePe UPI';
        if (t.upi_app === 'Paytm') return 'Paytm UPI';
        if (t.upi_app === 'GooglePay') return 'Google Pay';

        if (acct) return `Account ${acct}`;

        // No account — email invoice sourced transactions
        return 'Email Invoices';
    }

    function buildMonthData(key: string, txns: typeof allTxns): MonthData {
        const debits = txns.filter(t => t.type === 'debit');
        const credits = txns.filter(t => t.type === 'credit');
        const totalDebit = debits.reduce((s, t) => s + t.amount, 0);
        const totalCredit = credits.reduce((s, t) => s + t.amount, 0);
        const debitAmounts = debits.map(t => t.amount);

        // Category breakdown (debit only)
        const catMap: Record<string, { amount: number; count: number }> = {};
        for (const t of debits) {
            const cat = t.category || 'unknown';
            if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
            catMap[cat].amount += t.amount;
            catMap[cat].count++;
        }
        const categoryBreakdown = Object.entries(catMap)
            .map(([slug, v]) => ({
                label: slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                slug,
                color: CATEGORY_COLORS[slug] || '#95A5A6',
                amount: Math.round(v.amount * 100) / 100,
                count: v.count,
                pct: totalDebit > 0 ? (v.amount / totalDebit) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Daily timeline
        const dailyMap: Record<string, { debit: number; credit: number; count: number }> = {};
        for (const t of txns) {
            const dateStr = new Date(t.tx_date).toISOString().slice(0, 10);
            if (!dailyMap[dateStr]) dailyMap[dateStr] = { debit: 0, credit: 0, count: 0 };
            if (t.type === 'debit') dailyMap[dateStr].debit += t.amount;
            else dailyMap[dateStr].credit += t.amount;
            dailyMap[dateStr].count++;
        }
        const dailyTimeline = Object.entries(dailyMap)
            .map(([date, v]) => ({ date, debit: Math.round(v.debit), credit: Math.round(v.credit), count: v.count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Source breakdown
        const sourceMap: Record<string, { debit: number; credit: number; count: number }> = {};
        for (const t of txns) {
            const src = getSourceLabel(t);
            if (!sourceMap[src]) sourceMap[src] = { debit: 0, credit: 0, count: 0 };
            if (t.type === 'debit') sourceMap[src].debit += t.amount;
            else sourceMap[src].credit += t.amount;
            sourceMap[src].count++;
        }
        const sourceBreakdown = Object.entries(sourceMap)
            .map(([source, v]) => ({
                source,
                debit: Math.round(v.debit),
                credit: Math.round(v.credit),
                count: v.count,
            }))
            .sort((a, b) => b.count - a.count);

        // Top merchants (spending only — exclude transfers, ATM, investments)
        const spendingDebits = debits.filter(t => isSpending(t));
        const merchMap: Record<string, { amount: number; count: number }> = {};
        for (const t of spendingDebits) {
            const name = t.merchant_name || 'Unknown';
            if (name.includes('@') || name.length > 40) continue;
            if (!merchMap[name]) merchMap[name] = { amount: 0, count: 0 };
            merchMap[name].amount += t.amount;
            merchMap[name].count++;
        }
        const topMerchants = Object.entries(merchMap)
            .filter(([name]) => name !== 'Unknown')
            .map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);

        const totalSpending = spendingDebits.reduce((s, t) => s + t.amount, 0);

        // Transaction table
        const transactions = txns.map(t => ({
            date: new Date(t.tx_date).toISOString().slice(0, 10),
            amount: t.amount,
            type: t.type || 'debit',
            channel: t.channel || 'UNKNOWN',
            category: (t.category || 'unknown').replace(/_/g, ' '),
            merchant: t.merchant_name || '',
            narration: (t.raw_narration || '').substring(0, 80),
            account: getSourceLabel(t),
            signals: t.signal_count || 1,
            enrichmentScore: t.enrichment_score || 0,
        }));

        return {
            key,
            label: formatMonth(key),
            totalDebit: Math.round(totalDebit),
            totalCredit: Math.round(totalCredit),
            totalSpending: Math.round(totalSpending),
            totalTransfers: Math.round(totalDebit - totalSpending),
            netFlow: Math.round(totalCredit - totalDebit),
            txnCount: txns.length,
            debitCount: debits.length,
            creditCount: credits.length,
            spendingCount: spendingDebits.length,
            avgOrderValue: spendingDebits.length > 0 ? Math.round(totalSpending / spendingDebits.length) : 0,
            medianOrderValue: Math.round(median(spendingDebits.map(t => t.amount))),
            categoryBreakdown,
            dailyTimeline,
            transactions,
            sourceBreakdown,
            topMerchants,
        };
    }

    const months: MonthData[] = monthKeys.map(key => buildMonthData(key, monthMap[key]));

    // Build overall aggregation
    const overallData = buildMonthData('overall', allTxns);
    overallData.key = 'overall';
    overallData.label = 'Overall';

    // ── Insights (existing logic) ──
    const debitTxns = allTxns.filter(t => t.type === 'debit');
    const spendingTxns = debitTxns.filter(t => isSpending(t));
    const totalSpent = spendingTxns.reduce((s, t) => s + t.amount, 0);
    const totalDebitAll = debitTxns.reduce((s, t) => s + t.amount, 0);
    const totalTransfers = totalDebitAll - totalSpent;
    const activeMonths = monthKeys.length;

    const catMap: Record<string, { amount: number; count: number }> = {};
    for (const t of debitTxns) {
        const cat = t.category || 'unknown';
        if (!catMap[cat]) catMap[cat] = { amount: 0, count: 0 };
        catMap[cat].amount += t.amount;
        catMap[cat].count++;
    }

    // Merchant leaderboard — spending only (excludes transfers, investments, etc.)
    const merchMap: Record<string, { amount: number; count: number }> = {};
    for (const t of spendingTxns) {
        const name = t.merchant_name || 'Unknown';
        if (name.includes('@') || name.length > 40) continue;
        if (!merchMap[name]) merchMap[name] = { amount: 0, count: 0 };
        merchMap[name].amount += t.amount;
        merchMap[name].count++;
    }
    const merchantLeaderboard = Object.entries(merchMap)
        .filter(([name]) => name !== 'Unknown')
        .map(([name, v]) => ({
            name,
            amount: Math.round(v.amount),
            count: v.count,
            pct: (v.amount / totalSpent) * 100,
            avgOrder: Math.round(v.amount / v.count),
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15);

    // Enrichment stats
    const totalTxnCount = allTxns.length;
    const reconciledCount = allTxns.filter(t => t.reconciled).length;
    const multiSignalCount = allTxns.filter(t => t.signal_count >= 2).length;
    const signalCount = await TransactionSignalModel.countDocuments();
    const avgEnrichmentScore = allTxns.reduce((s, t) => s + (t.enrichment_score || 0), 0) / totalTxnCount;

    // Weekday / hourly patterns (spending only)
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekdayPattern = dayNames.map((day, i) => {
        const dayTxns = spendingTxns.filter(t => new Date(t.tx_date).getDay() === i);
        const amount = dayTxns.reduce((s, t) => s + t.amount, 0);
        return { day, dayShort: dayShorts[i], amount: Math.round(amount), count: dayTxns.length };
    });
    const hourlyPattern = Array.from({ length: 24 }, (_, h) => {
        const hourTxns = spendingTxns.filter(t => new Date(t.tx_date).getHours() === h);
        const labels = ['12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM', '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM'];
        return { hour: h, label: labels[h], amount: Math.round(hourTxns.reduce((s, t) => s + t.amount, 0)), count: hourTxns.length };
    });

    // Top items
    const itemCounts: Record<string, { count: number; totalSpent: number; merchant: string }> = {};
    for (const t of debitTxns) {
        const ctx = t.context as any;
        if (!ctx) continue;
        const items = ctx.swiggy?.items || ctx.zepto?.items || [];
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name || name.length < 3 || name.length > 50) continue;
            if (!itemCounts[name]) itemCounts[name] = { count: 0, totalSpent: 0, merchant: t.merchant_name || '' };
            itemCounts[name].count += item.qty || 1;
            itemCounts[name].totalSpent += item.price || 0;
        }
    }
    const topItems = Object.entries(itemCounts)
        .map(([name, v]) => ({ name, count: v.count, totalSpent: Math.round(v.totalSpent), merchant: v.merchant, avgPrice: Math.round(v.totalSpent / v.count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    // Spending personality (spending only)
    const ordersPerMonth = spendingTxns.length / activeMonths;
    const merchants = [...new Set(spendingTxns.map(t => t.merchant_name).filter(Boolean))];
    let personality;
    if (ordersPerMonth > 50) personality = { type: 'The Power User', description: 'High-frequency spender with strong brand patterns.', traits: [`${ordersPerMonth.toFixed(0)} orders/month`, `${merchants.length} merchants`] };
    else if (ordersPerMonth > 20) personality = { type: 'The Regular', description: 'Consistent, habitual spending.', traits: [`${ordersPerMonth.toFixed(0)} orders/month`, `Avg Rs ${Math.round(totalSpent / spendingTxns.length)} per order`] };
    else personality = { type: 'The Mindful Spender', description: 'Intentional, low-frequency spending.', traits: [`${ordersPerMonth.toFixed(0)} orders/month`, `${merchants.length} merchants`] };

    // Health score
    const topMerchantPct = merchantLeaderboard.length > 0 ? merchantLeaderboard[0].pct : 0;
    const diversificationScore = Math.min(25, Math.round((1 - topMerchantPct / 100) * 25));
    const medianOV = median(spendingTxns.map(t => t.amount));
    const valueScore = medianOV < 500 ? Math.min(25, Math.round((500 - medianOV) / 20)) : 5;
    const balanceScore = (() => {
        const essentialPct = ((catMap['food_delivery']?.amount || 0) + (catMap['groceries']?.amount || 0)) / totalSpent * 100;
        return Math.min(25, Math.round(essentialPct < 60 ? 20 : 10));
    })();
    const reconciledScore = Math.min(25, Math.round((reconciledCount / totalTxnCount) * 25));
    const healthOverall = diversificationScore + valueScore + balanceScore + reconciledScore;

    const healthScore = {
        overall: healthOverall,
        dimensions: [
            { name: 'Diversification', score: diversificationScore, max: 25, detail: `Top merchant: ${topMerchantPct.toFixed(0)}%` },
            { name: 'Value', score: valueScore, max: 25, detail: `Median order: Rs ${Math.round(medianOV)}` },
            { name: 'Balance', score: balanceScore, max: 25, detail: `Food+grocery ${((catMap['food_delivery']?.amount || 0) / totalSpent * 100).toFixed(0)}% of spend` },
            { name: 'Reconciled', score: reconciledScore, max: 25, detail: `${reconciledCount}/${totalTxnCount} reconciled` },
        ],
        grade: healthOverall >= 80 ? 'Excellent' : healthOverall >= 60 ? 'Good' : healthOverall >= 40 ? 'Fair' : 'Needs Work',
    };

    // Late-night stats (spending only)
    const lateNightTxns = spendingTxns.filter(t => { const h = new Date(t.tx_date).getHours(); return h >= 22 || h < 4; });
    const lateNightSpent = lateNightTxns.reduce((s, t) => s + t.amount, 0);

    // Biggest spending order (not transfers)
    const biggestOrder = spendingTxns.reduce((max, t) => t.amount > max.amount ? t : max, spendingTxns[0]);

    // Busiest day (spending only)
    const dayCount: Record<string, number> = {};
    spendingTxns.forEach(t => { const k = new Date(t.tx_date).toISOString().slice(0, 10); dayCount[k] = (dayCount[k] || 0) + 1; });
    const busiestDay = Object.entries(dayCount).reduce((max, [day, count]) => count > max.count ? { day, count } : max, { day: '', count: 0 });

    // What-if scenarios
    const whatIfScenarios: any[] = [];
    if (catMap['food_delivery']) {
        whatIfScenarios.push({
            name: 'Cook at Home', description: 'Cook instead of ordering food delivery',
            yourValue: Math.round(catMap['food_delivery'].amount), hypothetical: Math.round(catMap['food_delivery'].count * 100),
            diff: Math.round(catMap['food_delivery'].amount - catMap['food_delivery'].count * 100),
            framing: `Save Rs ${Math.round(catMap['food_delivery'].amount - catMap['food_delivery'].count * 100).toLocaleString('en-IN')} (at Rs 100/meal)`,
        });
    }
    if (catMap['cab_ride']) {
        whatIfScenarios.push({
            name: 'Metro Commute', description: 'Public transport instead of cabs',
            yourValue: Math.round(catMap['cab_ride'].amount), hypothetical: Math.round(catMap['cab_ride'].count * 40),
            diff: Math.round(catMap['cab_ride'].amount - catMap['cab_ride'].count * 40),
            framing: `Public transport: Rs ${Math.round(catMap['cab_ride'].count * 40).toLocaleString('en-IN')} vs Rs ${Math.round(catMap['cab_ride'].amount).toLocaleString('en-IN')}`,
        });
    }

    // Insights array
    const insights: any[] = [];
    const top3Pct = merchantLeaderboard.slice(0, 3).reduce((s, m) => s + m.pct, 0);
    insights.push({ key: 'brand_loyalty', icon: '💎', bigNumber: `${Math.round(top3Pct)}%`, title: 'Top 3 Merchant Concentration', subtitle: merchantLeaderboard.slice(0, 3).map(m => `${m.name}: ${m.pct.toFixed(1)}%`).join(' / ') });
    const enrichedPct = (multiSignalCount / totalTxnCount * 100);
    insights.push({ key: 'enrichment', icon: '🔬', bigNumber: `${Math.round(enrichedPct)}%`, title: 'Data Enrichment', subtitle: `${multiSignalCount} of ${totalTxnCount} transactions from multiple sources` });
    const peakDay = weekdayPattern.reduce((max, w) => w.amount > max.amount ? w : max, weekdayPattern[0]);
    insights.push({ key: 'peak_day', icon: '🔥', bigNumber: peakDay.dayShort, title: `${peakDay.day} is Your Spending Day`, subtitle: `Rs ${peakDay.amount.toLocaleString('en-IN')} across ${peakDay.count} orders` });
    if (lateNightTxns.length > 5) {
        insights.push({ key: 'night_owl', icon: '🌙', bigNumber: `${lateNightTxns.length}`, title: 'Night Owl Orders', subtitle: `Rs ${Math.round(lateNightSpent).toLocaleString('en-IN')} spent after 10 PM` });
    }
    insights.push({ key: 'order_sizing', icon: '📊', bigNumber: `Rs ${Math.round(medianOV)}`, title: 'Median Order Value', subtitle: `${debitTxns.filter(t => t.amount < 300).length} under Rs 300, ${debitTxns.filter(t => t.amount >= 1000).length} above Rs 1000` });
    insights.push({ key: 'reconciliation', icon: '✅', bigNumber: `${(reconciledCount / totalTxnCount * 100).toFixed(0)}%`, title: 'Bank Reconciled', subtitle: `${reconciledCount} of ${totalTxnCount} confirmed in bank statements` });

    // ── Folders ──
    const folders = await TransactionFolderModel.find({ isArchived: false }).lean();
    const folderData = [];

    for (const folder of folders) {
        const f = folder as any;

        // Get transactions in this folder by two methods:
        // 1. Explicitly included txn IDs
        // 2. Rule-based matching
        let folderTxnIds = new Set<string>(f.includedTxnIds || []);
        const excludedIds = new Set<string>(f.excludedTxnIds || []);

        // Apply rules to find matching transactions
        for (const rule of (f.rules || [])) {
            let query: any = {};
            if (rule.op === 'eq') query[rule.field] = rule.value;
            else if (rule.op === 'in') query[rule.field] = { $in: rule.value };
            else if (rule.op === 'contains') query[rule.field] = { $regex: rule.value, $options: 'i' };
            else if (rule.op === 'regex') query[rule.field] = { $regex: rule.value, $options: 'i' };
            else if (rule.op === 'gt') query[rule.field] = { $gt: rule.value };
            else if (rule.op === 'lt') query[rule.field] = { $lt: rule.value };

            if (Object.keys(query).length > 0) {
                query.type = 'debit';
                query.tx_date = { $gte: cutoffDate };
                const matched = await TransactionModel.find(query).select('_id').lean();
                matched.forEach(t => folderTxnIds.add(t._id.toString()));
            }
        }

        // Remove excluded
        excludedIds.forEach(id => folderTxnIds.delete(id));

        // Fetch actual transactions
        const folderTxns = allTxns.filter(t => folderTxnIds.has(t._id.toString()));
        const debits = folderTxns.filter(t => t.type === 'debit');
        const totalAmount = debits.reduce((s, t) => s + t.amount, 0);

        // Category breakdown within folder
        const folderCatMap: Record<string, { amount: number; count: number }> = {};
        for (const t of debits) {
            const cat = t.category || 'unknown';
            if (!folderCatMap[cat]) folderCatMap[cat] = { amount: 0, count: 0 };
            folderCatMap[cat].amount += t.amount;
            folderCatMap[cat].count++;
        }

        // Top merchants within folder
        const folderMerchMap: Record<string, { amount: number; count: number }> = {};
        for (const t of debits) {
            const name = t.merchant_name || 'Unknown';
            if (name.includes('@') || name.length > 40) continue;
            if (!folderMerchMap[name]) folderMerchMap[name] = { amount: 0, count: 0 };
            folderMerchMap[name].amount += t.amount;
            folderMerchMap[name].count++;
        }

        // Monthly trend within folder
        const folderMonthly: Record<string, number> = {};
        for (const t of debits) {
            const d = new Date(t.tx_date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            folderMonthly[key] = (folderMonthly[key] || 0) + t.amount;
        }

        // Recent transactions
        const recentTxns = folderTxns
            .sort((a, b) => new Date(b.tx_date).getTime() - new Date(a.tx_date).getTime())
            .slice(0, 20)
            .map(t => ({
                date: new Date(t.tx_date).toISOString().slice(0, 10),
                amount: t.amount,
                type: t.type,
                category: (t.category || 'unknown').replace(/_/g, ' '),
                merchant: t.merchant_name || '',
                narration: (t.raw_narration || '').substring(0, 60),
            }));

        folderData.push({
            id: f._id.toString(),
            name: f.name,
            type: f.type,
            icon: f.icon || '📁',
            color: f.color,
            description: f.description || '',
            dateFrom: f.dateFrom,
            dateTo: f.dateTo,
            totalAmount: Math.round(totalAmount),
            txnCount: debits.length,
            categories: Object.entries(folderCatMap)
                .map(([slug, v]) => ({
                    slug,
                    label: slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    color: CATEGORY_COLORS[slug] || '#95A5A6',
                    amount: Math.round(v.amount),
                    count: v.count,
                    pct: totalAmount > 0 ? Math.round(v.amount / totalAmount * 100) : 0,
                }))
                .sort((a, b) => b.amount - a.amount),
            topMerchants: Object.entries(folderMerchMap)
                .filter(([name]) => name !== 'Unknown')
                .map(([name, v]) => ({ name, amount: Math.round(v.amount), count: v.count }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 10),
            monthlyTrend: Object.entries(folderMonthly)
                .map(([key, amount]) => ({ month: formatMonth(key), amount: Math.round(amount) }))
                .sort((a, b) => a.month.localeCompare(b.month)),
            recentTransactions: recentTxns,
            isDefault: f.isDefault || false,
        });
    }

    // Sort: defaults first, then by amount
    folderData.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return b.totalAmount - a.totalAmount;
    });

    // ── Lifestyle Optimization Data ──
    const NON_SPENDING_LIFE = new Set(['transfer', 'atm_withdrawal', 'investment', 'salary', 'credit_card_bill', 'rent']);
    const spendingForLife = allTxns.filter(t => t.type === 'debit' && !NON_SPENDING_LIFE.has(t.category || 'unknown') && !(t as any).sub_category?.includes('lite_load'));

    // Late booking premium (flights)
    const flightTxns = spendingForLife.filter(t => t.category === 'flight');
    const flightInsights: any[] = [];
    let totalFlightSpend = 0;
    let totalFlightPremium = 0;
    for (const f of flightTxns) {
        const ctx = f.context as any;
        const flight = ctx?.flight;
        if (!flight) continue;
        const travelDate = flight.travel_date ? new Date(flight.travel_date) : null;
        const txDate = new Date(f.tx_date);
        let leadDays = 0;
        if (travelDate && !isNaN(travelDate.getTime())) {
            const bookedOn = flight.booked_on ? new Date(flight.booked_on) : txDate;
            leadDays = Math.round((travelDate.getTime() - bookedOn.getTime()) / (1000 * 60 * 60 * 24));
        }
        const daysFromOptimal = Math.max(0, 60 - leadDays);
        const multiplier = 1 + (daysFromOptimal / 10) * 0.1;
        const estimatedOptimal = Math.round(f.amount / multiplier);
        const premium = f.amount - estimatedOptimal;
        totalFlightSpend += f.amount;
        totalFlightPremium += premium;
        flightInsights.push({
            route: flight.route || 'Flight',
            amount: Math.round(f.amount),
            leadDays: Math.max(0, leadDays),
            optimalPrice: estimatedOptimal,
            premium: Math.round(premium),
            premiumPct: Math.round((multiplier - 1) * 100),
        });
    }

    // Swiggy analysis
    const swiggyTxns = spendingForLife.filter(t => (t.merchant_name || '').toLowerCase().includes('swiggy'));
    const swiggyTotal = swiggyTxns.reduce((s, t) => s + t.amount, 0);
    const swiggyMonthCount = new Set(swiggyTxns.map(t => { const d = new Date(t.tx_date); return `${d.getFullYear()}-${d.getMonth()}`; })).size || 1;
    let totalPlatformFee = 0, totalDeliveryFee = 0;
    for (const t of swiggyTxns) {
        const ctx = t.context as any;
        if (ctx?.swiggy) {
            totalPlatformFee += ctx.swiggy.platform_fee || 0;
            totalDeliveryFee += ctx.swiggy.delivery_fee || 0;
        }
    }
    const swiggyHdfcCashback = Math.round(swiggyTotal * 0.10);
    const swiggyHdfcNet = swiggyHdfcCashback - 500;
    const swiggyOneSavings = Math.round(totalDeliveryFee + totalPlatformFee * 0.5 - 1499);

    // Uber analysis
    const uberTxns = spendingForLife.filter(t => (t.merchant_name || '').toLowerCase().includes('uber'));
    const uberTotal = uberTxns.reduce((s, t) => s + t.amount, 0);
    const uberMonthCount = new Set(uberTxns.map(t => { const d = new Date(t.tx_date); return `${d.getFullYear()}-${d.getMonth()}`; })).size || 1;
    const uberPerMonth = uberTotal / uberMonthCount;
    const uberRidesPerMonth = uberTxns.length / uberMonthCount;
    const uberPassMonthlySaving = Math.round(uberPerMonth * 0.15 - 149);

    // Netflix
    const netflixTxns = spendingForLife.filter(t => /netflix/i.test(t.merchant_name || '') || /netflix/i.test(t.raw_narration || ''));
    const netflixMonthly = netflixTxns.length > 0 ? Math.round(netflixTxns.reduce((s, t) => s + t.amount, 0) / netflixTxns.length) : 649;
    const netflixAnnualSaving = Math.round(netflixMonthly * 12 * 0.17);

    // BluSmart
    const blusmartTxns = spendingForLife.filter(t => /blusmart|blu smart/i.test(t.merchant_name || '') || /blusmart/i.test(t.raw_narration || ''));
    const blusmartTotal = blusmartTxns.reduce((s, t) => s + t.amount, 0);
    const allCabTxns = spendingForLife.filter(t => t.category === 'cab_ride');

    // Repeat items (bulk buying)
    const itemCountsLife: Record<string, { count: number; totalPrice: number }> = {};
    for (const t of spendingForLife) {
        const ctx = t.context as any;
        const items = ctx?.swiggy?.items || ctx?.zepto?.items || [];
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name || name.length < 3 || name.length > 50) continue;
            if (!itemCountsLife[name]) itemCountsLife[name] = { count: 0, totalPrice: 0 };
            itemCountsLife[name].count += item.qty || 1;
            itemCountsLife[name].totalPrice += item.price || 0;
        }
    }
    const bulkBuyItems = Object.entries(itemCountsLife)
        .filter(([, v]) => v.count >= 10)
        .map(([name, v]) => ({ name, count: v.count, totalSpent: Math.round(v.totalPrice), avgPrice: Math.round(v.totalPrice / v.count), potentialSaving: Math.round(v.totalPrice * 0.25) }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10);
    const bulkBuySaving = bulkBuyItems.reduce((s, i) => s + i.potentialSaving, 0);

    // Small order tax
    const smallSwiggyOrders = swiggyTxns.filter(t => t.amount < 200);
    const smallOrderFees = smallSwiggyOrders.reduce((s, t) => {
        const ctx = t.context as any;
        return s + (ctx?.swiggy?.platform_fee || 0) + (ctx?.swiggy?.delivery_fee || 0);
    }, 0);
    const smallOrderSaving = Math.round(smallSwiggyOrders.length / 2 * 20);

    // Total savings
    const savingsItems = [
        { name: 'Swiggy HDFC Card', description: '10% cashback on all Swiggy orders', amount: swiggyHdfcNet, icon: '💳', details: `Rs.${Math.round(swiggyTotal).toLocaleString('en-IN')} Swiggy spend × 10% - Rs.500 fee` },
        { name: 'Swiggy One', description: 'Free delivery + reduced platform fee', amount: swiggyOneSavings, icon: '🛵', details: `Save Rs.${Math.round(totalDeliveryFee + totalPlatformFee).toLocaleString('en-IN')} in fees - Rs.1,499 membership` },
        { name: 'Uber Pass', description: '~15% off all rides', amount: Math.max(0, uberPassMonthlySaving * 12), icon: '🚗', details: `${uberTxns.length} rides, ${Math.round(uberRidesPerMonth)}/month avg` },
        { name: 'Netflix Annual', description: '17% discount vs monthly', amount: netflixAnnualSaving, icon: '🎬', details: `Rs.${netflixMonthly}/month → Rs.${Math.round(netflixMonthly * 12 * 0.83)}/year` },
        { name: 'Book Flights Early', description: 'Book 2 months ahead instead of last minute', amount: Math.round(totalFlightPremium), icon: '✈️', details: `${flightTxns.length} flights, avg ${Math.round(totalFlightPremium / Math.max(1, flightTxns.length))} premium each` },
        { name: 'Bulk Buy Repeats', description: 'Buy frequently ordered items in bulk', amount: bulkBuySaving, icon: '📦', details: `${bulkBuyItems.length} items bought 10+ times` },
        { name: 'Batch Small Orders', description: 'Combine orders under Rs.200', amount: smallOrderSaving, icon: '🔗', details: `${smallSwiggyOrders.length} orders under Rs.200` },
    ].filter(s => s.amount > 0);
    const totalPotentialSavings = savingsItems.reduce((s, i) => s + i.amount, 0);
    const totalSpendingLife = spendingForLife.reduce((s, t) => s + t.amount, 0);

    const data = {
        generatedAt: new Date().toISOString(),
        months,
        overall: overallData,
        folders: folderData,
        insights: {
            overview: {
                totalSpent: Math.round(totalSpent),
                totalTransfers: Math.round(totalTransfers),
                totalOrders: spendingTxns.length,
                totalCredit: Math.round(allTxns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)),
                avgMonthly: Math.round(totalSpent / activeMonths),
                avgOrderValue: Math.round(totalSpent / spendingTxns.length),
                medianOrderValue: Math.round(medianOV),
                uniqueMerchants: merchants.length,
                periodFrom: allTxns[allTxns.length - 1].tx_date,
                periodTo: allTxns[0].tx_date,
                activeMonths,
            },
            healthScore,
            spendingPersonality: personality,
            merchantLeaderboard,
            weekdayPattern,
            hourlyPattern,
            topItems,
            whatIfScenarios,
            cards: insights,
            yourNumbers: [
                { icon: '💸', value: `Rs ${Math.round(biggestOrder.amount).toLocaleString('en-IN')}`, label: 'Biggest Single Order', detail: `${biggestOrder.merchant_name || 'Unknown'}` },
                { icon: '🏆', value: `${merchantLeaderboard[0]?.count || 0}`, label: `Orders from ${merchantLeaderboard[0]?.name || ''}`, detail: `${merchantLeaderboard[0]?.pct.toFixed(0) || 0}% of spending` },
                { icon: '📦', value: `${busiestDay.count}`, label: 'Most Orders in One Day', detail: busiestDay.day },
                { icon: '🌙', value: `${lateNightTxns.length}`, label: 'Late Night Orders', detail: `Rs ${Math.round(lateNightSpent).toLocaleString('en-IN')} after 10 PM` },
                { icon: '🔗', value: `${multiSignalCount}`, label: 'Multi-Source Transactions', detail: `Enriched from multiple signals` },
                { icon: '✅', value: `${reconciledCount}`, label: 'Reconciled', detail: `${(reconciledCount / totalTxnCount * 100).toFixed(0)}% confirmed` },
            ],
        },
        enrichmentStats: {
            totalTransactions: totalTxnCount,
            totalSignals: signalCount,
            multiSignalCount,
            reconciledCount,
            avgEnrichmentScore: Math.round(avgEnrichmentScore),
        },
        lifestyleOptimization: {
            totalPotentialSavings,
            savingsAsPercent: Math.round(totalPotentialSavings / totalSpendingLife * 1000) / 10,
            monthlySavings: Math.round(totalPotentialSavings / 12),
            savingsItems,
            lateBooking: {
                flights: flightInsights,
                totalSpend: Math.round(totalFlightSpend),
                totalPremium: Math.round(totalFlightPremium),
            },
            swiggy: {
                totalSpend: Math.round(swiggyTotal),
                perMonth: Math.round(swiggyTotal / swiggyMonthCount),
                orderCount: swiggyTxns.length,
                deliveryFees: Math.round(totalDeliveryFee),
                platformFees: Math.round(totalPlatformFee),
                hdfcCardSaving: swiggyHdfcNet,
                swiggyOneSaving: swiggyOneSavings,
            },
            uber: {
                totalSpend: Math.round(uberTotal),
                rideCount: uberTxns.length,
                perMonth: Math.round(uberPerMonth),
                ridesPerMonth: Math.round(uberRidesPerMonth),
                passSaving: Math.max(0, uberPassMonthlySaving * 12),
            },
            cabs: {
                totalSpend: Math.round(allCabTxns.reduce((s, t) => s + t.amount, 0)),
                totalRides: allCabTxns.length,
                uberRides: uberTxns.length,
                uberTotal: Math.round(uberTotal),
                uberAvg: uberTxns.length > 0 ? Math.round(uberTotal / uberTxns.length) : 0,
                blusmartRides: blusmartTxns.length,
                blusmartTotal: Math.round(blusmartTotal),
                blusmartAvg: blusmartTxns.length > 0 ? Math.round(blusmartTotal / blusmartTxns.length) : 0,
            },
            bulkBuying: bulkBuyItems,
            smallOrderTax: {
                count: smallSwiggyOrders.length,
                totalFees: Math.round(smallOrderFees),
                potentialSaving: smallOrderSaving,
            },
        },
    };

    const outPath = path.join(__dirname, '../../..', 'spending-dashboard-data.json');
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`Dashboard data written to ${outPath}`);
    console.log(`${totalTxnCount} txns, ${monthKeys.length} months, ${signalCount} signals`);

    process.exit(0);
})();
