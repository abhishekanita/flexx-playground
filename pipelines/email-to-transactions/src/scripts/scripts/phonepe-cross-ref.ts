import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import mongoose from 'mongoose';

(async () => {
    await databaseLoader();
    const txnCol = mongoose.connection.db.collection('transactions');

    const allTxns = await txnCol.find({ type: 'debit', amount: { $gt: 0 } }).toArray();
    const NON_SPENDING = new Set(['transfer', 'atm_withdrawal', 'investment', 'salary', 'credit_card_bill', 'rent']);
    const spending = allTxns.filter(t => !NON_SPENDING.has(t.category || 'unknown') && !t.sub_category?.includes('lite_load'));

    // ════════════════════════════════════════════════
    // 1. LATE BOOKING PREMIUM (Flights)
    // ════════════════════════════════════════════════
    const flights = spending.filter(t => t.category === 'flight');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  LATE BOOKING PREMIUM');
    console.log('═══════════════════════════════════════════════════════\n');

    for (const f of flights) {
        const ctx = f.context as any;
        const flight = ctx?.flight;
        if (!flight) continue;

        const bookedOn = flight.booked_on ? new Date(flight.booked_on) : null;
        const travelDate = flight.travel_date ? new Date(flight.travel_date) : null;

        let leadDays = 0;
        if (bookedOn && travelDate && !isNaN(bookedOn.getTime()) && !isNaN(travelDate.getTime())) {
            leadDays = Math.round((travelDate.getTime() - bookedOn.getTime()) / (1000 * 60 * 60 * 24));
        } else {
            // Try to infer from tx_date as booking date
            const txDate = new Date(f.tx_date);
            if (travelDate && !isNaN(travelDate.getTime())) {
                leadDays = Math.round((travelDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24));
            }
        }

        const route = flight.route || '';
        const amount = f.amount;

        // Model: price at 60 days = base price. Every 10 days closer adds 10%.
        // So booking at 60 days = 1.0x, at 50 days = 1.1x, at 40 days = 1.2x, etc.
        // At 0 days = 1.6x (last minute)
        const daysFromOptimal = Math.max(0, 60 - leadDays);
        const premiumMultiplier = 1 + (daysFromOptimal / 10) * 0.1;
        const estimatedOptimalPrice = Math.round(amount / premiumMultiplier);
        const premiumPaid = amount - estimatedOptimalPrice;
        const premiumPct = Math.round((premiumMultiplier - 1) * 100);

        console.log(`  ${route || 'Flight'} | Rs.${Math.round(amount).toLocaleString('en-IN')}`);
        console.log(`    Booked ${leadDays} days before travel`);
        if (leadDays < 60) {
            console.log(`    Estimated optimal price (60-day advance): Rs.${estimatedOptimalPrice.toLocaleString('en-IN')}`);
            console.log(`    Late booking premium: Rs.${premiumPaid.toLocaleString('en-IN')} (+${premiumPct}%)`);
        } else {
            console.log(`    Great! Booked early enough — no premium.`);
        }
        console.log('');
    }

    const totalFlightSpend = flights.reduce((s, t) => s + t.amount, 0);
    let totalFlightPremium = 0;
    for (const f of flights) {
        const ctx = f.context as any;
        const flight = ctx?.flight;
        const travelDate = flight?.travel_date ? new Date(flight.travel_date) : null;
        const txDate = new Date(f.tx_date);
        let leadDays = 0;
        if (travelDate && !isNaN(travelDate.getTime())) {
            const bookedOn = flight?.booked_on ? new Date(flight.booked_on) : txDate;
            leadDays = Math.round((travelDate.getTime() - bookedOn.getTime()) / (1000 * 60 * 60 * 24));
        }
        const daysFromOptimal = Math.max(0, 60 - leadDays);
        const multiplier = 1 + (daysFromOptimal / 10) * 0.1;
        totalFlightPremium += f.amount - Math.round(f.amount / multiplier);
    }
    console.log(`  TOTAL: Rs.${Math.round(totalFlightSpend).toLocaleString('en-IN')} on ${flights.length} flights`);
    console.log(`  Estimated late booking premium: Rs.${Math.round(totalFlightPremium).toLocaleString('en-IN')}`);
    console.log(`  If all booked 2 months early, you'd save ~${Math.round(totalFlightPremium / totalFlightSpend * 100)}%`);

    // ════════════════════════════════════════════════
    // 2. ACTIONABLE LIFESTYLE SWAPS
    // ════════════════════════════════════════════════
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('  ACTIONABLE LIFESTYLE UPGRADES');
    console.log('═══════════════════════════════════════════════════════');

    // ── Swiggy analysis ──
    const swiggy = spending.filter(t => (t.merchant_name || '').toLowerCase().includes('swiggy'));
    const swiggyFood = swiggy.filter(t => t.category === 'food_delivery');
    const swiggyInstamart = swiggy.filter(t => t.category === 'groceries');
    const swiggyTotal = swiggy.reduce((s, t) => s + t.amount, 0);
    const swiggyMonths = new Set(swiggy.map(t => {
        const d = new Date(t.tx_date);
        return `${d.getFullYear()}-${d.getMonth()}`;
    })).size;
    const swiggyPerMonth = swiggyTotal / swiggyMonths;

    let totalPlatformFee = 0, totalDeliveryFee = 0, totalPackaging = 0;
    for (const t of swiggy) {
        const ctx = t.context as any;
        if (ctx?.swiggy) {
            totalPlatformFee += ctx.swiggy.platform_fee || 0;
            totalDeliveryFee += ctx.swiggy.delivery_fee || 0;
        }
    }

    console.log('\n  ── SWIGGY HDFC CREDIT CARD ──');
    console.log(`  Your Swiggy spend: Rs.${Math.round(swiggyTotal).toLocaleString('en-IN')} (Rs.${Math.round(swiggyPerMonth).toLocaleString('en-IN')}/month)`);
    const swiggyHdfcCashback = Math.round(swiggyTotal * 0.10); // 10% cashback on Swiggy
    const swiggyHdfcAnnualFee = 500;
    const swiggyHdfcNet = swiggyHdfcCashback - swiggyHdfcAnnualFee;
    console.log(`  Swiggy HDFC card: 10% cashback on Swiggy orders`);
    console.log(`  Your cashback would be: Rs.${swiggyHdfcCashback.toLocaleString('en-IN')}/year`);
    console.log(`  Annual fee: Rs.${swiggyHdfcAnnualFee}`);
    console.log(`  Net savings: Rs.${swiggyHdfcNet.toLocaleString('en-IN')}/year`);
    console.log(`  ROI: ${Math.round(swiggyHdfcNet / swiggyHdfcAnnualFee * 100)}%`);

    console.log('\n  ── SWIGGY ONE MEMBERSHIP ──');
    const swiggyOneCost = 1499; // per year (approx)
    const deliveryFeeSaved = totalDeliveryFee;
    const platformFeeSaved = totalPlatformFee; // Swiggy One waives some platform fee too
    console.log(`  You paid in fees: Rs.${Math.round(totalDeliveryFee + totalPlatformFee).toLocaleString('en-IN')}`);
    console.log(`    Delivery: Rs.${Math.round(totalDeliveryFee).toLocaleString('en-IN')}`);
    console.log(`    Platform: Rs.${Math.round(totalPlatformFee).toLocaleString('en-IN')}`);
    console.log(`  Swiggy One cost: Rs.${swiggyOneCost}/year`);
    console.log(`  Saves: free delivery + reduced platform fee`);
    console.log(`  Net savings: Rs.${Math.round(deliveryFeeSaved + platformFeeSaved * 0.5 - swiggyOneCost).toLocaleString('en-IN')}/year`);

    // ── Uber analysis ──
    const uber = spending.filter(t => (t.merchant_name || '').toLowerCase().includes('uber'));
    const uberTotal = uber.reduce((s, t) => s + t.amount, 0);
    const uberMonths = new Set(uber.map(t => {
        const d = new Date(t.tx_date);
        return `${d.getFullYear()}-${d.getMonth()}`;
    })).size;
    const uberPerMonth = uberTotal / uberMonths;
    const uberRidesPerMonth = uber.length / uberMonths;

    console.log('\n  ── UBER ONE / UBER PASS ──');
    console.log(`  Your Uber spend: Rs.${Math.round(uberTotal).toLocaleString('en-IN')} (${uber.length} rides, Rs.${Math.round(uberPerMonth).toLocaleString('en-IN')}/month)`);
    console.log(`  Avg ${Math.round(uberRidesPerMonth)} rides/month`);
    const uberPassCost = 149; // per month
    const uberPassSavingsPct = 0.15; // ~15% savings on rides
    const uberPassMonthlySaving = Math.round(uberPerMonth * uberPassSavingsPct - uberPassCost);
    console.log(`  Uber Pass: Rs.${uberPassCost}/month → ~15% off rides`);
    console.log(`  Monthly savings: Rs.${Math.round(uberPerMonth * uberPassSavingsPct).toLocaleString('en-IN')} - Rs.${uberPassCost} = Rs.${uberPassMonthlySaving.toLocaleString('en-IN')}/month`);
    console.log(`  Annual savings: Rs.${(uberPassMonthlySaving * 12).toLocaleString('en-IN')}`);
    if (uberPassMonthlySaving > 0) {
        console.log(`  Verdict: WORTH IT — pays for itself with ${Math.ceil(uberPassCost / (uberPerMonth * uberPassSavingsPct) * uberRidesPerMonth)} rides/month`);
    } else {
        console.log(`  Verdict: NOT WORTH IT at current usage`);
    }

    // ── Netflix annual ──
    const netflix = spending.filter(t => /netflix/i.test(t.merchant_name || '') || /netflix/i.test(t.raw_narration || ''));
    const netflixTotal = netflix.reduce((s, t) => s + t.amount, 0);
    const netflixMonthly = netflix.length > 0 ? Math.round(netflixTotal / netflix.length) : 649;

    console.log('\n  ── NETFLIX: ANNUAL vs MONTHLY ──');
    console.log(`  Current: Rs.${netflixMonthly}/month × 12 = Rs.${netflixMonthly * 12}/year`);
    const netflixAnnual = Math.round(netflixMonthly * 12 * 0.83); // ~17% discount on annual
    console.log(`  Annual plan: Rs.${netflixAnnual}/year (~17% off)`);
    console.log(`  Savings: Rs.${netflixMonthly * 12 - netflixAnnual}/year`);

    // ── BluSmart / Cab optimization ──
    const blusmart = spending.filter(t => /blusmart|blu smart/i.test(t.merchant_name || '') || /blusmart|blu smart/i.test(t.raw_narration || ''));
    const blusmartTotal = blusmart.reduce((s, t) => s + t.amount, 0);
    const allCabs = spending.filter(t => t.category === 'cab_ride' || /uber|ola|blusmart|blu smart|rapido/i.test(t.merchant_name || '') || /uber|ola|blusmart/i.test(t.raw_narration || ''));
    const cabTotal = allCabs.reduce((s, t) => s + t.amount, 0);
    const cabMonths = new Set(allCabs.map(t => {
        const d = new Date(t.tx_date);
        return `${d.getFullYear()}-${d.getMonth()}`;
    })).size || 1;

    console.log('\n  ── CAB OPTIMIZATION ──');
    console.log(`  Total cab spend: Rs.${Math.round(cabTotal).toLocaleString('en-IN')} (${allCabs.length} rides)`);
    console.log(`  Uber: ${uber.length} rides (Rs.${Math.round(uberTotal).toLocaleString('en-IN')})`);
    console.log(`  BluSmart: ${blusmart.length} rides (Rs.${Math.round(blusmartTotal).toLocaleString('en-IN')})`);
    if (uber.length > 0 && blusmart.length > 0) {
        const uberAvg = Math.round(uberTotal / uber.length);
        const blusmartAvg = Math.round(blusmartTotal / blusmart.length);
        console.log(`  Avg Uber ride: Rs.${uberAvg} | Avg BluSmart ride: Rs.${blusmartAvg}`);
        if (blusmartAvg < uberAvg) {
            const savingPerRide = uberAvg - blusmartAvg;
            console.log(`  BluSmart is Rs.${savingPerRide} cheaper per ride on average`);
            console.log(`  If all Uber rides were BluSmart: save Rs.${savingPerRide * uber.length}/year`);
        }
    }

    // ── Instamart repeat items — bulk buying opportunity ──
    console.log('\n  ── BULK BUYING OPPORTUNITIES (Instamart repeat items) ──');
    const itemCounts: Record<string, { count: number; totalPrice: number; avgPrice: number }> = {};
    for (const t of spending) {
        const ctx = t.context as any;
        const items = ctx?.swiggy?.items || ctx?.zepto?.items || [];
        for (const item of items) {
            const name = (item.name || '').trim();
            if (!name || name.length < 3 || name.length > 50) continue;
            if (!itemCounts[name]) itemCounts[name] = { count: 0, totalPrice: 0, avgPrice: 0 };
            const qty = item.qty || 1;
            itemCounts[name].count += qty;
            itemCounts[name].totalPrice += (item.price || 0);
        }
    }
    for (const [, v] of Object.entries(itemCounts)) {
        v.avgPrice = v.count > 0 ? Math.round(v.totalPrice / v.count) : 0;
    }

    const repeatItems = Object.entries(itemCounts)
        .filter(([, v]) => v.count >= 10)
        .sort((a, b) => b[1].totalPrice - a[1].totalPrice)
        .slice(0, 10);

    for (const [name, v] of repeatItems) {
        const instamartPricePerUnit = v.avgPrice;
        // Estimate bulk discount: 20-30% cheaper in bulk/subscription
        const bulkSaving = Math.round(v.totalPrice * 0.25);
        console.log(`  ${name}`);
        console.log(`    Bought ${v.count}x at avg Rs.${instamartPricePerUnit}/unit = Rs.${Math.round(v.totalPrice)}`);
        console.log(`    Bulk/subscription saving (~25%): Rs.${bulkSaving}`);
    }

    // ── Small order tax ──
    console.log('\n  ── SMALL ORDER TAX ──');
    const smallOrders = swiggy.filter(t => t.amount < 200);
    const smallOrderFees = smallOrders.reduce((s, t) => {
        const ctx = t.context as any;
        return s + (ctx?.swiggy?.platform_fee || 0) + (ctx?.swiggy?.delivery_fee || 0);
    }, 0);
    const smallOrderFood = smallOrders.reduce((s, t) => {
        const ctx = t.context as any;
        return s + (ctx?.swiggy?.items || []).reduce((is: number, i: any) => is + (i.price || 0), 0);
    }, 0);
    console.log(`  ${smallOrders.length} Swiggy orders under Rs.200`);
    console.log(`  Food value: Rs.${Math.round(smallOrderFood)}`);
    console.log(`  Fees on these: Rs.${Math.round(smallOrderFees)}`);
    if (smallOrderFood > 0) {
        console.log(`  Fee-to-food ratio: ${Math.round(smallOrderFees / smallOrderFood * 100)}% (vs ~8% on larger orders)`);
    }
    console.log(`  Combining 2 small orders into 1 saves ~Rs.15-30 in platform fee each time`);
    console.log(`  Potential annual saving: Rs.${Math.round(smallOrders.length / 2 * 20)}`);

    // ════════════════════════════════════════════════
    // 3. TOTAL SAVINGS SUMMARY
    // ════════════════════════════════════════════════
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('  TOTAL SAVINGS IF YOU OPTIMIZED EVERYTHING');
    console.log('═══════════════════════════════════════════════════════');

    const savings = [
        { name: 'Swiggy HDFC Card (10% cashback)', amount: swiggyHdfcNet },
        { name: 'Swiggy One (save fees)', amount: Math.round(deliveryFeeSaved + platformFeeSaved * 0.5 - swiggyOneCost) },
        { name: 'Uber Pass', amount: Math.max(0, uberPassMonthlySaving * 12) },
        { name: 'Netflix Annual Plan', amount: netflixMonthly * 12 - netflixAnnual },
        { name: 'Book flights 2 months early', amount: totalFlightPremium },
        { name: 'Bulk buy repeat items', amount: repeatItems.reduce((s, [, v]) => s + Math.round(v.totalPrice * 0.25), 0) },
        { name: 'Batch small Swiggy orders', amount: Math.round(smallOrders.length / 2 * 20) },
    ];

    let totalSavings = 0;
    for (const s of savings) {
        if (s.amount > 0) {
            console.log(`  ${s.name}: Rs.${s.amount.toLocaleString('en-IN')}/year`);
            totalSavings += s.amount;
        }
    }
    console.log(`\n  TOTAL POTENTIAL SAVINGS: Rs.${totalSavings.toLocaleString('en-IN')}/year`);
    console.log(`  That's Rs.${Math.round(totalSavings / 12).toLocaleString('en-IN')}/month`);

    const totalSpending = spending.reduce((s, t) => s + t.amount, 0);
    console.log(`  = ${(totalSavings / totalSpending * 100).toFixed(1)}% of your total spending`);
    console.log(`\n  Same lifestyle. Same habits. Just smarter subscriptions + timing.`);

    process.exit(0);
})();
