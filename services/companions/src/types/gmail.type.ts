// ─────────────────────────────────────────────────────────────────────────────
// Gmail Financial Email Processing — Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enums (as const for type-safe unions) ───────────────────────────────────

export const EMAIL_CATEGORIES = [
    'bank_transaction',
    'upi_transaction',
    'credit_card',
    'loan_emi',
    'loan_disbursement',
    'salary_credit',
    'investment_statement',
    'mutual_fund',
    'stock_trading',
    'insurance_premium',
    'insurance_policy',
    'tax_notice',
    'tax_refund',
    'itr_filing',
    'invoice',
    'subscription',
    'food_delivery',
    'ecommerce',
    'travel_booking',
    'utility_bill',
    'wallet_transaction',
    'other_financial',
] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export const FILTER_STAGES = ['query_match', 'whitelist_match', 'ai_classified'] as const;
export type FilterStage = (typeof FILTER_STAGES)[number];

export const PROCESSING_METHODS = ['ai_extraction', 'template_extraction'] as const;
export type ProcessingMethod = (typeof PROCESSING_METHODS)[number];

export const CONNECTION_STATUSES = ['active', 'inactive', 'token_expired', 'revoked'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const SENDER_STATUSES = ['active', 'inactive', 'pending_review'] as const;
export type SenderStatus = (typeof SENDER_STATUSES)[number];

export const SENDER_CATEGORIES = [
    'bank',
    'upi',
    'credit_card',
    'nbfc',
    'insurance',
    'mutual_fund',
    'stock_broker',
    'tax_authority',
    'food_delivery',
    'ecommerce',
    'travel',
    'utility',
    'wallet',
    'government',
    'other',
] as const;
export type SenderCategory = (typeof SENDER_CATEGORIES)[number];

export const EXTRACTION_TYPES = ['regex', 'text_between', 'ai'] as const;
export type ExtractionType = (typeof EXTRACTION_TYPES)[number];

export const TEMPLATE_STATUSES = ['draft', 'active', 'deprecated'] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const TRANSACTION_TYPES = ['debit', 'credit'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// ─── GmailConnection ─────────────────────────────────────────────────────────

export interface GmailConnectionSyncState {
    totalFetched: number;
    totalFiltered: number;
    totalProcessed: number;
    lastSyncAt?: Date;
    lastError?: string;
}

export interface GmailConnection {
    connectionId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    status: ConnectionStatus;
    syncState: GmailConnectionSyncState;
    connectedAt: Date;
}

// ─── EmailSender (Whitelist) ─────────────────────────────────────────────────

export interface SenderProcessingConfig {
    extractionType: ExtractionType;
    expectedFields: string[];
    subjectPatterns: string[];
    priority: number;
}

export interface EmailSender {
    emailPattern: string;
    domainPattern?: string;
    senderName: string;
    category: SenderCategory;
    processingConfig: SenderProcessingConfig;
    status: SenderStatus;
    matchCount: number;
    lastMatchAt?: Date;
}

// ─── FinancialEmailAttachment ────────────────────────────────────────────────

export interface FinancialEmailAttachment {
    filename: string;
    mimeType: string;
    size: number;
    extractedText?: string;
}

// ─── FinancialEmail ──────────────────────────────────────────────────────────

export interface FinancialEmailData {
    amount?: number;
    currency?: string;
    date?: Date;
    merchantName?: string;
    accountNumberLast4?: string;
    transactionType?: TransactionType;
    upiId?: string;
    referenceNumber?: string;
    balance?: number;
    bankName?: string;
    cardLast4?: string;
    emiNumber?: number;
    emiTotal?: number;
    policyNumber?: string;
    invoiceNumber?: string;
    invoiceItems?: Array<{ name: string; quantity?: number; amount: number }>;
    taxYear?: string;
    panNumber?: string;
    description?: string;
}

export interface FinancialEmailAiUsage {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
}

export interface FinancialEmail {
    connectionId: string;
    gmailMessageId: string;
    threadId?: string;
    from: string;
    to?: string;
    subject: string;
    receivedAt: Date;
    filterStage: FilterStage;
    category: EmailCategory;
    processingMethod: ProcessingMethod;
    data: FinancialEmailData;
    attachments?: FinancialEmailAttachment[];
    rawText?: string;
    rawHtml?: string;
    senderEmailPattern?: string;
    templateId?: string;
    aiUsage?: FinancialEmailAiUsage;
    processedAt: Date;
}

// ─── EmailProcessingTemplate ─────────────────────────────────────────────────

export interface TemplateRule {
    field: string;
    method: 'regex' | 'text_between';
    pattern?: string;
    startMarker?: string;
    endMarker?: string;
    transform?: 'number' | 'date' | 'uppercase' | 'lowercase' | 'trim';
    group?: number;
}

export interface EmailProcessingTemplate {
    senderEmailPattern: string;
    subjectPattern?: string;
    category: EmailCategory;
    rules: TemplateRule[];
    status: TemplateStatus;
    accuracy: number;
    usageCount: number;
    createdFrom: 'ai_generated' | 'manual';
    lastUsedAt?: Date;
}
