// =============================================================================
// SHARED PRIMITIVES
// =============================================================================

export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // 'YYYY-MM-DDTHH:mm:ssZ'
export type INR = number; // always in rupees, 2 decimal places
export type Percentage = number; // 0–100, 2 decimal places
export type ISIN = string; // 12-char security identifier

// Every domain entity belongs to a user and has audit timestamps
interface BaseEntity {
    id: UUID;
    user_id: UUID;
    created_at: ISODateTime;
    updated_at: ISODateTime;
}

// =============================================================================
// DOMAIN 1 — SPENDING & TRANSACTIONS
// (see transactions.types.ts — this is the high-volume real-time system)
// =============================================================================
//
//  transactions            — canonical record per real-world payment event
//  transaction_signals     — every raw source that contributed (audit log)
//
// Queries it's optimised for:
//   - Monthly spend by category
//   - Merchant frequency / avg spend
//   - Day-of-week / time-of-day patterns
//   - Unreconciled invoice detection
//   - Subscription auto-detection

// =============================================================================
// DOMAIN 2 — INVESTMENTS
// =============================================================================
//
// Architecture: two tables, clearly separated concerns
//
//   investment_accounts      — the brokerage / platform account itself
//   holdings                 — current state of each position (mutable, updated daily)
//   investment_transactions  — immutable history of every buy/sell/SIP/dividend
//
// Queries it's optimised for:
//   - Current portfolio value
//   - XIRR / absolute returns per holding
//   - Asset allocation (equity vs debt vs gold vs liquid)
//   - SIP consistency (missed months)
//   - Capital gains report (STCG / LTCG)
//   - Dividend income tracking

// ── Enums ────────────────────────────────────────────────────────────────────

export enum AssetClass {
    Equity = 'equity', // stocks, equity MF
    Debt = 'debt', // debt MF, bonds, FD, RD
    Hybrid = 'hybrid', // balanced / hybrid MF
    Gold = 'gold', // Sovereign Gold Bond, Gold ETF, Gold MF
    RealEstate = 'real_estate', // REITs
    Crypto = 'crypto',
    Liquid = 'liquid', // liquid / overnight MF, savings account
    Alternate = 'alternate', // P2P, unlisted shares
}

export enum InvestmentVehicle {
    // Mutual Funds
    MutualFund = 'mutual_fund',
    ETF = 'etf',

    // Direct equity
    Stock = 'stock',

    // Fixed income
    FixedDeposit = 'fixed_deposit',
    RecurringDeposit = 'recurring_deposit',
    Bond = 'bond',
    SovereignGoldBond = 'sgb',
    PPF = 'ppf',
    NPS = 'nps',
    EPF = 'epf',

    // Others
    REIT = 'reit',
    Crypto = 'crypto',
    USStock = 'us_stock',
}

export enum MFPlan {
    Direct = 'direct',
    Regular = 'regular',
}

export enum MFOption {
    Growth = 'growth',
    IDCW = 'idcw', // formerly Dividend
}

export enum InvestmentTxType {
    // Mutual fund
    SIPPurchase = 'sip_purchase',
    Lumpsum = 'lumpsum',
    Redemption = 'redemption',
    Switch = 'switch',
    STP = 'stp', // Systematic Transfer Plan
    SWP = 'swp', // Systematic Withdrawal Plan
    DividendPayout = 'dividend_payout',
    DividendReinvest = 'dividend_reinvest',
    Bonus = 'bonus',

    // Equity
    Buy = 'buy',
    Sell = 'sell',
    DividendCredit = 'dividend_credit',
    BonusShare = 'bonus_share',
    RightsIssue = 'rights_issue',
    Split = 'split',

    // FD / RD
    Deposit = 'deposit',
    Maturity = 'maturity',
    PrematureClosure = 'premature_closure',
    InterestCredit = 'interest_credit',

    // SGB / Bond
    Coupon = 'coupon',
    Allotment = 'allotment',
}

export enum HoldingStatus {
    Active = 'active',
    Closed = 'closed', // fully redeemed / sold
    Matured = 'matured', // FD matured
    Paused = 'paused', // SIP paused
}

export enum HoldingReconciliationStatus {
    Authoritative = 'authoritative', // from CAMS / NSDL CAS (weekly refresh)
    Interim = 'interim', // from email signal (Groww order, KFintech valuation) — overwritten on next CAMS/CAS
    Stale = 'stale', // older than 30 days without refresh
}

