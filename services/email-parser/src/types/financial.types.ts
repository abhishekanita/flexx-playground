// Financial data types used across the pipeline

export type TransactionType = 'debit' | 'credit';
export type TransactionChannel = 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'ATM' | 'CARD' | 'AUTOPAY' | 'CHEQUE' | 'ONLINE' | 'OTHER';

export type EmailCategory =
    | 'official_bank_statement'
    | 'credit_card_statement'
    | 'consumer_invoice'
    | 'investment'
    | 'mutual_fund_cas'
    | 'demat_account'
    | 'insurance'
    | 'emi_loan'
    | 'tax_notice'
    | 'rbi_update'
    | 'payment_notification'
    | 'salary_credit'
    | 'bank_alert'
    | 'uncategorized';

export type ConsumerSubcategory =
    | 'food_delivery'
    | 'grocery'
    | 'transport'
    | 'shopping'
    | 'subscription'
    | 'bill_recharge'
    | 'travel'
    | 'entertainment'
    | 'service'
    | 'fuel'
    | 'education'
    | 'health_pharmacy';

export type InvestmentSubcategory =
    | 'mutual_fund_sip'
    | 'mutual_fund_lumpsum'
    | 'mutual_fund_redemption'
    | 'stock_buy_sell'
    | 'ipo'
    | 'sgb'
    | 'nps';

export type StatementType = 'savings' | 'current' | 'fd' | 'credit_card' | 'mutual_fund_cas' | 'demat';

export type RawEmailStatus = 'fetched' | 'classified' | 'parsed' | 'enriched' | 'failed' | 'skipped';

export type SyncTrigger = 'manual' | 'scheduled' | 'config-update' | 'new-connection';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type SyncRunStatus = 'running' | 'completed' | 'failed';

export type EnrichmentLinkType = 'created' | 'enriched' | 'duplicate_skipped';

export type TransactionSourceType = 'bank_statement' | 'email_receipt' | 'credit_card_statement';

export interface TransactionSource {
    type: TransactionSourceType;
    rawEmailId?: string;
    statementId?: string;
    importedAt: Date;
}

export interface TransactionEnrichment {
    hasInvoice: boolean;
    invoiceId?: string;
    orderId?: string;
    lineItems?: LineItem[];
    paymentMethod?: string;
}

export interface LineItem {
    name: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice: number;
}

export interface ParseResult {
    parserConfigId: string;
    method: string;
    extractedData: Record<string, any>;
    targetCollection: string;
    targetDocId?: string;
    confidence: number;
    error?: string;
    attempts: number;
}

export interface EmailAttachment {
    filename: string;
    mimeType: string;
    gmailAttachmentId: string;
    downloaded: boolean;
    storagePath?: string;
}

export interface StatementPeriod {
    from: Date;
    to: Date;
}

export interface ParsedStatementTransaction {
    date: Date;
    description: string;
    amount: number;
    type: TransactionType;
    balance?: number;
    channel?: TransactionChannel;
    merchant?: string;
    synced: boolean;
    transactionId?: string;
}

export interface SyncStage {
    name: string;
    status: StageStatus;
    startedAt?: Date;
    completedAt?: Date;
    metadata?: Record<string, any>;
}

export interface SyncStats {
    emailsFetched: number;
    emailsNew: number;
    emailsClassified: number;
    emailsParsed: number;
    emailsFailed: number;
    emailsSkipped: number;
    transactionsCreated: number;
    transactionsEnriched: number;
    invoicesCreated: number;
    llmCostUSD: number;
    totalTimeMs: number;
}
