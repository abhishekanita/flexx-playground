import { TransactionContext } from './context.type';
import {
    ReconciliationStatus,
    SignalSourceType,
    TransactionCategory,
    TransactionChannel,
    TransactionType,
    UpiApp,
} from './transactions.enums';

export interface Transaction {
    // Identity — immutable once set
    id: string; // UUID
    user_id: string; // UUID → users.id
    fingerprint: string; // hash(user_id + amount + date_hour + account_last4)
    upi_ref?: string; // 12-digit UPI RRN — strongest cross-signal key
    neft_utr?: string; // 16-char NEFT UTR
    imps_ref?: string; // IMPS reference

    // Base — from first signal (bank alert)
    amount: number; // INR, always positive
    type: TransactionType;
    channel: TransactionChannel;
    tx_date: Date; // precise timestamp from bank alert
    value_date?: Date; // settlement date from statement (may lag by 1 day)
    account_last4: string; // masked bank account identifier
    balance_after?: number; // available balance post-transaction
    raw_narration?: string; // verbatim bank narration string

    // Merchant — progressively enriched
    merchant_name?: string; // normalised: 'Swiggy'
    merchant_id?: string; // UUID → merchants.id (once confirmed)
    category: TransactionCategory;
    sub_category?: string; // 'biryani' | 'grocery_dairy' | etc.
    merchant_order_id?: string; // SW-483192847 — cross-ref key with invoices

    // UPI layer — from UPI app statement
    upi_app?: UpiApp;
    upi_sender_vpa?: string; // user@ybl
    upi_receiver_vpa?: string; // swiggyin@icici

    // Merchant-specific context (JSONB)
    context?: TransactionContext;

    reconciliation_status: ReconciliationStatus;
    reconciled: boolean; // true once seen in bank statement
    statement_row_id?: string; // row identifier in bank statement
    statement_narration?: string; // full narration from statement (richer than alert)

    enrichment_score: number; // 0–100
    signal_count: number; // how many independent sources confirmed this
    needs_review: boolean; // flagged for manual or AI review

    // Timestamps
    created_at: Date;
    last_enriched_at: Date;
}