export enum InvestmentTxReconciliationStatus {
    Confirmed = 'confirmed', // seen in CAMS or NSDL CAS (authoritative)
    Pending = 'pending', // trade from broker, not yet in demat statement
    EmailOnly = 'email_only', // from Groww/KFintech email, not yet in CAMS
}

export enum CapitalGainType {
    STCG = 'stcg', // Short Term Capital Gain
    LTCG = 'ltcg', // Long Term Capital Gain
}

// ── Account ──────────────────────────────────────────────────────────────────

export interface InvestmentAccount extends BaseEntity {
    platform: string; // 'Zerodha' | 'Groww' | 'Kuvera' | 'HDFC Securities' | 'ICICI Securities' | 'CAMS' | 'KFintech'
    platform_type: 'broker' | 'mf_platform' | 'bank' | 'employer' | 'depository';
    account_id?: string; // client ID / folio group / demat account no.
    dp_id?: string; // Depository Participant ID (for demat) — e.g. IN303028 (NSDL), 12081600 (CDSL)
    trading_code?: string; // broker trading code — e.g. YC3686 (Zerodha), 8503687287 (ICICI Sec)
    pan: string; // masked: 'ABCDE****F'
    holder_name?: string;

    // KYC & compliance
    nominees?: string[];
    kyc_ok?: boolean;

    is_active: boolean;
    first_seen_at?: ISODateTime; // when first parsed from an email
    last_seen_at?: ISODateTime; // last time a statement referenced this account
    last_synced_at?: ISODateTime;
}

// ── Holding (current state — updated on every transaction) ───────────────────

export interface Holding extends BaseEntity {
    investment_account_id: UUID;

    // What is this holding
    vehicle: InvestmentVehicle;
    asset_class: AssetClass;
    name: string; // 'Axis Bluechip Fund - Direct Growth'
    isin?: ISIN;
    symbol?: string; // 'RELIANCE' / 'NIFTY50BEES'
    folio_number?: string; // mutual fund folio: '12345678/01'
    amfi_code?: string; // AMFI scheme code for MF

    // MF-specific
    mf_plan?: MFPlan;
    mf_option?: MFOption;
    amc?: string; // 'Axis AMC' | 'HDFC AMC'
    rta?: 'CAMS' | 'KFintech';

    // Current position (recomputed on each tx)
    units: number; // 6 decimal places
    avg_cost_per_unit: number; // 4 decimal places
    total_invested: INR; // sum of all purchases at cost
    current_nav?: number; // latest NAV / market price
    current_value?: INR; // units × current_nav
    unrealised_pnl?: INR; // current_value - total_invested
    unrealised_pnl_pct?: Percentage;

    // SIP tracking
    sip_amount?: INR;
    sip_date?: number; // day of month (e.g. 5)
    sip_active?: boolean;
    sip_start_date?: ISODate;
    sip_end_date?: ISODate;

    // FD / RD / Bond specific
    principal?: INR;
    interest_rate?: Percentage;
    maturity_date?: ISODate;
    maturity_amount?: INR;
    tenure_months?: number;
    compounding?: 'monthly' | 'quarterly' | 'annually';

    // Performance
    xirr?: Percentage; // personalised IRR
    absolute_return?: Percentage;

    status: HoldingStatus;
    last_nav_updated?: ISODateTime;

    // Source tracking & reconciliation
    snapshot_date?: ISODate; // "as of" date for this position (from statement)
    reconciliation_status: HoldingReconciliationStatus;
    source: string; // 'cams_statement' | 'nsdl_cas' | 'zerodha_demat' | 'kfintech_valuation' | 'groww_order'
    source_email_id?: UUID; // → raw_emails.id
}

// ── Investment Transaction (immutable history) ────────────────────────────────

export interface InvestmentTransactionSourceSignal {
    source: string; // 'cams_statement' | 'icici_sec_contract' | 'nsdl_cas' | 'groww_order' | 'kfintech_redemption' | 'dividend_email'
    email_id?: string;
    received_at: ISODateTime;
    parsed_data: Record<string, unknown>;
}

export interface InvestmentTransaction extends BaseEntity {
    holding_id?: UUID; // → holdings.id (null if holding not yet created/linked)
    investment_account_id: UUID;
    fingerprint: string; // hash(user_id + isin + date + tx_type + amount) for dedup

    tx_type: InvestmentTxType;
    tx_date: ISODate;
    settlement_date?: ISODate;

    // Security identification
    isin?: ISIN;
    security_name?: string; // denormalized from holding for query convenience

