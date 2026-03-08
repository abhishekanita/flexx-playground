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

// ── Investment domain ───────────────────────────────────────────────────

export interface NormalizedInvestmentAccount {
    platform: string;
    platform_type: 'broker' | 'mf_platform' | 'bank' | 'depository';
    account_id?: string;
    dp_id?: string;
    trading_code?: string;
    pan?: string;
    holder_name?: string;
    nominees?: string[];
    kyc_ok?: boolean;
}

export interface NormalizedInvestmentHolding {
    vehicle: 'mutual_fund' | 'stock' | 'etf';
    asset_class: string;
    name: string;
    isin?: string;
    symbol?: string;
    folio_number?: string;
    amfi_code?: string;
    mf_plan?: string;
    mf_option?: string;
    amc?: string;
    rta?: string;
    units: number;
    locked_quantity?: number;
    current_nav?: number;
    current_value?: number;
    total_invested?: number;
    face_value?: number;
    snapshot_date: string;
    reconciliation_status: 'authoritative' | 'interim';
    // Which account this belongs to (index into accounts array or account key)
    account_key: string; // platform + '|' + (account_id || dp_id)
}

export interface NormalizedInvestmentTransaction {
    tx_type: string;
    tx_date: string; // YYYY-MM-DD
    settlement_date?: string;
    isin?: string;
    security_name?: string;
    exchange?: string;
    units?: number;
    nav?: number;
    amount: number;
    brokerage?: number;
    gst?: number;
    stt?: number;
    stamp_duty?: number;
    exit_load?: number;
    transaction_charges?: number;
    net_amount: number;
    unit_balance_after?: number;
    contract_number?: string;
    order_number?: string;
    broker?: string;
    channel?: string;
    advisor_code?: string;
    tds_deducted?: number;
    dividend_per_unit?: number;
    financial_year?: string;
    reconciliation_status: 'confirmed' | 'pending' | 'email_only';
    // Which account this belongs to
    account_key: string;
}

export interface NormalizedFinancialAccount {
    provider: string;
    account_type: string;
    account_identifier: string; // last 4 digits or card name
    ifsc?: string;
    card_network?: string;
    card_variant?: string;
    upi_vpa?: string;
    current_balance?: number;
}

export interface NormalizedInvestmentOutput {
    accounts: NormalizedInvestmentAccount[];
    holdings: NormalizedInvestmentHolding[];
    transactions: NormalizedInvestmentTransaction[];
    financialAccounts: NormalizedFinancialAccount[];
    rawParsed: Record<string, unknown>;
}

export type InvestmentNormalizerFn = (
    rawExtracted: Record<string, any>,
    emailMeta: { rawEmailId: string; receivedAt: string }
) => NormalizedInvestmentOutput;
