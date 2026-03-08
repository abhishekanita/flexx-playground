import { SignalSourceType, TransactionCategory, TransactionChannel, TransactionType, UpiApp } from '@/types/financial-data/transactions.enums';
import { NormalizedSignal } from './normalizer.types';

// PhonePe statement normalizer
export function normalizePhonePeStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];

    for (const txn of raw.transactions || []) {
        const amount = txn.amount;
        if (!amount || amount === 0) continue;

        const isDebit = txn.type === 'Debit';
        const accountLast4 = (txn.account || '').replace(/\D/g, '').slice(-4);
        const txnId: string = txn.transactionId || '';

        // Classify channel:
        // W-prefix = UPI Lite wallet load (bank → Lite wallet)
        // ≤₹1000 + Debit + primary account = UPI Lite spend (wallet → merchant)
        // Everything else = regular UPI
        const isWalletLoad = txnId.startsWith('W');
        const isLiteSpend = !isWalletLoad && isDebit && amount <= 1000 && accountLast4 === '4051';
        const channel = (isWalletLoad || isLiteSpend)
            ? TransactionChannel.UPILite
            : TransactionChannel.UPI;

        // Wallet loads are transfers, not merchant payments
        const category = isWalletLoad ? TransactionCategory.Transfer : TransactionCategory.Unknown;
        const subCategory = isWalletLoad ? 'upi_lite_load' : undefined;

        signals.push({
            amount,
            txDate: new Date(`${txn.date} ${txn.time}`),
            accountLast4: accountLast4 || undefined,
            upiRef: txn.utrNo || undefined,
            type: isDebit ? TransactionType.Debit : TransactionType.Credit,
            channel,
            rawNarration: `${txn.direction === 'paid' ? 'Paid to' : txn.direction === 'received' ? 'Received from' : 'Money added to'} ${txn.payee}`,
            merchantName: isWalletLoad ? undefined : txn.payee,
            category,
            subCategory,
            upiApp: UpiApp.PhonePe,
            sourceType: SignalSourceType.UpiStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: isLiteSpend ? 22 : 19, // Lite spends are higher value (invisible to bank)
        });
    }

    return signals;
}

// Paytm statement normalizer
export function normalizePaytmStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];

    for (const txn of raw.transactions || []) {
        const amount = Math.abs(txn.amount);
        if (!amount || amount === 0) continue;

        const isDebit = txn.amount < 0;

        // Extract account last 4 from "State Bank Of India - 51" → "51" isn't great, skip
        const upiRef = txn.upiRefNo || undefined;

        signals.push({
            amount,
            txDate: new Date(`${txn.date.split('/').reverse().join('-')} ${txn.time}`),
            upiRef,
            merchantOrderId: txn.orderId || undefined,
            type: isDebit ? TransactionType.Debit : TransactionType.Credit,
            channel: TransactionChannel.UPI,
            rawNarration: txn.description,
            merchantName: txn.counterparty || undefined,
            category: TransactionCategory.Unknown,
            upiApp: UpiApp.Paytm,
            upiReceiverVpa: isDebit ? txn.counterparty : undefined,
            upiSenderVpa: !isDebit ? txn.counterparty : undefined,
            sourceType: SignalSourceType.UpiStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: 19,
        });
    }

    return signals;
}