    // Units & price
    units?: number; // +buy / -sell / -redeem
    nav?: number; // NAV / price per unit at time of tx
    amount: INR; // gross transaction value
    stamp_duty?: INR; // 0.005% on MF purchases
    stt?: INR; // Securities Transaction Tax
    brokerage?: INR;
    gst_on_brokerage?: INR;
    exit_load?: INR; // MF redemption
    transaction_charges?: INR; // exchange transaction charges
    net_amount: INR; // amount after all charges

    // Balance after tx (from statement)
    unit_balance_after?: number;

    // Capital gains (populated at sell/redemption)
    capital_gain?: INR;
    capital_gain_type?: CapitalGainType;
    holding_period_days?: number;

    // MF-specific: dividend
    tds_deducted?: INR; // TDS on dividends
    dividend_per_unit?: number; // per-share/unit rate
    financial_year?: string; // '2024-25'

    // Switch / STP: links source and destination holdings
    switch_to_holding_id?: UUID;
    switch_from_holding_id?: UUID;

    // Source traceability
    source_email_id?: UUID; // → raw_emails.id (CAMS/KFintech confirmation)
    confirmation_no?: string; // RTA transaction confirmation number
    order_id?: string; // platform order ID (Zerodha, Groww)
    advisor_code?: string; // INZ code from CAMS
    channel?: string; // 'BSE' | 'NSE' | 'Online' | 'Demat'

    // For equity — contract note details
    exchange?: 'NSE' | 'BSE' | 'MCX';
    settlement_no?: string;
    contract_number?: string;
    wap?: number; // Weighted Average Price (SEBI mandate)
    contract_note_id?: UUID; // → raw_emails.id (PDF)
    broker?: string; // 'icici_securities' | 'zerodha' | 'groww'

    // Reconciliation
    reconciliation_status: InvestmentTxReconciliationStatus;
    linked_spending_txn_id?: UUID; // → transactions.id (the bank debit for this trade/SIP)

    // Signal tracking
    signal_count: number;
    source_signals: InvestmentTransactionSourceSignal[];
}

// =============================================================================
// DOMAIN 3 — LOANS & CREDIT
// =============================================================================
//
// Architecture:
//
//   loans            — the loan contract itself (state machine)
//   loan_payments    — every EMI / prepayment / charge event
//
// Queries it's optimised for:
//   - Outstanding principal across all loans
//   - EMI calendar (what's due, when)
//   - Interest paid YTD (for tax: Section 24 home loan deduction)
//   - Prepayment impact simulation
//   - Overdue detection
//   - Total debt-to-income ratio

// ── Enums ────────────────────────────────────────────────────────────────────

export enum LoanType {
    HomeLoan = 'home_loan',
    CarLoan = 'car_loan',
    PersonalLoan = 'personal_loan',
    EducationLoan = 'education_loan',
    GoldLoan = 'gold_loan',
    BNPL = 'bnpl', // Buy Now Pay Later
    CreditCardEMI = 'credit_card_emi',
    BusinessLoan = 'business_loan',
    LoanAgainstMF = 'loan_against_mf',
    LAPLoan = 'lap', // Loan Against Property
}

export enum InterestType {
    Fixed = 'fixed',
    Floating = 'floating', // linked to EBLR/MCLR/repo rate
    Reducing = 'reducing',
}

export enum LoanStatus {
    Active = 'active',
    Closed = 'closed',
    Overdue = 'overdue',
    NPA = 'npa',
    Foreclosed = 'foreclosed',
}

export enum LoanPaymentType {
    EMI = 'emi',
    Prepayment = 'prepayment', // partial prepayment
    Foreclosure = 'foreclosure', // full settlement
    LateFee = 'late_fee',
    ProcessingFee = 'processing_fee',
    BounceCharge = 'bounce_charge',
}

// ── Loan ─────────────────────────────────────────────────────────────────────

export interface Loan extends BaseEntity {
    loan_type: LoanType;
    lender: string; // 'HDFC Bank' | 'Bajaj Finance' | 'SBI'
    loan_account_no: string; // masked: 'XXXXXX5678'

    // Contract terms (from sanction letter / statement)
    principal: INR; // original sanctioned amount
    interest_rate: Percentage; // p.a.
    interest_type: InterestType;
    tenure_months: number;
    emi_amount: INR;
    disbursement_date: ISODate;
    first_emi_date: ISODate;
    last_emi_date: ISODate; // projected

    // Rate change tracking (for floating loans)
    rate_changes?: Array<{
        effective_date: ISODate;
        new_rate: Percentage;
        reason?: string; // 'RBI repo rate change +25bps'
    }>;

