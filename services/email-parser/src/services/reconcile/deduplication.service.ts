import { Types } from 'mongoose';
import { Transaction, ITransactionDoc } from '@/schema/transaction.schema';
import { merchantResolverService } from '@/services/reconcile/merchant-resolver.service';

export interface MatchCandidate {
    transaction: ITransactionDoc;
    matchScore: number;
    matchType: 'exact_amount_date' | 'fuzzy_amount_date' | 'amount_merchant' | 'amount_only';
}

export class DeduplicationService {
    /**
     * 4-pass matching algorithm to find existing transactions that match new data.
     * Ported from experiment-reconciliation.ts matchTransactions().
     *
     * Pass 1: Exact — amount ±Rs 1, same day, merchant match → 1.0
     * Pass 2: Fuzzy date — amount ±5%, ±1 day, merchant match → 0.8
     * Pass 3: Amount + merchant — ±Rs 1, ±3 days, merchant similarity > 0.3 → 0.5–0.8
     * Pass 4: Amount only — ±5%, ±3 days → 0.3 (flagged for review)
     */
    async findDuplicate(
        userId: Types.ObjectId,
        amount: number,
        date: Date,
        merchantName: string,
        externalId?: string,
        senderKey?: string
    ): Promise<MatchCandidate | null> {
        // Fast path: external ID match
        if (externalId && senderKey) {
            const exact = await Transaction.findOne({
                userId,
                'enrichment.orderId': externalId,
            });
            if (exact) {
                return { transaction: exact, matchScore: 1.0, matchType: 'exact_amount_date' };
            }
        }

        // Load candidate transactions in a ±3 day window
        const dateMin = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000);
        const dateMax = new Date(date.getTime() + 3 * 24 * 60 * 60 * 1000);

        const candidates = await Transaction.find({
            userId,
            date: { $gte: dateMin, $lte: dateMax },
            amount: { $gte: amount * 0.9, $lte: amount * 1.1 },
        });

        if (candidates.length === 0) return null;

        // Pass 1: Exact — amount ±Rs 1, same day, merchant match
        for (const txn of candidates) {
            if (Math.abs(txn.amount - amount) <= 1 && this.sameDay(txn.date, date)) {
                const sim = merchantResolverService.similarity(txn.merchantName, merchantName);
                if (sim >= 0.5) {
                    return { transaction: txn, matchScore: 1.0, matchType: 'exact_amount_date' };
                }
            }
        }

        // Pass 2: Fuzzy date — amount ±5%, ±1 day, merchant match
        for (const txn of candidates) {
            const amtDiff = Math.abs(txn.amount - amount) / Math.max(amount, 1);
            const dayDiff = this.dayDiff(txn.date, date);

            if (amtDiff <= 0.05 && dayDiff <= 1) {
                const sim = merchantResolverService.similarity(txn.merchantName, merchantName);
                if (sim >= 0.5) {
                    return { transaction: txn, matchScore: 0.8, matchType: 'fuzzy_amount_date' };
                }
            }
        }

        // Pass 3: Amount + merchant — ±Rs 1, ±3 days, merchant similarity > 0.3
        for (const txn of candidates) {
            if (Math.abs(txn.amount - amount) <= 1) {
                const sim = merchantResolverService.similarity(txn.merchantName, merchantName);
                if (sim > 0.3) {
                    const score = 0.5 + sim * 0.3;
                    return { transaction: txn, matchScore: score, matchType: 'amount_merchant' };
                }
            }
        }

        // Pass 4: Amount only — ±5%, ±3 days
        for (const txn of candidates) {
            const amtDiff = Math.abs(txn.amount - amount) / Math.max(amount, 1);
            if (amtDiff <= 0.05) {
                return { transaction: txn, matchScore: 0.3, matchType: 'amount_only' };
            }
        }

        return null;
    }

    private sameDay(a: Date, b: Date): boolean {
        return (
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate()
        );
    }

    private dayDiff(a: Date, b: Date): number {
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.abs(Math.round((a.getTime() - b.getTime()) / msPerDay));
    }
}

export const deduplicationService = new DeduplicationService();
