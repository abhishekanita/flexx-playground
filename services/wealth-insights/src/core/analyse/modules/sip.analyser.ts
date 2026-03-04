/**
 * SIP Analyser — detects SIP patterns, frequency, regularity, and missed months.
 *
 * Algorithm:
 *   1. For each active folio, collect Purchase/SIP transactions sorted by date
 *   2. Compute intervals between consecutive purchases
 *   3. Detect SIP pattern: 3+ txns with median interval 25-35d and amounts within 20% of median
 *   4. Classify frequency: Monthly (25-35d), Weekly (5-9d), Quarterly (80-100d), Irregular
 *   5. Count missed months: unique months with no SIP vs expected months in range
 *   6. regularityScore = round((1 - missedMonths/expectedMonths) * 100)
 *   7. isLumpsumOnly = true if no SIP schemes detected
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { SIPAnalysisResult, SIPScheme } from '@/types/analysis';

type Folio = MFDetailedStatementData['folios'][number];
type Transaction = Folio['transactions'][number];

const PURCHASE_TYPES = new Set(['Purchase', 'SIP', 'Switch In', 'STP In']);

export class SIPAnalyser {
    static analyse(data: MFDetailedStatementData): SIPAnalysisResult {
        const sipSchemes: SIPScheme[] = [];

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const result = this.detectSIP(folio);
            if (result) sipSchemes.push(result);
        }

        const totalSIPInvested = sipSchemes.reduce((s, sc) => s + sc.totalSIPInvested, 0);

        return {
            sipSchemes,
            isLumpsumOnly: sipSchemes.length === 0,
            totalSIPInvested,
        };
    }

    private static detectSIP(folio: Folio): SIPScheme | null {
        // Collect purchase transactions sorted by date
        const purchases = folio.transactions
            .filter((tx) => PURCHASE_TYPES.has(tx.type) && tx.amount !== null && tx.amount > 0)
            .sort((a, b) => a.date.localeCompare(b.date));

        if (purchases.length < 3) return null;

        // Compute intervals between consecutive purchases (in days)
        const intervals: number[] = [];
        for (let i = 1; i < purchases.length; i++) {
            const d1 = new Date(purchases[i - 1].date);
            const d2 = new Date(purchases[i].date);
            const days = Math.round((d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
            if (days > 0) intervals.push(days);
        }

        if (intervals.length < 2) return null;

        // Compute median interval
        const sorted = [...intervals].sort((a, b) => a - b);
        const medianInterval = sorted[Math.floor(sorted.length / 2)];

        // Compute median amount
        const amounts = purchases.map((tx) => tx.amount!);
        const sortedAmounts = [...amounts].sort((a, b) => a - b);
        const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];

        // Check SIP pattern: amounts within 20% of median
        if (medianAmount <= 0) return null;
        const amountsWithin20Pct = amounts.filter(
            (a) => Math.abs(a - medianAmount) / medianAmount <= 0.20,
        );
        const isSIPPattern = amountsWithin20Pct.length >= 3;

        if (!isSIPPattern) return null;

        // Classify frequency
        const frequency = this.classifyFrequency(medianInterval);

        // Count missed months
        const firstDate = new Date(purchases[0].date);
        const lastDate = new Date(purchases[purchases.length - 1].date);
        const { missedMonths, expectedMonths } = this.countMissedMonths(
            firstDate, lastDate, purchases, frequency,
        );

        const regularityScore = expectedMonths > 0
            ? Math.round((1 - missedMonths / expectedMonths) * 100)
            : 100;

        const totalSIPInvested = amounts.reduce((s, a) => s + a, 0);

        return {
            schemeName: folio.scheme.current_name,
            sipAmount: Math.round(medianAmount),
            sipFrequency: frequency,
            missedMonths,
            regularityScore: Math.max(0, Math.min(100, regularityScore)),
            totalSIPInvested: Math.round(totalSIPInvested),
            currentValue: Math.round(folio.snapshot.marketValue),
        };
    }

    private static classifyFrequency(medianInterval: number): SIPScheme['sipFrequency'] {
        if (medianInterval >= 5 && medianInterval <= 9) return 'Weekly';
        if (medianInterval >= 25 && medianInterval <= 35) return 'Monthly';
        if (medianInterval >= 80 && medianInterval <= 100) return 'Quarterly';
        return 'Irregular';
    }

    private static countMissedMonths(
        first: Date,
        last: Date,
        purchases: Transaction[],
        frequency: SIPScheme['sipFrequency'],
    ): { missedMonths: number; expectedMonths: number } {
        if (frequency !== 'Monthly') {
            // For non-monthly SIPs, skip missed month calculation
            return { missedMonths: 0, expectedMonths: 0 };
        }

        // Build set of YYYY-MM strings where purchases occurred
        const monthsWithSIP = new Set<string>();
        for (const tx of purchases) {
            monthsWithSIP.add(tx.date.slice(0, 7)); // "YYYY-MM"
        }

        // Count expected months in range
        let expectedMonths = 0;
        const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
        const end = new Date(last.getFullYear(), last.getMonth(), 1);

        while (cursor <= end) {
            expectedMonths++;
            cursor.setMonth(cursor.getMonth() + 1);
        }

        const missedMonths = Math.max(0, expectedMonths - monthsWithSIP.size);

        return { missedMonths, expectedMonths };
    }
}