    // Current state (recomputed on each payment)
    outstanding_principal: INR;
    emis_paid: number;
    emis_remaining: number;
    next_emi_date?: ISODate;
    next_emi_amount?: INR; // may differ from emi_amount if rate changed

    // Totals
    total_interest_paid: INR; // useful for Section 24 tax deduction
    total_paid: INR; // principal + interest paid so far

    status: LoanStatus;

    // Source traceability
    source_email_id?: UUID; // → raw_emails.id (sanction letter / statement)
}

// ── Loan Payment ──────────────────────────────────────────────────────────────

export interface LoanPayment extends BaseEntity {
    loan_id: UUID;
    payment_type: LoanPaymentType;
    payment_date: ISODate;

    amount_paid: INR;
    principal_component: INR; // how much reduced the principal
    interest_component: INR; // how much was interest
    charges?: INR; // late fee / bounce charge

    outstanding_after: INR; // outstanding principal after this payment
    emi_number?: number; // e.g. 14 (of 60)

    // Links to spending transaction (the actual bank debit)
    transaction_id?: UUID; // → transactions.id
    nach_ref?: string; // NACH mandate reference

    // Source
    source_email_id?: UUID; // → raw_emails.id (EMI confirmation email)
    pre_debit_notified?: boolean; // was RBI-mandated pre-debit notice received?
}

// =============================================================================
// DOMAIN 4 — INSURANCE
// =============================================================================
//
// Architecture:
//
//   insurance_policies  — the policy contract (state machine)
//   premium_payments    — each premium paid
//   insurance_claims    — claims filed and their status
//
// Queries it's optimised for:
//   - Total insurance premium outflow per year
//   - Coverage gap analysis (are you underinsured?)
//   - Upcoming renewal reminders
//   - Claim settlement ratio / pending claims
//   - Premium vs sum assured ratio

// ── Enums ────────────────────────────────────────────────────────────────────

export enum InsuranceType {
    TermLife = 'term_life',
    WholeLife = 'whole_life',
    ULIP = 'ulip',
    EndowmentPlan = 'endowment',
    HealthIndividual = 'health_individual',
    HealthFamily = 'health_family',
    TopUp = 'health_top_up',
    CriticalIllness = 'critical_illness',
    PersonalAccident = 'personal_accident',
    Vehicle = 'vehicle',
    HomeInsurance = 'home',
    Travel = 'travel',
    CyberInsurance = 'cyber',
}

export enum PolicyStatus {
    Active = 'active',
    Lapsed = 'lapsed',
    Surrendered = 'surrendered',
    Matured = 'matured',
    PremiumHoliday = 'premium_holiday',
}

export enum PremiumFrequency {
    Monthly = 'monthly',
    Quarterly = 'quarterly',
    HalfYearly = 'half_yearly',
    Annual = 'annual',
    SinglePremium = 'single_premium',
}

export enum ClaimStatus {
    Filed = 'filed',
    UnderReview = 'under_review',
    Approved = 'approved',
    Settled = 'settled',
    Rejected = 'rejected',
    Appealed = 'appealed',
}

// ── Insurance Policy ──────────────────────────────────────────────────────────

export interface InsurancePolicy extends BaseEntity {
    insurance_type: InsuranceType;
    insurer: string; // 'HDFC Life' | 'LIC' | 'Star Health'
    policy_number: string;
    plan_name: string; // 'HDFC Click 2 Protect Life'

    // Coverage
    sum_assured: INR;
    policy_term_years: number;
    premium_paying_term_years?: number; // may be less than policy term (limited pay)

    // Dates
    start_date: ISODate;
    end_date: ISODate; // maturity / expiry date
    next_premium_date: ISODate;

    // Premium
    premium_amount: INR; // per frequency
    premium_frequency: PremiumFrequency;
    annual_premium: INR; // normalised for comparison

    // Health insurance extras
    covered_members?: string[]; // ['self', 'spouse', 'child1']
    room_rent_limit?: INR;
    deductible?: INR;
    copay_pct?: Percentage;
    no_claim_bonus?: INR; // accumulated NCB

    // Life insurance extras
    nominee?: string;
    death_benefit?: INR; // may differ from sum_assured for ULIPs
    maturity_benefit?: INR;

    // Vehicle insurance extras
    vehicle_reg_no?: string;
    idv?: INR; // Insured Declared Value
    zero_dep?: boolean;

    status: PolicyStatus;

    // Totals (recomputed on each premium)
    total_premium_paid: INR;
    premiums_paid: number;

    // Source
    source_email_id?: UUID; // → raw_emails.id (policy document email)
}

// ── Premium Payment ───────────────────────────────────────────────────────────

