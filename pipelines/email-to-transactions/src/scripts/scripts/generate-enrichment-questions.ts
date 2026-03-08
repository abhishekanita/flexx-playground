import '@/loaders/logger';
import { databaseLoader } from '@/loaders/database';
import { TransactionModel } from '@/schema/transaction.schema';
import { EnrichmentQuestionModel, EnrichmentQuestionType, EnrichmentQuestionStatus } from '@/schema/enrichment-question.schema';
import { TransactionFolderModel, FolderType } from '@/schema/transaction-folder.schema';
import { v4 as uuid } from 'uuid';

const USER_ID = '69a4500be8ae76d9b62883f2';

interface TxnLean {
    _id: string;
    amount: number;
    merchant_name?: string;
    raw_narration?: string;
    upi_receiver_vpa?: string;
    channel?: string;
    account_last4?: string;
    tx_date: Date;
    category: string;
    type: string;
    folder_ids?: string[];
}

// ============================================================
// Helpers
// ============================================================

const CATEGORY_HINTS: Record<string, string[]> = {
    food: ['restaurant', 'food_delivery'], cafe: ['restaurant'], bar: ['restaurant'],
    bistro: ['restaurant'], kitchen: ['restaurant', 'food_delivery'],
    pharmacy: ['pharmacy', 'medical'], hospital: ['medical'], clinic: ['medical'],
    hotel: ['hotel'], cab: ['cab_ride'], auto: ['cab_ride', 'fuel'],
    petrol: ['fuel'], gym: ['subscription'], salon: ['other'],
    laundry: ['other'], parking: ['other'], toll: ['other'],
    apple: ['subscription', 'electronics'], google: ['subscription'],
};

function suggestCategories(merchantName: string, narration: string): string[] {
    const text = `${merchantName} ${narration}`.toLowerCase();
    const suggestions = new Set<string>();
    for (const [keyword, cats] of Object.entries(CATEGORY_HINTS)) {
        if (text.includes(keyword)) cats.forEach(c => suggestions.add(c));
    }
    return suggestions.size > 0 ? [...suggestions] : ['restaurant', 'ecommerce', 'subscription', 'other', 'transfer'];
}

function isLikelyPerson(name: string): boolean {
    if (!name) return false;
    return name.length <= 15 && /^[A-Z\s]+$/.test(name) && !/LTD|PVT|INC|LLC|STORE|SHOP/i.test(name);
}

