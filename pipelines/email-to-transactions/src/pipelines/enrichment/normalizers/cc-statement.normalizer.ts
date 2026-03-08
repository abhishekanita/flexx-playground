import { SignalSourceType, TransactionCategory, TransactionChannel, TransactionType } from '@/types/financial-data/transactions.enums';
import { NormalizedSignal } from './normalizer.types';

function inferCcCategory(description: string): TransactionCategory {
    const d = description.toUpperCase();

    if (/SWIGGY|ZOMATO/i.test(d)) return TransactionCategory.FoodDelivery;
    if (/BLINKIT|BIGBASKET|ZEPTO|DUNZO|INSTAMART|LICIOUS/i.test(d)) return TransactionCategory.Groceries;
    if (/\bUBER\b|RAPIDO|\bOLA\b/i.test(d)) return TransactionCategory.CabRide;
    if (/AMAZON|FLIPKART|MYNTRA|AJIO|MEESHO|NYKAA/i.test(d)) return TransactionCategory.Ecommerce;
    if (/NETFLIX|HOTSTAR|PRIME VIDEO|DISNEY/i.test(d)) return TransactionCategory.OTT;
    if (/SPOTIFY|YOUTUBE|APPLE\.COM|GOOGLE/i.test(d)) return TransactionCategory.Subscription;
    if (/MAKEMYTRIP|GOIBIBO|CLEARTRIP|YATRA|INDIGO|SPICEJET|VISTARA/i.test(d)) return TransactionCategory.Flight;
    if (/AIRBNB|OYO|HOTEL|HOSTEL/i.test(d)) return TransactionCategory.Hotel;
    if (/IRCTC/i.test(d)) return TransactionCategory.Train;
    if (/PHARMEASY|1MG|NETMEDS|APOLLO/i.test(d)) return TransactionCategory.Pharmacy;
    if (/STARBUCKS|MCDONALD|KFC|DOMINO|BURGER|CAFE|RESTAURANT/i.test(d)) return TransactionCategory.Restaurant;
    if (/EMI|LOAN/i.test(d)) return TransactionCategory.EMI;
    if (/INSURANCE|LIC|HDFC LIFE/i.test(d)) return TransactionCategory.Insurance;
    if (/PETROL|FUEL|HPCL|BPCL|IOCL/i.test(d)) return TransactionCategory.Fuel;
    if (/TELE TRANSFER|PAYMENT RECE|CREDIT/i.test(d)) return TransactionCategory.Transfer;

    return TransactionCategory.Unknown;
}

// HDFC Credit Card Statement
// domesticTransactions: [{ date, time, description, refNumber, rewardPoints, amount, isCredit }]
export function normalizeHdfcCcStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];
    const cardNumber = raw.cardNumber || '';
    const accountLast4 = cardNumber.replace(/\D/g, '').slice(-4);

    for (const txn of raw.domesticTransactions || []) {
        const amount = Math.abs(txn.amount);
        if (!amount || amount === 0) continue;

        const isCredit = txn.isCredit === true;
        const category = inferCcCategory(txn.description || '');

        signals.push({
            amount,
            txDate: new Date(txn.date),
            accountLast4,
            type: isCredit ? TransactionType.Credit : TransactionType.Debit,
            channel: TransactionChannel.CreditCard,
            rawNarration: txn.description,
            merchantName: txn.description?.replace(/\s+/g, ' ').trim() || '',
            category,
            sourceType: SignalSourceType.CreditCardStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: 28,
            isReconciliation: true,
        });
    }

    // International transactions
    for (const txn of raw.internationalTransactions || []) {
        const amount = Math.abs(txn.amount);
        if (!amount || amount === 0) continue;

        const isCredit = txn.isCredit === true;

        signals.push({
            amount,
            txDate: new Date(txn.date),
            accountLast4,
            type: isCredit ? TransactionType.Credit : TransactionType.Debit,
            channel: TransactionChannel.CreditCard,
            rawNarration: txn.description,
            merchantName: txn.description?.replace(/\s+/g, ' ').trim() || '',
            category: inferCcCategory(txn.description || ''),
            sourceType: SignalSourceType.CreditCardStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: 28,
            isReconciliation: true,
        });
    }

    return signals;
}

// SBI Card Credit Card Statement
// transactions: [{ date, description, amount, isCredit, refNumber }]
export function normalizeSbiCardStatement(raw: Record<string, any>, _emailMeta?: any): NormalizedSignal[] {
    const signals: NormalizedSignal[] = [];
    const cardNumber = (raw.cardNumber || '').replace(/\D/g, '');
    const accountLast4 = cardNumber.slice(-4) || raw.cardNumber?.slice(-4) || '';

    for (const txn of raw.transactions || []) {
        const amount = Math.abs(txn.amount);
        if (!amount || amount === 0) continue;

        const isCredit = txn.isCredit === true || txn.type === 'credit';
        const category = inferCcCategory(txn.description || '');

        signals.push({
            amount,
            txDate: new Date(txn.date),
            accountLast4,
            type: isCredit ? TransactionType.Credit : TransactionType.Debit,
            channel: TransactionChannel.CreditCard,
            rawNarration: txn.description,
            merchantName: txn.description?.replace(/\s+/g, ' ').trim() || '',
            category,
            sourceType: SignalSourceType.CreditCardStatement,
            confidence: 1,
            rawParsed: txn,
            enrichmentScoreDelta: 28,
            isReconciliation: true,
        });
    }

    return signals;
}