export interface PremiumPayment extends BaseEntity {
    policy_id: UUID;
    payment_date: ISODate;
    amount: INR;
    receipt_number?: string;
    gst_component?: INR; // 18% GST on non-life, varies for life
    late_fee?: INR;

    // Links to spending transaction
    transaction_id?: UUID; // → transactions.id
    payment_method?: string; // 'NACH' | 'UPI' | 'Net Banking'

    // Source
    source_email_id?: UUID; // → raw_emails.id (receipt email)
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export interface InsuranceClaim extends BaseEntity {
    policy_id: UUID;
    claim_number: string;
    filed_date: ISODate;
    incident_date: ISODate;
    claimed_amount: INR;
    approved_amount?: INR;
    settled_amount?: INR;
    settlement_date?: ISODate;
    rejection_reason?: string;
    status: ClaimStatus;
    source_email_id?: UUID;
}

// =============================================================================
// DOMAIN 5 — ACCOUNTS & NET WORTH SNAPSHOT
// =============================================================================
//
// These are the "containers" that each domain entity lives in.
// A snapshot is taken periodically to build net worth over time.

export enum AccountType {
    // Bank accounts
    Savings = 'savings',
    Current = 'current',
    Salary = 'salary',
    NRE = 'nre',
    NRO = 'nro',

    // Cards
    CreditCard = 'credit_card',
    PrepaidCard = 'prepaid_card',

    // Digital wallets & UPI
    Wallet = 'wallet', // Paytm wallet, Amazon Pay balance
    UPILite = 'upi_lite', // UPI Lite wallet (off-bank, ≤₹1000)

    // Fixed income accounts
    FD = 'fd',
    RD = 'rd',
    PPF = 'ppf',
    EPF = 'epf',
    NPS = 'nps',
}

export interface FinancialAccount extends BaseEntity {
    // Identity
    provider: string; // 'HDFC Bank' | 'SBI' | 'Paytm' | 'Amazon Pay' | 'PhonePe'
    account_type: AccountType;
    account_identifier: string; // masked: 'XXXX5678' (last 4) or card name

    // Bank account specific
    ifsc?: string;
    branch?: string;

    // Credit card specific
    card_network?: 'Visa' | 'Mastercard' | 'Rupay' | 'Amex' | 'Diners';
    card_variant?: string; // 'Regalia' | 'Magnus' | 'SimplySAVE'
    credit_limit?: INR;
    billing_date?: number; // day of month
    due_date?: number; // day of month

    // Wallet specific
    upi_vpa?: string; // user@ybl, user@paytm

    // Current state
    current_balance?: INR; // last known balance (or outstanding for CC)
    balance_updated_at?: ISODateTime;

    // Linkage
    linked_upi_vpas?: string[]; // VPAs linked to this bank account

    // Status
    is_active: boolean;
    is_primary?: boolean; // primary salary account
    first_seen_at?: ISODateTime;
    last_seen_at?: ISODateTime;
}

export interface NetWorthSnapshot extends BaseEntity {
    snapshot_date: ISODate;

    // Assets
    bank_balance: INR; // sum of all savings/current accounts
    investment_value: INR; // sum of all holdings.current_value
    fd_value: INR;
    epf_ppf_nps: INR;
    other_assets: INR;
    total_assets: INR;

    // Liabilities
    loan_outstanding: INR; // sum of all loans.outstanding_principal
    credit_card_outstanding: INR;
    total_liabilities: INR;

    // Net
    net_worth: INR; // total_assets - total_liabilities

    // Breakdown by asset class (for allocation chart)
    allocation: {
        equity: Percentage;
        debt: Percentage;
        gold: Percentage;
        liquid: Percentage;
        real_estate: Percentage;
        other: Percentage;
    };
}

// =============================================================================
// CROSS-DOMAIN LINKAGE
// =============================================================================
//
// These types represent explicit links between domains.
// e.g. a loan EMI is both a LoanPayment and a Transaction.
//      an MF SIP is both an InvestmentTransaction and a Transaction.

export interface CrossDomainLink {
    id: UUID;
    user_id: UUID;

    // The spending transaction (always present)
    transaction_id: UUID;

    // What it links to (at most one)
    loan_payment_id?: UUID;
    investment_tx_id?: UUID;
    premium_payment_id?: UUID;

    link_type: 'loan_emi' | 'loan_prepayment' | 'sip_debit' | 'mf_lumpsum' | 'insurance_premium' | 'fd_booking' | 'rd_installment';

    confidence: number; // 0–1, some links are inferred, others are certain
    created_at: ISODateTime;
}