function daysBetween(a: Date, b: Date): number {
    return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function makeContext(txns: TxnLean[], extra: Record<string, any> = {}) {
    const amounts = txns.map(t => t.amount);
    const dates = txns.map(t => new Date(t.tx_date));
    return {
        transactionIds: txns.map(t => t._id.toString()),
        sampleNarrations: txns.slice(0, 4).map(t => t.raw_narration || ''),
        sampleMerchants: [...new Set(txns.map(t => t.merchant_name).filter(Boolean))].slice(0, 5) as string[],
        totalAmount: txns.reduce((s, t) => s + t.amount, 0),
        txnCount: txns.length,
        amountRange: { min: Math.min(...amounts), max: Math.max(...amounts) },
        dateRange: {
            from: new Date(Math.min(...dates.map(d => d.getTime()))),
            to: new Date(Math.max(...dates.map(d => d.getTime()))),
        },
        channels: [...new Set(txns.map(t => t.channel || 'UNKNOWN'))],
        categories: [...new Set(txns.map(t => t.category))],
        ...extra,
    };
}

function fmtAmount(n: number): string {
    return Math.round(n).toLocaleString('en-IN');
}

// ============================================================
// Main
// ============================================================

(async () => {
    await databaseLoader();

    const batchId = uuid().slice(0, 8);
    console.log(`Batch ID: ${batchId}\n`);

    // Load all debit transactions (not just unknowns — we need all for folder detection)
    const allDebits = await TransactionModel.find({
        user_id: USER_ID,
        type: 'debit',
        tx_date: { $gte: new Date('2020-01-01') },
    }).sort({ tx_date: -1 }).lean() as unknown as TxnLean[];

    const unknowns = allDebits.filter(t => t.category === 'unknown');
    console.log(`All debits: ${allDebits.length}, Unknowns: ${unknowns.length}`);

    const questions: any[] = [];

    // ============================================================
    // LAYER 1: Transaction-level enrichment (unknown category)
    // ============================================================

    // --- 1a: Group unknowns by merchant name ---
    const merchantGroups = new Map<string, TxnLean[]>();
    for (const t of unknowns) {
        const key = t.merchant_name || '(no_merchant)';
        if (!merchantGroups.has(key)) merchantGroups.set(key, []);
        merchantGroups.get(key)!.push(t);
    }

    for (const [merchant, txns] of merchantGroups) {
        if (merchant === '(no_merchant)') continue;

        if (isLikelyPerson(merchant)) {
            questions.push({
                user_id: USER_ID, batch_id: batchId,
                type: EnrichmentQuestionType.TransferOrSpending,
                status: EnrichmentQuestionStatus.Pending,
                question: `"${merchant}" — ${txns.length} txn(s), Rs ${fmtAmount(txns.reduce((s, t) => s + t.amount, 0))}. Is this a person (transfer) or a business?`,
                context: makeContext(txns, { merchantName: merchant }),
                suggestions: ['transfer', 'restaurant', 'other'],
                impact: txns.length,
            });
        } else {
            questions.push({
                user_id: USER_ID, batch_id: batchId,
                type: EnrichmentQuestionType.IdentifyCategory,
                status: EnrichmentQuestionStatus.Pending,
                question: `"${merchant}" — ${txns.length} txn(s), Rs ${fmtAmount(txns.reduce((s, t) => s + t.amount, 0))}. What category?`,
                context: makeContext(txns, { merchantName: merchant }),
                suggestions: suggestCategories(merchant, txns[0].raw_narration || ''),
                impact: txns.length,
            });
        }
    }

    // --- 1b: Group no-merchant unknowns by VPA ---
    const noMerchant = merchantGroups.get('(no_merchant)') || [];
    const vpaGroups = new Map<string, TxnLean[]>();
    for (const t of noMerchant) {
        if (t.upi_receiver_vpa) {
            const vpa = t.upi_receiver_vpa;
            if (!vpaGroups.has(vpa)) vpaGroups.set(vpa, []);
            vpaGroups.get(vpa)!.push(t);
        }
    }

    for (const [vpa, txns] of vpaGroups) {
        questions.push({
            user_id: USER_ID, batch_id: batchId,
            type: EnrichmentQuestionType.IdentifyVpa,
            status: EnrichmentQuestionStatus.Pending,
            question: `VPA "${vpa}" — ${txns.length} txn(s), Rs ${fmtAmount(txns.reduce((s, t) => s + t.amount, 0))}. What business/person?`,
            context: makeContext(txns, { vpa }),
            suggestions: [],
            impact: txns.length,
        });
    }

    // --- 1c: Merchant name normalization ---
    const merchantNames = [...merchantGroups.keys()].filter(k => k !== '(no_merchant)');
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mergesSeen = new Set<string>();

    for (let i = 0; i < merchantNames.length; i++) {
        for (let j = i + 1; j < merchantNames.length; j++) {
            const a = merchantNames[i], b = merchantNames[j];
            const na = normalize(a), nb = normalize(b);
            if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) {
                const key = [a, b].sort().join('|');
                if (mergesSeen.has(key)) continue;
                mergesSeen.add(key);
                const allTxns = [...(merchantGroups.get(a) || []), ...(merchantGroups.get(b) || [])];
                questions.push({
                    user_id: USER_ID, batch_id: batchId,
                    type: EnrichmentQuestionType.MergeMerchants,
                    status: EnrichmentQuestionStatus.Pending,
                    question: `"${a}" (${merchantGroups.get(a)?.length || 0}) and "${b}" (${merchantGroups.get(b)?.length || 0}) — same merchant? What name?`,
                    context: makeContext(allTxns, { merchantName: a }),
                    suggestions: [a, b],
                    impact: allTxns.length,
                });
            }
        }
    }

    // --- 1d: High-value individual unknowns not covered above ---
    const covered = new Set(questions.flatMap(q => q.context.transactionIds));
    const uncoveredHigh = unknowns.filter(t => !covered.has(t._id.toString()) && t.amount >= 1000);
    for (const t of uncoveredHigh.slice(0, 20)) {
        questions.push({
            user_id: USER_ID, batch_id: batchId,
            type: EnrichmentQuestionType.Freeform,
            status: EnrichmentQuestionStatus.Pending,
            question: `Rs ${fmtAmount(t.amount)} on ${new Date(t.tx_date).toLocaleDateString('en-IN')} via ${t.channel || '?'}. "${(t.raw_narration || '').substring(0, 80)}". What is this?`,
            context: makeContext([t]),
            suggestions: suggestCategories(t.merchant_name || '', t.raw_narration || ''),
            impact: 1,
        });
    }

    // ============================================================
    // LAYER 2: Recurring pattern detection (across ALL debits)
    // ============================================================

    // --- 2a: Monthly recurring (same amount ± 5% to same merchant/VPA) ---
    const recurringCandidates = new Map<string, TxnLean[]>();
    for (const t of allDebits) {
        // Key by rounded amount + merchant or VPA
        const target = t.merchant_name || t.upi_receiver_vpa || '';
        if (!target) continue;
        const roundedAmt = Math.round(t.amount / 50) * 50; // bucket by 50s
        const key = `${roundedAmt}|${target.toLowerCase()}`;
        if (!recurringCandidates.has(key)) recurringCandidates.set(key, []);
        recurringCandidates.get(key)!.push(t);
    }

    for (const [key, txns] of recurringCandidates) {
        if (txns.length < 3) continue;

        const sorted = [...txns].sort((a, b) => new Date(a.tx_date).getTime() - new Date(b.tx_date).getTime());
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
            intervals.push(daysBetween(new Date(sorted[i].tx_date), new Date(sorted[i - 1].tx_date)));
        }
        const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;

        // Monthly: 20-40 day intervals
        if (avgInterval < 20 || avgInterval > 40) continue;

        const [, target] = key.split('|');
        const amount = txns[0].amount;
        const allUnknown = txns.every(t => t.category === 'unknown');
        const allSameCategory = new Set(txns.map(t => t.category)).size === 1;

        // If already categorized consistently, suggest a rule instead
        if (!allUnknown && allSameCategory && txns[0].category !== 'unknown') {
            questions.push({
                user_id: USER_ID, batch_id: batchId,
                type: EnrichmentQuestionType.SuggestRule,
                status: EnrichmentQuestionStatus.Pending,
                question: `Rs ~${fmtAmount(amount)} monthly to "${target}" (${txns.length}x, category: ${txns[0].category}). Create an auto-tag rule?`,
                context: makeContext(txns, { detectedPattern: 'monthly_recurring' }),
                suggestions: ['subscription', 'emi', 'rent', 'insurance'],
                impact: txns.length,
            });
        } else if (allUnknown) {
            // Unknown recurring — is this rent? subscription? EMI?
            questions.push({
                user_id: USER_ID, batch_id: batchId,
                type: EnrichmentQuestionType.IdentifyRecurring,
                status: EnrichmentQuestionStatus.Pending,
                question: `Rs ~${fmtAmount(amount)} charged ${txns.length}x monthly to "${target}". What is this? (rent/subscription/EMI/insurance?)`,
                context: makeContext(txns, { merchantName: target, detectedPattern: 'monthly_recurring' }),
                suggestions: ['rent', 'subscription', 'emi', 'insurance', 'transfer'],
                impact: txns.length,
            });
        }
    }

    // ============================================================
    // LAYER 3: Folder detection — group by life context
    // ============================================================

    // --- 3a: Trip detection (flights + hotels + cabs clustered in a date window) ---
    const travelCategories = new Set(['flight', 'hotel', 'train']);
    const travelTxns = allDebits.filter(t => travelCategories.has(t.category));

    // Cluster travel transactions within 7-day windows
    if (travelTxns.length >= 2) {
        const sorted = [...travelTxns].sort((a, b) => new Date(a.tx_date).getTime() - new Date(b.tx_date).getTime());
        let cluster: TxnLean[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
            const gap = daysBetween(new Date(sorted[i].tx_date), new Date(sorted[i - 1].tx_date));
            if (gap <= 7) {
                cluster.push(sorted[i]);
            } else {
                if (cluster.length >= 2) await emitTripQuestion(cluster);
                cluster = [sorted[i]];
            }
        }
        if (cluster.length >= 2) await emitTripQuestion(cluster);
    }

    async function emitTripQuestion(cluster: TxnLean[]) {
        const dates = cluster.map(t => new Date(t.tx_date));
        const from = new Date(Math.min(...dates.map(d => d.getTime())));
        const to = new Date(Math.max(...dates.map(d => d.getTime())));

        // Also grab cabs/food in the same date window (trip-related spending)
        const tripWindow = allDebits.filter(t => {
            const d = new Date(t.tx_date);
            return d >= from && d <= new Date(to.getTime() + 2 * 24 * 60 * 60 * 1000) &&
                   ['cab_ride', 'food_delivery', 'restaurant'].includes(t.category);
        });
        const allTrip = [...cluster, ...tripWindow];
        const total = allTrip.reduce((s, t) => s + t.amount, 0);
        const cats = [...new Set(allTrip.map(t => t.category))];

        // Extract destination clues from context data
        const clusterTxnDocs = await TransactionModel.find({
            _id: { $in: allTrip.map(t => t._id) },
        }).lean();

        const destinations: string[] = [];
        const locations: string[] = [];

        for (const doc of clusterTxnDocs) {
            const ctx = (doc as any).context;
            // Flight routes — use the clean route string, not segment from/to
            if (ctx?.flight?.route) destinations.push(ctx.flight.route);
            if (ctx?.flight?.segments) {
                for (const seg of ctx.flight.segments) {
                    if (seg.airline) destinations.push(seg.airline);
                }
            }

            // Uber pickup/dropoff locations (extract city/area)
            if (ctx?.uber?.pickup_location) {
                const loc = ctx.uber.pickup_location;
                // Extract city from address like "..., Gurugram, Haryana 122011, India"
                const cityMatch = loc.match(/(Gurugram|Gurgaon|Delhi|Mumbai|Bengaluru|Bangalore|Kolkata|Chennai|Hyderabad|Pune|Jaipur|Goa|Lucknow|Chandigarh|Ahmedabad|Kochi|Varanasi)/i);
                if (cityMatch) locations.push(cityMatch[1]);
            }
            if (ctx?.uber?.drop_location) {
                const loc = ctx.uber.drop_location;
                const cityMatch = loc.match(/(Gurugram|Gurgaon|Delhi|Mumbai|Bengaluru|Bangalore|Kolkata|Chennai|Hyderabad|Pune|Jaipur|Goa|Lucknow|Chandigarh|Ahmedabad|Kochi|Varanasi)/i);
                if (cityMatch) locations.push(cityMatch[1]);
            }
        }

        // Hotel names
        const hotelTxns = cluster.filter(t => t.category === 'hotel');
        for (const ht of hotelTxns) {
            if (ht.merchant_name) destinations.push(ht.merchant_name);
        }

        const uniqueLocations = [...new Set(locations)];
        const uniqueDests = [...new Set(destinations)].filter(d => d.length > 1);

        let clueStr = '';
        if (uniqueDests.length > 0 || uniqueLocations.length > 0) {
            const parts: string[] = [];
            if (uniqueDests.length > 0) parts.push(uniqueDests.join(', '));
            if (uniqueLocations.length > 0) parts.push(`Cabs in: ${uniqueLocations.join(', ')}`);
            clueStr = ` ${parts.join('. ')}.`;
        }

        const monthLabel = from.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

        questions.push({
            user_id: USER_ID, batch_id: batchId,
            type: EnrichmentQuestionType.SuggestTripFolder,
            status: EnrichmentQuestionStatus.Pending,
            question: `${cats.join(' + ')} cluster: ${allTrip.length} txns, Rs ${fmtAmount(total)} (${from.toLocaleDateString('en-IN')} – ${to.toLocaleDateString('en-IN')}).${clueStr} Is this a trip? What for?`,
            context: makeContext(allTrip, { detectedPattern: 'trip_cluster' }),
            suggestions: [`Trip ${monthLabel}`, 'Work Travel', 'Wedding', 'Family Trip'],
            impact: allTrip.length,
        });
    }

    // --- 3b: Family transfers — recurring transfers to same person ---
    const transferTxns = allDebits.filter(t => t.category === 'transfer');
    const transferTargets = new Map<string, TxnLean[]>();
    for (const t of transferTxns) {
        const target = t.merchant_name || t.upi_receiver_vpa || '';
        if (!target || target.length < 2) continue;
        if (!transferTargets.has(target)) transferTargets.set(target, []);
        transferTargets.get(target)!.push(t);
    }

    for (const [target, txns] of transferTargets) {
        if (txns.length < 3) continue;
        const total = txns.reduce((s, t) => s + t.amount, 0);

        // Check if it's person-like (not a business VPA or known merchant)
        // Skip known merchants and self-transfers
        const knownMerchants = /SWIGGY|ZOMATO|UBER|BLINKIT|ZEPTO|AMAZON|FLIPKART|CRED|GROWW|NETFLIX|APPLE|IRCTC|BIKANERV|DAALCHINI|MAKEMYTR|AIRBNB/i;
        const selfPatterns = /^ABHISHEK$|7838237658/i;
        if (knownMerchants.test(target) || selfPatterns.test(target)) continue;
        const isPerson = isLikelyPerson(target) || /@ok|@ybl|@paytm|@ibl/i.test(target);
        if (!isPerson) continue;

        questions.push({
            user_id: USER_ID, batch_id: batchId,
            type: EnrichmentQuestionType.SuggestFamilyFolder,
            status: EnrichmentQuestionStatus.Pending,
            question: `${txns.length} transfers to "${target}", Rs ${fmtAmount(total)} total. Is this family? Who?`,
            context: makeContext(txns, { merchantName: target, detectedPattern: 'recurring_transfer_person' }),
            suggestions: ['Family', 'Friends', 'Staff/Help', 'Other'],
            impact: txns.length,
        });
    }

    // --- 3c: Create default folders if they don't exist ---
    const existingFolders = await TransactionFolderModel.find({ user_id: USER_ID, isDefault: true }).lean();
    const existingTypes = new Set(existingFolders.map((f: any) => f.type));

    const defaults = [
        {
            type: FolderType.Lifestyle, name: 'Lifestyle',
            icon: '🛒',
            rules: [{ field: 'category', op: 'in', value: ['food_delivery', 'groceries', 'cab_ride', 'restaurant', 'ott', 'subscription'] }],
        },
        {
            type: FolderType.Bills, name: 'Bills & EMIs',
            icon: '📄',
            rules: [{ field: 'category', op: 'in', value: ['rent', 'electricity', 'broadband', 'mobile_recharge', 'emi', 'insurance', 'credit_card_bill'] }],
        },
        {
            type: FolderType.Family, name: 'Family',
            icon: '👨‍👩‍👧',
            rules: [], // populated via enrichment answers
        },
        {
            type: FolderType.Investments, name: 'Investments',
            icon: '📈',
            rules: [{ field: 'category', op: 'in', value: ['investment'] }],
        },
        {
            type: FolderType.Work, name: 'Work',
            icon: '💼',
            rules: [], // user-tagged
        },
    ];

    const foldersToCreate = defaults.filter(d => !existingTypes.has(d.type));
    if (foldersToCreate.length > 0) {
        await TransactionFolderModel.insertMany(foldersToCreate.map(f => ({
            user_id: USER_ID,
            name: f.name,
            type: f.type,
            icon: f.icon,
            rules: f.rules,
            includedTxnIds: [],
            excludedTxnIds: [],
            isDefault: true,
            isArchived: false,
        })));
        console.log(`Created ${foldersToCreate.length} default folders`);
    }

    // ============================================================
    // Dedup & save
    // ============================================================

    // Sort by impact
    questions.sort((a, b) => b.impact - a.impact);

    // Remove duplicate questions covering the same txn IDs
    const seenTxnSets = new Set<string>();
    const deduped = questions.filter(q => {
        const key = q.type + ':' + q.context.transactionIds.sort().join(',');
        if (seenTxnSets.has(key)) return false;
        seenTxnSets.add(key);
        return true;
    });

    // Summary
    console.log(`\nGenerated ${deduped.length} enrichment questions:`);
    const byType: Record<string, number> = {};
    for (const q of deduped) byType[q.type] = (byType[q.type] || 0) + 1;
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }

    console.log(`\nTop 20 by impact:`);
    for (const q of deduped.slice(0, 20)) {
        console.log(`  [${q.type}] (${q.impact} txns) ${q.question}`);
    }

    // Clear old batch and save
    await EnrichmentQuestionModel.deleteMany({ user_id: USER_ID });
    if (deduped.length > 0) {
        await EnrichmentQuestionModel.insertMany(deduped);
        console.log(`\nSaved ${deduped.length} questions (batch: ${batchId})`);
    }

    // Write JSON for manual review / AI consumption
    const fs = require('fs');
    const outPath = require('path').join(__dirname, '..', '..', '..', 'enrichment-questions.json');
    fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2));
    console.log(`Written to ${outPath}`);

    process.exit(0);
})();
