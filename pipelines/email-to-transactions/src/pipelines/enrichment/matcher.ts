import { createHash } from 'crypto';
import { transactionService } from '@/services/transactions/transaction.service';
import { ITransactionDoc } from '@/schema/transaction.schema';
import { EnrichmentAction } from '@/types/financial-data/transactions.enums';
import { NormalizedSignal } from './normalizers/normalizer.types';

export interface MatchResult {
    txn: ITransactionDoc;
    action: EnrichmentAction;
    confidence: number;
}

export function buildFingerprint(userId: string, amount: number, txDate: Date, accountLast4?: string): string {
    // Truncate to hour for fuzzy time matching
    const dateHour = new Date(txDate);
    dateHour.setMinutes(0, 0, 0);
    const input = `${userId}|${amount}|${dateHour.toISOString()}|${accountLast4 || ''}`;
    return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export async function findOrCreateTransaction(
    userId: string,
    signal: NormalizedSignal
): Promise<MatchResult> {
    // -- PASS 1: Strong match via UPI reference --
    if (signal.upiRef) {
        const existing = await transactionService.findByUpiRef(userId, signal.upiRef);
        if (existing) {
            return { txn: existing, action: EnrichmentAction.Enrich, confidence: 1.0 };
        }
    }

    // -- PASS 2: Strong match via NEFT UTR --
    if (signal.neftUtr) {
        const existing = await transactionService.findByNeftUtr(userId, signal.neftUtr);
        if (existing) {
            return { txn: existing, action: EnrichmentAction.Enrich, confidence: 1.0 };
        }
    }

    // -- PASS 3: Strong match via IMPS ref --
    if (signal.impsRef) {
        const existing = await transactionService.findByImpsRef(userId, signal.impsRef);
        if (existing) {
            return { txn: existing, action: EnrichmentAction.Enrich, confidence: 0.98 };
        }
    }

    // -- PASS 4: Merchant order ID match --
    if (signal.merchantOrderId) {
        const existing = await transactionService.findByMerchantOrderId(userId, signal.merchantOrderId);
        if (existing) {
            return { txn: existing, action: EnrichmentAction.Enrich, confidence: 0.97 };
        }
    }

    // -- PASS 5: Fingerprint dedup (same amount + same hour + same account) --
    const fingerprint = buildFingerprint(userId, signal.amount, signal.txDate, signal.accountLast4);
    const dupCheck = await transactionService.findByFingerprint(fingerprint);
    if (dupCheck) {
        return { txn: dupCheck, action: EnrichmentAction.Enrich, confidence: 0.85 };
    }

    // -- PASS 6: Amount + date window (±24h) + merchant/narration heuristic --
    // This catches invoice ↔ bank statement matches where one side lacks account_last4
    const candidates = await transactionService.findByAmountAndDateWindow(userId, signal.amount, signal.txDate, 24);
    if (candidates.length > 0) {
        // Score each candidate for merchant match
        const scored = candidates.map(c => {
            let score = 0.5; // base: same amount + date window

            // If merchant name appears in the other record's narration or vice versa
            const narration = (c.raw_narration || '').toLowerCase();
            const merchantName = (signal.merchantName || '').toLowerCase();
            const existingMerchant = (c.merchant_name || '').toLowerCase();

            if (merchantName && narration.includes(merchantName)) score += 0.3;
            else if (existingMerchant && signal.rawNarration?.toLowerCase().includes(existingMerchant)) score += 0.3;

            // Same type (debit/credit)
            if (c.type === signal.type) score += 0.1;

            return { txn: c, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const best = scored[0];

        if (best.score >= 0.8) {
            return { txn: best.txn, action: EnrichmentAction.Enrich, confidence: best.score };
        }
        if (best.score >= 0.6 && candidates.length === 1) {
            // Only one candidate at that amount — likely a match
            return { txn: best.txn, action: EnrichmentAction.EnrichWithReview, confidence: best.score };
        }
    }

    // -- PASS 7: Create new transaction --
    const newTxn = await transactionService.create({
        user_id: userId,
        fingerprint,
        amount: signal.amount,
        type: signal.type,
        channel: signal.channel,
        tx_date: signal.txDate,
        account_last4: signal.accountLast4,
        balance_after: signal.balanceAfter,
        raw_narration: signal.rawNarration,
        merchant_name: signal.merchantName,
        category: signal.category,
        sub_category: signal.subCategory,
        merchant_order_id: signal.merchantOrderId,
        upi_ref: signal.upiRef,
        neft_utr: signal.neftUtr,
        imps_ref: signal.impsRef,
        upi_app: signal.upiApp,
        upi_sender_vpa: signal.upiSenderVpa,
        upi_receiver_vpa: signal.upiReceiverVpa,
        context: signal.context || {},
        reconciled: signal.isReconciliation || false,
        reconciliation_status: signal.isReconciliation ? 'reconciled' : 'pending',
        enrichment_score: Math.min(100, signal.enrichmentScoreDelta),
        signal_count: 1,
        needs_review: false,
    } as any);

    return { txn: newTxn, action: EnrichmentAction.Create, confidence: 1.0 };
}
