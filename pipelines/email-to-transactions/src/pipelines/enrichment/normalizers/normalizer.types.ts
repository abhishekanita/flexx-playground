import { SignalSourceType, TransactionCategory, TransactionChannel, TransactionType } from '@/types/financial-data/transactions.enums';
import { TransactionContext } from '@/types/financial-data/context.type';

export interface NormalizedSignal {
    // Matching keys
    amount: number;
    txDate: Date;
    accountLast4?: string;
    upiRef?: string;
    neftUtr?: string;
    impsRef?: string;
    merchantOrderId?: string;

    // Base fields
    type: TransactionType;
    channel: TransactionChannel;
    rawNarration?: string;
    balanceAfter?: number;

    // Merchant
    merchantName?: string;
    category: TransactionCategory;
    subCategory?: string;

    // UPI
    upiApp?: string;
    upiSenderVpa?: string;
    upiReceiverVpa?: string;

    // Context
    context?: TransactionContext;

    // Metadata
    sourceType: SignalSourceType;
    confidence: number;
    rawParsed: Record<string, unknown>;

    // Enrichment hints
    enrichmentScoreDelta: number;
    isReconciliation?: boolean; // bank statement = reconciliation signal
}

export type NormalizerFn = (
    rawExtracted: Record<string, any>,
    emailMeta: { rawEmailId: string; receivedAt: string }
) => NormalizedSignal[];
