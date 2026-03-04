/**
 * Generate spending dashboard data from MongoDB invoices + transactions.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/generate-spending-data.ts
 *
 * Outputs: spending-dashboard-data.json (loaded by spending-dashboard.html)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.dev') });

import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { Invoice, IInvoiceDoc } from '@/schema/invoice.schema';
import { Transaction, ITransactionDoc } from '@/schema/transaction.schema';
import { Types } from 'mongoose';

const CREDENTIALS_PATH = path.join(process.cwd(), 'abhishek-gmail-integration.json');

// ── Helpers ──────────────────────────────────────────────────────────────────

const SENDER_KEY_TO_CATEGORY: Record<string, { label: string; category: string; color: string }> = {
    swiggy: { label: 'Food Delivery', category: 'food_delivery', color: '#FF6B35' },
    'swiggy-instamart': { label: 'Grocery', category: 'grocery', color: '#00B894' },
    uber: { label: 'Transport', category: 'transport', color: '#0984E3' },
    ola: { label: 'Transport', category: 'transport', color: '#0984E3' },
    apple: { label: 'Subscriptions & Apps', category: 'subscription', color: '#6C5CE7' },
    'google-play': { label: 'Subscriptions & Apps', category: 'subscription', color: '#6C5CE7' },
    zomato: { label: 'Food Delivery', category: 'food_delivery', color: '#FF6B35' },
    amazon: { label: 'Shopping', category: 'shopping', color: '#E17055' },
    flipkart: { label: 'Shopping', category: 'shopping', color: '#E17055' },
    bigbasket: { label: 'Grocery', category: 'grocery', color: '#00B894' },
    blinkit: { label: 'Grocery', category: 'grocery', color: '#00B894' },
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function median(arr: number[]): number {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
    return Math.sqrt(variance);
}

function daysBetween(d1: Date, d2: Date): number {
    return Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    await databaseLoader();

    const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const parseOid = (v: any) => {
        if (!v) return new Types.ObjectId();
        if (typeof v === 'string') return new Types.ObjectId(v);
        if (v.$oid) return new Types.ObjectId(v.$oid);
        return new Types.ObjectId();
    };
    const userId = parseOid(creds.userId);

    logger.info(`Generating spending dashboard data for user ${userId}...`);

    // Fetch all data
    const [invoices, transactions] = await Promise.all([
        Invoice.find({ userId }).sort({ orderDate: 1 }).lean<IInvoiceDoc[]>(),
        Transaction.find({ userId }).sort({ date: 1 }).lean<ITransactionDoc[]>(),
    ]);

    logger.info(`Found ${invoices.length} invoices, ${transactions.length} transactions`);

    if (!invoices.length) {
        logger.error('No invoices found. Run the pipeline first.');
        process.exit(1);
    }

    // ── 0. Time helpers ───────────────────────────────────────────────────────
    // Dates are stored as UTC epoch in MongoDB. JS getHours()/getDay() auto-
    // convert to local timezone (IST on this machine), which is what we want.
    const getHourIST = (d: Date): number => d.getHours();
    const getDayIST = (d: Date): number => d.getDay();

    // ── 1. Overview ──────────────────────────────────────────────────────────
    const amounts = invoices.map((i) => i.totalAmount);
    const dates = invoices.map((i) => new Date(i.orderDate));
    const periodFrom = dates[0];
    const periodTo = dates[dates.length - 1];

    // Calculate "active period" — months with 5+ orders — for meaningful averages
    const monthOrderCounts = new Map<string, number>();
    for (const inv of invoices) {
        const d = new Date(inv.orderDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        monthOrderCounts.set(key, (monthOrderCounts.get(key) || 0) + 1);
    }
    const activeMonths = [...monthOrderCounts.values()].filter((c) => c >= 5).length;
    const totalMonths = Math.max(1, activeMonths || Math.ceil(daysBetween(periodFrom, periodTo) / 30.44));
    const activeDays = totalMonths * 30.44;

    const periodDays = Math.max(1, daysBetween(periodFrom, periodTo));
    const totalSpent = amounts.reduce((a, b) => a + b, 0);
    const merchantNames = [...new Set(invoices.map((i) => i.merchantName))];

    const overview = {
        totalSpent,
        totalOrders: invoices.length,
        avgMonthly: totalSpent / totalMonths,
        avgOrderValue: totalSpent / invoices.length,
        medianOrderValue: median(amounts),
        uniqueMerchants: merchantNames.length,
        periodFrom: periodFrom.toISOString(),
        periodTo: periodTo.toISOString(),
        periodDays: Math.round(periodDays),
        periodMonths: totalMonths,
        activeMonths: activeMonths,
    };

    // ── 2. Category Breakdown ────────────────────────────────────────────────
    const catMap = new Map<string, { label: string; color: string; amount: number; count: number }>();
    for (const inv of invoices) {
        const info = SENDER_KEY_TO_CATEGORY[inv.senderKey] || {
            label: inv.senderKey || 'Other',
            category: 'other',
            color: '#636E72',
        };
        const key = info.label;
        const existing = catMap.get(key) || { label: key, color: info.color, amount: 0, count: 0 };
        existing.amount += inv.totalAmount;
        existing.count += 1;
        catMap.set(key, existing);
    }
    const categoryBreakdown = [...catMap.values()]
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({
            ...c,
            pct: (c.amount / totalSpent) * 100,
            avgOrder: c.amount / c.count,
        }));

    // ── 3. Merchant Leaderboard ──────────────────────────────────────────────
    const merchMap = new Map<string, { amount: number; count: number; senderKey: string }>();
    for (const inv of invoices) {
        const key = inv.merchantName;
        const existing = merchMap.get(key) || { amount: 0, count: 0, senderKey: inv.senderKey };
        existing.amount += inv.totalAmount;
        existing.count += 1;
        merchMap.set(key, existing);
    }
    const merchantLeaderboard = [...merchMap.entries()]
        .map(([name, data]) => ({
            name,
            ...data,
            avgOrder: data.amount / data.count,
            pct: (data.amount / totalSpent) * 100,
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 12);

    // ── 4. Monthly Heatmap ───────────────────────────────────────────────────
    const monthlyMap = new Map<string, { amount: number; count: number }>();
    for (const inv of invoices) {
        const d = new Date(inv.orderDate);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const existing = monthlyMap.get(key) || { amount: 0, count: 0 };
        existing.amount += inv.totalAmount;
        existing.count += 1;
        monthlyMap.set(key, existing);
    }
    const years = [...new Set(invoices.map((i) => new Date(i.orderDate).getFullYear()))].sort();
    const monthlyHeatmap = years.map((year) => ({
        year,
        months: Array.from({ length: 12 }, (_, m) => {
            const data = monthlyMap.get(`${year}-${m}`) || { amount: 0, count: 0 };
            return { month: m, ...data };
        }),
        total: Array.from({ length: 12 }, (_, m) => monthlyMap.get(`${year}-${m}`)?.amount || 0).reduce(
            (a, b) => a + b,
            0
        ),
    }));

    // Detect emails with no real time data. Date-only entries become midnight
    // UTC (if parsed by API) or midnight local/IST (if parsed by new Date('YYYY-MM-DD')).
    // Exclude both to avoid false hourly spikes.
    const hasTime = (d: Date): boolean => {
        const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
        const localMidnight = d.getHours() === 0 && d.getMinutes() === 0;
        return !utcMidnight && !localMidnight;
    };

    // ── 5. Day of Week Pattern (IST) ────────────────────────────────────────
    const dowData = Array.from({ length: 7 }, () => ({ amount: 0, count: 0 }));
    for (const inv of invoices) {
        const d = new Date(inv.orderDate);
        const dow = getDayIST(d);
        dowData[dow].amount += inv.totalAmount;
        dowData[dow].count += 1;
    }
    const weekdayPattern = dowData.map((d, i) => ({
        day: DAY_NAMES[i],
        dayShort: DAY_SHORT[i],
        amount: d.amount,
        count: d.count,
        avgOrder: d.count ? d.amount / d.count : 0,
    }));

    // ── 6. Hourly Pattern (IST) — only include emails with real time data ──
    const hourData = Array.from({ length: 24 }, () => ({ amount: 0, count: 0 }));
    let noTimeCount = 0;
    for (const inv of invoices) {
        const d = new Date(inv.orderDate);
        if (!hasTime(d)) { noTimeCount++; continue; } // Skip midnight-UTC (no time data)
        const h = getHourIST(d);
        hourData[h].amount += inv.totalAmount;
        hourData[h].count += 1;
    }
    if (noTimeCount > 0) logger.info(`Excluded ${noTimeCount} orders with no time data from hourly analysis`);
    const hourlyPattern = hourData.map((d, i) => ({
        hour: i,
        label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
        amount: d.amount,
        count: d.count,
    }));

    // ── 7. Top Line Items ────────────────────────────────────────────────────
    const itemMap = new Map<string, { count: number; totalSpent: number; merchant: string }>();
    for (const inv of invoices) {
        for (const item of inv.lineItems || []) {
            if (!item.name || item.name.length < 2) continue;
            const key = item.name.trim().toLowerCase();
            const existing = itemMap.get(key) || { count: 0, totalSpent: 0, merchant: inv.merchantName };
            existing.count += 1;
            existing.totalSpent += item.totalPrice || 0;
            itemMap.set(key, existing);
        }
    }
    const topItems = [...itemMap.entries()]
        .map(([name, data]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            ...data,
            avgPrice: data.count ? data.totalSpent / data.count : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    // ── 8. Spending Health Score ─────────────────────────────────────────────
    // Diversification: inverse HHI (lower concentration = higher score)
    const catShares = categoryBreakdown.map((c) => c.pct / 100);
    const hhi = catShares.reduce((sum, s) => sum + s * s, 0);
    const diversificationScore = Math.round(Math.min(25, (1 - hhi) * 35));

    // Frequency regularity: low std dev of days between orders = high score
    const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
        gaps.push(daysBetween(sortedDates[i - 1], sortedDates[i]));
    }
    const gapStdDev = stdDev(gaps);
    const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    const cv = avgGap > 0 ? gapStdDev / avgGap : 1;
    const frequencyScore = Math.round(Math.min(25, Math.max(0, 25 - cv * 15)));

    // Value consciousness: what % of orders are below median? Higher median = lower score
    const medianAmt = median(amounts);
    const affordableRatio = amounts.filter((a) => a <= medianAmt * 1.2).length / amounts.length;
    const valueScore = Math.round(affordableRatio * 25);

    // Category balance: having essential (grocery/transport) vs discretionary
    const essentialPct = categoryBreakdown
        .filter((c) => ['Grocery', 'Transport'].includes(c.label))
        .reduce((s, c) => s + c.pct, 0);
    const balanceScore = Math.round(Math.min(25, essentialPct > 0 ? Math.min(essentialPct / 2, 25) : 5));

    const healthScore = {
        overall: diversificationScore + frequencyScore + valueScore + balanceScore,
        dimensions: [
            {
                name: 'Diversification',
                score: diversificationScore,
                max: 25,
                detail: `HHI: ${(hhi * 100).toFixed(0)}% concentration`,
            },
            {
                name: 'Regularity',
                score: frequencyScore,
                max: 25,
                detail: `Avg ${avgGap.toFixed(1)} days between orders`,
            },
            {
                name: 'Value',
                score: valueScore,
                max: 25,
                detail: `Median order: Rs ${Math.round(medianAmt)}`,
            },
            {
                name: 'Balance',
                score: balanceScore,
                max: 25,
                detail: `${essentialPct.toFixed(0)}% essential spending`,
            },
        ],
    };
    const scoreGrade = healthScore.overall >= 75 ? 'Excellent' : healthScore.overall >= 50 ? 'Good' : healthScore.overall >= 30 ? 'Fair' : 'Needs Work';

    // ── 9. Your Numbers (unique facts) ───────────────────────────────────────
    const maxOrder = invoices.reduce((max, inv) => (inv.totalAmount > max.totalAmount ? inv : max), invoices[0]);
    const minOrder = invoices.reduce((min, inv) => (inv.totalAmount < min.totalAmount ? inv : min), invoices[0]);

    // Most orders in a single day
    const dayCountMap = new Map<string, number>();
    for (const inv of invoices) {
        const dayKey = new Date(inv.orderDate).toISOString().split('T')[0];
        dayCountMap.set(dayKey, (dayCountMap.get(dayKey) || 0) + 1);
    }
    const busiestDay = [...dayCountMap.entries()].sort((a, b) => b[1] - a[1])[0];

    // Most from single merchant
    const topMerch = merchantLeaderboard[0];

    // Total unique items
    const totalUniqueItems = itemMap.size;

    // Longest streak without ordering (cap at 90 days to ignore data gaps)
    let longestStreak = 0;
    const recentGaps: number[] = [];
    for (let i = 1; i < sortedDates.length; i++) {
        const gap = daysBetween(sortedDates[i - 1], sortedDates[i]);
        if (gap <= 90) recentGaps.push(gap); // Ignore multi-year gaps (data holes)
        if (gap > longestStreak && gap <= 90) longestStreak = gap;
    }
    // If no gaps within 90 days, use overall max
    if (longestStreak === 0) {
        for (let i = 1; i < sortedDates.length; i++) {
            const gap = daysBetween(sortedDates[i - 1], sortedDates[i]);
            if (gap > longestStreak) longestStreak = gap;
        }
    }

    // Weekend vs weekday
    const weekendSpend = weekdayPattern.filter((_, i) => i === 0 || i === 6).reduce((s, d) => s + d.amount, 0);
    const weekdaySpend = weekdayPattern.filter((_, i) => i > 0 && i < 6).reduce((s, d) => s + d.amount, 0);
    const weekendAvg = weekendSpend / (weekdayPattern.filter((_, i) => i === 0 || i === 6).reduce((s, d) => s + d.count, 0) || 1);
    const weekdayAvg = weekdaySpend / (weekdayPattern.filter((_, i) => i > 0 && i < 6).reduce((s, d) => s + d.count, 0) || 1);

    // Peak hour
    const peakHour = hourlyPattern.reduce((max, h) => (h.amount > max.amount ? h : max), hourlyPattern[0]);

    // Late night orders (10 PM - 4 AM IST) — from hourly data (which already excludes no-time emails)
    const lateNightHours = hourlyPattern.filter((h) => h.hour >= 22 || h.hour < 4);
    const lateNightTotal = lateNightHours.reduce((s, h) => s + h.amount, 0);
    const lateNightCount = lateNightHours.reduce((s, h) => s + h.count, 0);

    const yourNumbers = [
        {
            icon: '💸',
            value: `Rs ${Math.round(maxOrder.totalAmount).toLocaleString('en-IN')}`,
            label: 'Biggest Single Order',
            detail: `${maxOrder.merchantName} on ${new Date(maxOrder.orderDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        },
        {
            icon: '🔄',
            value: `${topMerch?.count || 0}`,
            label: `Orders from ${topMerch?.name || 'Top Merchant'}`,
            detail: `That's every ${Math.max(1, Math.round(activeDays / (topMerch?.count || 1)))} days`,
        },
        {
            icon: '📦',
            value: `${busiestDay?.[1] || 0}`,
            label: 'Most Orders in One Day',
            detail: busiestDay ? new Date(busiestDay[0]).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
        },
        {
            icon: '🌙',
            value: `${lateNightCount}`,
            label: 'Late Night Orders',
            detail: `Rs ${Math.round(lateNightTotal).toLocaleString('en-IN')} spent after 10 PM`,
        },
        {
            icon: '🏖️',
            value: `${Math.round(longestStreak)}`,
            label: 'Longest Order-Free Streak (days)',
            detail: 'Your best break from ordering',
        },
        {
            icon: '🍽️',
            value: `${totalUniqueItems}`,
            label: 'Unique Items Ordered',
            detail: `Across all invoices with line items`,
        },
    ];

    // ── 10. Real-World Equivalents ───────────────────────────────────────────
    const foodDeliveryTotal = categoryBreakdown.find((c) => c.label === 'Food Delivery')?.amount || 0;
    const transportTotal = categoryBreakdown.find((c) => c.label === 'Transport')?.amount || 0;

    const realWorldEquivalents = [
        {
            icon: '🍳',
            value: `${Math.round(foodDeliveryTotal / 6000)}`,
            label: 'Months of Home Cooking',
            detail: `Your food delivery spend (Rs ${Math.round(foodDeliveryTotal / 1000)}K) at Rs 200/day`,
        },
        {
            icon: '✈️',
            value: `${Math.round(totalSpent / 5000)}`,
            label: 'Domestic Flights',
            detail: `Total spend at Rs 5,000 per flight`,
        },
        {
            icon: '📱',
            value: `${Math.round(totalSpent / 199)}`,
            label: 'Netflix Subscriptions',
            detail: `At Rs 199/month mobile plan`,
        },
        {
            icon: '🏋️',
            value: `${Math.round(totalSpent / 1500)}`,
            label: 'Gym Memberships (months)',
            detail: `At Rs 1,500/month`,
        },
    ];

    // ── 11. What-If Scenarios ────────────────────────────────────────────────
    const whatIfScenarios = [];

    // Cook at home
    if (foodDeliveryTotal > 0) {
        const foodOrders = invoices.filter((i) => SENDER_KEY_TO_CATEGORY[i.senderKey]?.category === 'food_delivery');
        const homeCookCost = foodOrders.length * 100; // Rs 100 per meal at home
        whatIfScenarios.push({
            name: 'Cook at Home',
            description: 'What if you cooked at home instead of ordering food delivery?',
            yourValue: foodDeliveryTotal,
            hypothetical: homeCookCost,
            diff: foodDeliveryTotal - homeCookCost,
            better: false,
            framing: `You could save Rs ${Math.round(foodDeliveryTotal - homeCookCost).toLocaleString('en-IN')} by cooking at home (at Rs 100/meal).`,
        });
    }

    // Metro vs Uber
    if (transportTotal > 0) {
        const transportOrders = invoices.filter((i) => SENDER_KEY_TO_CATEGORY[i.senderKey]?.category === 'transport');
        const metroCost = transportOrders.length * 40;
        whatIfScenarios.push({
            name: 'Metro Commute',
            description: 'What if you took the metro/bus instead of ride-hailing?',
            yourValue: transportTotal,
            hypothetical: metroCost,
            diff: transportTotal - metroCost,
            better: false,
            framing: `Public transport would cost Rs ${Math.round(metroCost).toLocaleString('en-IN')} vs your Rs ${Math.round(transportTotal).toLocaleString('en-IN')} on rides.`,
        });
    }

    // Invest instead (SIP at 12% CAGR for 10 years)
    const monthlyAvg = totalSpent / totalMonths;
    const sipMonths = 120; // 10 years
    const sipRate = 0.12 / 12;
    const sipFV = monthlyAvg * ((Math.pow(1 + sipRate, sipMonths) - 1) / sipRate) * (1 + sipRate);
    const sipInvested = monthlyAvg * sipMonths;
    whatIfScenarios.push({
        name: 'SIP Instead',
        description: `What if you invested your monthly avg (Rs ${Math.round(monthlyAvg).toLocaleString('en-IN')}) in a SIP at 12% for 10 years?`,
        yourValue: sipInvested,
        hypothetical: sipFV,
        diff: sipFV - sipInvested,
        better: true,
        framing: `Rs ${Math.round(monthlyAvg).toLocaleString('en-IN')}/month at 12% CAGR would grow to Rs ${Math.round(sipFV).toLocaleString('en-IN')} in 10 years.`,
    });

    // Skip small orders
    const smallOrders = invoices.filter((i) => i.totalAmount < 200);
    if (smallOrders.length > 5) {
        const smallTotal = smallOrders.reduce((s, i) => s + i.totalAmount, 0);
        whatIfScenarios.push({
            name: 'Skip Small Orders',
            description: `What if you skipped all ${smallOrders.length} orders under Rs 200?`,
            yourValue: totalSpent,
            hypothetical: totalSpent - smallTotal,
            diff: smallTotal,
            better: false,
            framing: `${smallOrders.length} orders under Rs 200 totalled Rs ${Math.round(smallTotal).toLocaleString('en-IN')} — that's ${((smallTotal / totalSpent) * 100).toFixed(1)}% of your spending.`,
        });
    }

    // ── 12. Spending Personality ─────────────────────────────────────────────
    const foodPct = (foodDeliveryTotal / totalSpent) * 100;
    const transportPct = (transportTotal / totalSpent) * 100;
    const ordersPerWeek = (invoices.length / activeDays) * 7;
    const weekendPct = (weekendSpend / totalSpent) * 100;

    let personality = { type: 'The Balanced Spender', emoji: '⚖️', description: 'You maintain a healthy mix of spending across categories.', traits: ['Diversified spending', 'Regular patterns'] };

    if (foodPct > 50 && ordersPerWeek > 4) {
        personality = {
            type: 'The Convenience Connoisseur',
            emoji: '🍕',
            description: 'You value convenience over cost — food delivery is your love language.',
            traits: [`${Math.round(foodPct)}% on food delivery`, `${ordersPerWeek.toFixed(1)} orders/week`, `Top merchant: ${topMerch?.name}`],
        };
    } else if (transportPct > 30) {
        personality = {
            type: 'The Urban Nomad',
            emoji: '🚗',
            description: 'Always on the move — ride-hailing is your preferred mode of transit.',
            traits: [`${Math.round(transportPct)}% on transport`, `${transportTotal > 0 ? invoices.filter(i => SENDER_KEY_TO_CATEGORY[i.senderKey]?.category === 'transport').length : 0} rides`],
        };
    } else if (weekendPct > 45) {
        personality = {
            type: 'The Weekend Warrior',
            emoji: '🎉',
            description: 'You save your spending energy for weekends — TGIF is real for you.',
            traits: [`${weekendPct.toFixed(0)}% spend on weekends`, `Avg weekend order: Rs ${Math.round(weekendAvg)}`],
        };
    } else if (lateNightCount > invoices.length * 0.15) {
        personality = {
            type: 'The Night Owl',
            emoji: '🦉',
            description: 'When the sun goes down, your ordering goes up.',
            traits: [`${lateNightCount} late-night orders`, `Rs ${Math.round(lateNightTotal).toLocaleString('en-IN')} after 10 PM`],
        };
    } else if (ordersPerWeek > 5) {
        personality = {
            type: 'The Power User',
            emoji: '⚡',
            description: 'You order with impressive frequency — apps love you.',
            traits: [`${ordersPerWeek.toFixed(1)} orders/week`, `${Math.round(avgGap * 10) / 10} day avg gap`],
        };
    }

    // ── 13. Insights ─────────────────────────────────────────────────────────
    const insights: any[] = [];

    // Weekend vs weekday
    if (weekendAvg > 0 && weekdayAvg > 0) {
        const weekendPremium = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
        insights.push({
            key: 'weekend_premium',
            category: 'patterns',
            icon: '📅',
            bigNumber: `${weekendPremium > 0 ? '+' : ''}${Math.round(weekendPremium)}%`,
            title: weekendPremium > 0 ? 'Weekend Premium' : 'Weekday Spender',
            subtitle: weekendPremium > 0
                ? `Your weekend orders average Rs ${Math.round(weekendAvg)} vs Rs ${Math.round(weekdayAvg)} on weekdays.`
                : `You actually spend more on weekdays — Rs ${Math.round(weekdayAvg)} vs Rs ${Math.round(weekendAvg)} on weekends.`,
            relevance: Math.min(90, Math.abs(Math.round(weekendPremium))),
            color: { bg: '#FF6B35', fg: '#fff' },
            journey: [
                { slot: 'The Data', title: 'Weekend vs Weekday', body: `Weekend avg: Rs ${Math.round(weekendAvg)} | Weekday avg: Rs ${Math.round(weekdayAvg)}`, highlightValue: `${weekendPremium > 0 ? '+' : ''}${Math.round(weekendPremium)}%` },
                { slot: 'Why It Matters', title: 'Spending rhythm', body: weekendPremium > 20 ? 'A significant weekend premium suggests impulse or social spending. Consider setting a weekend budget.' : 'Your spending is fairly consistent across the week — a sign of predictable habits.' },
            ],
        });
    }

    // Night owl
    if (lateNightCount > 5) {
        const lateNightPct = (lateNightCount / invoices.length) * 100;
        insights.push({
            key: 'night_owl',
            category: 'patterns',
            icon: '🌙',
            bigNumber: `${lateNightCount}`,
            title: 'Night Owl Tax',
            subtitle: `${lateNightCount} orders after 10 PM, totalling Rs ${Math.round(lateNightTotal).toLocaleString('en-IN')}. That's ${lateNightPct.toFixed(1)}% of all orders.`,
            relevance: Math.min(85, Math.round(lateNightPct * 3)),
            color: { bg: '#2D3436', fg: '#fff' },
            journey: [
                { slot: 'The Data', title: 'After Hours', body: `${lateNightCount} orders placed between 10 PM and 4 AM.`, highlightValue: `Rs ${Math.round(lateNightTotal).toLocaleString('en-IN')}` },
                { slot: 'The Insight', title: 'Late night premium', body: 'Late-night orders often carry surge pricing and tend to be impulse decisions. The cost adds up silently.' },
            ],
        });
    }

    // Brand loyalty (HHI of merchant spending)
    const merchShares = merchantLeaderboard.map((m) => m.pct / 100);
    const merchHHI = merchShares.reduce((sum, s) => sum + s * s, 0);
    const top3Pct = merchantLeaderboard.slice(0, 3).reduce((s, m) => s + m.pct, 0);
    insights.push({
        key: 'brand_loyalty',
        category: 'behavior',
        icon: '💎',
        bigNumber: `${Math.round(top3Pct)}%`,
        title: top3Pct > 70 ? 'Fiercely Loyal' : top3Pct > 50 ? 'Brand Loyal' : 'Explorer',
        subtitle: `Your top 3 merchants account for ${Math.round(top3Pct)}% of total spending.`,
        relevance: Math.round(Math.min(80, top3Pct)),
        color: { bg: '#6C5CE7', fg: '#fff' },
        journey: [
            { slot: 'The Data', title: 'Merchant Concentration', body: merchantLeaderboard.slice(0, 3).map((m) => `${m.name}: Rs ${Math.round(m.amount).toLocaleString('en-IN')} (${m.pct.toFixed(1)}%)`).join('\n'), highlightValue: `${Math.round(top3Pct)}%` },
            { slot: 'What This Means', title: 'Concentration risk', body: top3Pct > 70 ? 'High concentration means you\'re missing deals from competitors. Try alternatives occasionally.' : 'You have a healthy spread across merchants. Keep exploring!' },
        ],
    });

    // Frequency drift — compare last 3 active months vs the 3 before that
    const activeMonthKeys = [...monthOrderCounts.entries()]
        .filter(([, count]) => count >= 3)
        .map(([key]) => key)
        .sort();
    let driftPct = 0;
    let firstHalfRate = 0, secondHalfRate = 0;
    if (activeMonthKeys.length >= 4) {
        const recentMonths = activeMonthKeys.slice(-3);
        const priorMonths = activeMonthKeys.slice(-6, -3);
        const recentTotal = recentMonths.reduce((s, k) => s + (monthOrderCounts.get(k) || 0), 0);
        const priorTotal = priorMonths.reduce((s, k) => s + (monthOrderCounts.get(k) || 0), 0);
        firstHalfRate = priorTotal / Math.max(1, priorMonths.length);
        secondHalfRate = recentTotal / Math.max(1, recentMonths.length);
        driftPct = firstHalfRate > 0 ? ((secondHalfRate - firstHalfRate) / firstHalfRate) * 100 : 0;
    }

    if (Math.abs(driftPct) > 10) {
        insights.push({
            key: 'frequency_drift',
            category: 'trends',
            icon: driftPct > 0 ? '📈' : '📉',
            bigNumber: `${driftPct > 0 ? '+' : ''}${Math.round(driftPct)}%`,
            title: driftPct > 0 ? 'Ordering More' : 'Slowing Down',
            subtitle: driftPct > 0
                ? `Your ordering frequency increased by ${Math.round(driftPct)}% in the latter half of the period.`
                : `Your ordering frequency decreased by ${Math.abs(Math.round(driftPct))}% recently. Nice restraint!`,
            relevance: Math.min(75, Math.abs(Math.round(driftPct))),
            color: { bg: driftPct > 0 ? '#D63031' : '#00B894', fg: '#fff' },
            journey: [
                { slot: 'The Numbers', title: 'Order Velocity', body: `First half: ${firstHalfRate.toFixed(1)} orders/month\nSecond half: ${secondHalfRate.toFixed(1)} orders/month`, highlightValue: `${driftPct > 0 ? '+' : ''}${Math.round(driftPct)}%` },
                { slot: 'The Takeaway', title: 'Trend awareness', body: driftPct > 0 ? 'Your ordering is accelerating. Set a monthly order budget to stay in control.' : 'You\'re naturally pulling back. This discipline compounds into real savings over time.' },
            ],
        });
    }

    // Peak spending day
    const peakDay = weekdayPattern.reduce((max, d) => (d.amount > max.amount ? d : max), weekdayPattern[0]);
    const lowestDay = weekdayPattern.reduce((min, d) => (d.count > 0 && d.amount < min.amount ? d : min), weekdayPattern.filter((d) => d.count > 0)[0] || weekdayPattern[0]);
    insights.push({
        key: 'peak_day',
        category: 'patterns',
        icon: '🔥',
        bigNumber: peakDay.dayShort,
        title: `${peakDay.day} is Your Spending Day`,
        subtitle: `You spend Rs ${Math.round(peakDay.amount).toLocaleString('en-IN')} on ${peakDay.day}s (${peakDay.count} orders). ${lowestDay.day} is your lightest at Rs ${Math.round(lowestDay.amount).toLocaleString('en-IN')}.`,
        relevance: 65,
        color: { bg: '#E17055', fg: '#fff' },
    });

    // Order size distribution
    const under300 = invoices.filter((i) => i.totalAmount < 300).length;
    const over1000 = invoices.filter((i) => i.totalAmount >= 1000).length;
    const midRange = invoices.length - under300 - over1000;
    insights.push({
        key: 'order_sizing',
        category: 'behavior',
        icon: '📊',
        bigNumber: `Rs ${Math.round(overview.medianOrderValue)}`,
        title: 'Your Median Order',
        subtitle: `${under300} orders under Rs 300, ${midRange} between Rs 300-1000, and ${over1000} above Rs 1000.`,
        relevance: 55,
        color: { bg: '#0984E3', fg: '#fff' },
        journey: [
            { slot: 'Distribution', title: 'Order Size Breakdown', body: `Under Rs 300: ${under300} orders (${((under300 / invoices.length) * 100).toFixed(0)}%)\nRs 300-1000: ${midRange} orders (${((midRange / invoices.length) * 100).toFixed(0)}%)\nAbove Rs 1000: ${over1000} orders (${((over1000 / invoices.length) * 100).toFixed(0)}%)`, highlightValue: `Rs ${Math.round(overview.medianOrderValue)}` },
        ],
    });

    // Delivery fee insight (if we can detect from line items)
    const deliveryFeeItems = invoices.flatMap((i) => (i.lineItems || []).filter((li) => /deliver|shipping|surge/i.test(li.name)));
    if (deliveryFeeItems.length > 10) {
        const totalDeliveryFees = deliveryFeeItems.reduce((s, li) => s + (li.totalPrice || 0), 0);
        insights.push({
            key: 'delivery_fees',
            category: 'cost',
            icon: '🚚',
            bigNumber: `Rs ${Math.round(totalDeliveryFees).toLocaleString('en-IN')}`,
            title: 'Delivery Fee Burn',
            subtitle: `You paid Rs ${Math.round(totalDeliveryFees).toLocaleString('en-IN')} in delivery/surge fees across ${deliveryFeeItems.length} orders.`,
            relevance: 70,
            color: { bg: '#FDCB6E', fg: '#2d2d2d' },
        });
    }

    // Monthly spending velocity — only consider active months (5+ orders)
    const activeMonthlyAmounts = [...monthlyMap.entries()]
        .filter(([key]) => (monthOrderCounts.get(key) || 0) >= 5)
        .map(([, m]) => m.amount);
    const maxMonth = activeMonthlyAmounts.length ? Math.max(...activeMonthlyAmounts) : 0;
    const minMonth = activeMonthlyAmounts.filter((a) => a > 0).length ? Math.min(...activeMonthlyAmounts.filter((a) => a > 0)) : 0;
    if (maxMonth > 0 && minMonth > 0) {
        const ratio = Math.round(maxMonth / minMonth);
        insights.push({
            key: 'monthly_range',
            category: 'trends',
            icon: '📉',
            bigNumber: `${ratio}x`,
            title: 'Monthly Spending Range',
            subtitle: `Your spending ranges from Rs ${Math.round(minMonth).toLocaleString('en-IN')} to Rs ${Math.round(maxMonth).toLocaleString('en-IN')} per month — a ${ratio}x difference.`,
            relevance: Math.min(70, Math.round(ratio * 5)),
            color: { bg: '#636E72', fg: '#fff' },
        });
    }

    // Sort insights by relevance
    insights.sort((a, b) => b.relevance - a.relevance);

    // ── 14. Actionables ──────────────────────────────────────────────────────
    const actionables: any[] = [];

    if (foodPct > 40) {
        actionables.push({
            icon: '🍳',
            title: 'Reduce food delivery dependency',
            description: `${Math.round(foodPct)}% of your spending goes to food delivery. Try meal prepping on weekends.`,
            metadata: `Rs ${Math.round(foodDeliveryTotal / 1000)}K total`,
            score: 85,
        });
    }

    if (top3Pct > 70) {
        actionables.push({
            icon: '🔄',
            title: 'Explore alternative merchants',
            description: `Your top 3 merchants own ${Math.round(top3Pct)}% of your spend. Competitors often have new-user discounts.`,
            metadata: `${merchantLeaderboard.slice(0, 3).map((m) => m.name).join(', ')}`,
            score: 70,
        });
    }

    if (lateNightCount > invoices.length * 0.1) {
        actionables.push({
            icon: '🌙',
            title: 'Set a late-night ordering curfew',
            description: `${lateNightCount} late-night orders averaging Rs ${Math.round(lateNightTotal / lateNightCount)}. These are often impulse buys.`,
            metadata: `Rs ${Math.round(lateNightTotal / 1000)}K after 10 PM`,
            score: 75,
        });
    }

    if (smallOrders.length > invoices.length * 0.2) {
        actionables.push({
            icon: '📦',
            title: 'Batch your small orders',
            description: `${smallOrders.length} orders under Rs 200. Batching these with larger orders saves on delivery fees.`,
            metadata: `${((smallOrders.length / invoices.length) * 100).toFixed(0)}% of orders`,
            score: 65,
        });
    }

    if (driftPct > 20) {
        actionables.push({
            icon: '📊',
            title: 'Set a monthly spending budget',
            description: `Your ordering frequency increased ${Math.round(driftPct)}% recently. A budget can help maintain discipline.`,
            metadata: `${secondHalfRate.toFixed(1)} orders/month now`,
            score: 80,
        });
    }

    actionables.sort((a, b) => b.score - a.score);

    // ── Assemble ─────────────────────────────────────────────────────────────
    const dashboardData = {
        generatedAt: new Date().toISOString(),
        userName: creds.userName || creds.email || 'User',
        overview,
        healthScore: { ...healthScore, grade: scoreGrade },
        spendingPersonality: personality,
        yourNumbers,
        realWorldEquivalents,
        categoryBreakdown,
        merchantLeaderboard,
        weekdayPattern,
        hourlyPattern,
        monthlyHeatmap,
        whatIfScenarios,
        insights,
        topItems,
        actionables,
    };

    // Write JSON
    const jsonPath = path.join(process.cwd(), 'spending-dashboard-data.json');
    fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2));
    logger.info(`Data written to ${jsonPath}`);

    // Also embed into HTML if it exists
    const htmlPath = path.join(process.cwd(), 'spending-dashboard.html');
    if (fs.existsSync(htmlPath)) {
        let html = fs.readFileSync(htmlPath, 'utf-8');
        const marker = '/* __EMBEDDED_DATA__ */';
        if (html.includes(marker)) {
            html = html.replace(
                new RegExp(`${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
                `${marker}\n    window.__DASHBOARD_DATA__ = ${JSON.stringify(dashboardData)};\n    ${marker}`
            );
            fs.writeFileSync(htmlPath, html);
            logger.info(`Embedded data into ${htmlPath}`);
        }
    }

    logger.info('Done!');
    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
