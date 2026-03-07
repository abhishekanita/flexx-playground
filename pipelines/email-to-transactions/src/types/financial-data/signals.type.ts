import { TransactionContext } from './context.type';
import { EnrichmentAction, ReconciliationStatus, SignalSourceType } from './transactions.enums';
import { Transaction } from './transactions.type';

export interface TransactionSignal {
    id: string; // UUID
    transaction_id: string; // UUID → transactions.id
    source_type: SignalSourceType;
    source_id: string; // Gmail message ID / SMS ID / statement row ID
    raw_email_id?: string; // UUID → raw_emails.id
    parsed_data: Record<string, unknown>; // full parsed output, never discarded
    confidence: number; // 0–1 parsing confidence for this signal
    fields_contributed: (keyof Transaction)[]; // which fields this signal set/enriched
    received_at: Date;
}

export interface IncomingSignal {
    // Matching fields
    amount: number;
    txDate: Date;
    accountLast4?: string;
    upiRef?: string;
    impsRef?: string;
    neftUtr?: string;
    merchantOrderId?: string;

    // Metadata
    sourceType: SignalSourceType;
    sourceId: string;
    rawEmailId?: string;
    confidence: number;
    receivedAt: Date;

    // Parsed payload
    baseFields?: Partial<Transaction>;
    merchantContext?: TransactionContext;
    rawParsed: Record<string, unknown>;
}

export interface MatchResult {
    txn: Transaction;
    action: EnrichmentAction;
    confidence: number;
}

export type CreateTransactionDTO = Omit<
    Transaction,
    'id' | 'created_at' | 'last_enriched_at' | 'enrichment_score' | 'signal_count' | 'reconciled' | 'reconciliation_status' | 'needs_review'
> & {
    enrichment_score?: number; // defaults to 30
    signal_count?: number; // defaults to 1
    reconciled?: boolean; // defaults to false
    reconciliation_status?: ReconciliationStatus; // defaults to Pending
    needs_review?: boolean; // defaults to false
};

export type EnrichTransactionDTO = Partial<
    Pick<
        Transaction,
        | 'merchant_name'
        | 'merchant_id'
        | 'category'
        | 'sub_category'
        | 'merchant_order_id'
        | 'upi_app'
        | 'upi_sender_vpa'
        | 'upi_receiver_vpa'
        | 'upi_ref'
        | 'context'
        | 'value_date'
        | 'statement_row_id'
        | 'statement_narration'
        | 'reconciled'
        | 'reconciliation_status'
        | 'balance_after'
        | 'raw_narration'
    >
> & {
    enrichment_score_delta?: number; // added to current score, capped at 100
    needs_review?: boolean;
};
