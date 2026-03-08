import { ITransactionDoc } from '@/schema/transaction.schema';
import { transactionService } from '@/services/transactions/transaction.service';
import { transactionSignalService } from '@/services/transactions/transaction-signal.service';
import { NormalizedSignal } from './normalizers/normalizer.types';
import { Transaction } from '@/types/financial-data/transactions.type';

function deepMergeContext(existing: Record<string, any>, incoming: Record<string, any>): Record<string, any> {
    const merged = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
        if (value !== undefined && value !== null) {
            merged[key] = value;
        }
    }
    return merged;
}

export async function enrichTransaction(
    txn: ITransactionDoc,
    signal: NormalizedSignal,
    rawEmailId: string,
    receivedAt: Date
): Promise<string[]> {
    const updates: Record<string, any> = {};
    const fieldsContributed: string[] = [];

    // Set-if-empty: only fill fields that are currently null/undefined/empty
    const setIfEmpty = (field: keyof Transaction, value: any) => {
        if (value === undefined || value === null || value === '') return;
        const current = (txn as any)[field];
        if (current === undefined || current === null || current === '' || current === 'unknown' || current === 'UNKNOWN') {
            updates[field] = value;
            fieldsContributed.push(field);
        }
    };

    // Strong keys — always fill if missing
    setIfEmpty('upi_ref', signal.upiRef);
    setIfEmpty('neft_utr', signal.neftUtr);
    setIfEmpty('imps_ref', signal.impsRef);

    // Base fields
    setIfEmpty('channel', signal.channel);
    setIfEmpty('raw_narration', signal.rawNarration);
    setIfEmpty('balance_after', signal.balanceAfter);
    setIfEmpty('account_last4', signal.accountLast4);

    // Merchant
    setIfEmpty('merchant_name', signal.merchantName);
    setIfEmpty('merchant_order_id', signal.merchantOrderId);
    setIfEmpty('category', signal.category);
    setIfEmpty('sub_category', signal.subCategory);

    // UPI
    setIfEmpty('upi_app', signal.upiApp);
    setIfEmpty('upi_sender_vpa', signal.upiSenderVpa);
    setIfEmpty('upi_receiver_vpa', signal.upiReceiverVpa);

    // Context — always merge (never replace)
    if (signal.context && Object.keys(signal.context).length > 0) {
        updates.context = deepMergeContext(txn.context || {}, signal.context);
        fieldsContributed.push('context');
    }

    // Reconciliation from bank statement
    if (signal.isReconciliation && !txn.reconciled) {
        updates.reconciled = true;
        updates.reconciliation_status = 'reconciled';
        fieldsContributed.push('reconciled');
    }

    // Enrichment score
    const newScore = Math.min(100, (txn.enrichment_score || 0) + signal.enrichmentScoreDelta);
    updates.enrichment_score = newScore;

    // Apply updates
    if (Object.keys(updates).length > 0) {
        await transactionService.update(
            { _id: txn._id },
            {
                $set: updates,
                $inc: { signal_count: 1 },
            }
        );
    }

    // Log the signal for audit trail
    await transactionSignalService.create({
        transaction_id: txn._id.toString(),
        source_type: signal.sourceType,
        source_id: rawEmailId,
        raw_email_id: rawEmailId,
        parsed_data: signal.rawParsed,
        confidence: signal.confidence,
        fields_contributed: fieldsContributed as any,
        received_at: receivedAt,
    } as any);

    return fieldsContributed;
}
