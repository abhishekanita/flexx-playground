// ─────────────────────────────────────────────────────────────────────────────
// Gmail Query Builder — Stage A: Server-side filtering (free)
// Builds Gmail search queries targeting Indian financial emails
// ─────────────────────────────────────────────────────────────────────────────

// Known Indian bank domains for "from:" filter
const BANK_DOMAINS = [
    'hdfcbank.net', 'icicibank.com', 'sbi.co.in', 'onlinesbi.com',
    'axisbank.com', 'kotak.com', 'kotakbank.com', 'idfcfirstbank.com',
    'indusind.com', 'yesbank.in', 'rblbank.com', 'bankofbaroda.co.in',
    'pnb.co.in', 'canarabank.com', 'unionbankofindia.co.in',
    'federalbank.co.in', 'bandhanbank.com',
];

// UPI / Payment platforms
const PAYMENT_DOMAINS = [
    'phonepe.com', 'paytm.com', 'gpay.in', 'razorpay.com',
    'billdesk.com', 'cashfree.com', 'bajajfinserv.in',
];

// Insurance
const INSURANCE_DOMAINS = [
    'licindia.in', 'lic.co.in', 'starhealth.in', 'hdfclife.com',
    'iciciprulife.com', 'maxlifeinsurance.com', 'policybazaar.com',
    'digit.co.in', 'godigit.com', 'acko.com',
];

// Investments / Brokers
const INVESTMENT_DOMAINS = [
    'zerodha.com', 'groww.in', 'kuvera.in', 'coin.zerodha.com',
    'mfuonline.com', 'camsonline.com', 'kfintech.com',
    'amfiindia.com', 'nsdl.co.in', 'cdsl.co.in', 'angelone.in',
    'upstox.com',
];

// Tax & Government
const TAX_DOMAINS = [
    'incometax.gov.in', 'incometaxindiaefiling.gov.in',
    'gst.gov.in', 'epfindia.gov.in',
];

// Food / Ecommerce / Travel / Utilities
const COMMERCE_DOMAINS = [
    'swiggy.in', 'swiggy.com', 'zomato.com',
    'amazon.in', 'flipkart.com', 'myntra.com',
    'makemytrip.com', 'goibibo.com', 'irctc.co.in', 'cleartrip.com',
    'jio.com', 'airtel.in', 'vodafone.in', 'bsesdelhi.com', 'tatapower.com',
];

const ALL_FINANCIAL_DOMAINS = [
    ...BANK_DOMAINS,
    ...PAYMENT_DOMAINS,
    ...INSURANCE_DOMAINS,
    ...INVESTMENT_DOMAINS,
    ...TAX_DOMAINS,
    ...COMMERCE_DOMAINS,
];

// Financial keywords for subject-based filtering
const FINANCIAL_KEYWORDS = [
    'transaction', 'debit', 'credit', 'payment', 'transfer',
    'UPI', 'NEFT', 'RTGS', 'IMPS',
    'statement', 'account', 'balance',
    'invoice', 'receipt', 'bill',
    'EMI', 'loan', 'disbursement',
    'salary', 'credited to your',
    'insurance', 'premium', 'policy',
    'mutual fund', 'SIP', 'NAV', 'folio',
    'income tax', 'ITR', 'TDS', 'Form 16', 'Form 26AS',
    'credit card', 'reward points',
    'OTP', // Often accompanies transaction emails
];

/**
 * Build the main Gmail search query for financial emails (Stage A).
 * Uses a combination of known sender domains + financial keywords.
 * Gmail's query language is limited — we use OR groups.
 */
export function buildFinancialEmailQuery(monthsBack = 3): string {
    const afterDate = new Date();
    afterDate.setMonth(afterDate.getMonth() - monthsBack);
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');

    // Build domain-based "from:" clauses
    const domainClauses = ALL_FINANCIAL_DOMAINS.map((d) => `from:${d}`);

    // Build subject keyword clauses
    const keywordClauses = FINANCIAL_KEYWORDS.map((k) => `subject:"${k}"`);

    // Combine: (domain matches OR keyword matches) AND date filter
    // Gmail query: {from:a OR from:b ...} is union
    const allClauses = [...domainClauses, ...keywordClauses];

    // Gmail has a max query length, so we split into chunks if needed
    // For ~80 domains + ~25 keywords ≈ ~2500 chars — well within limits
    const query = `after:${dateStr} {${allClauses.join(' ')}}`;

    return query;
}

/**
 * Build a narrower query targeting only bank transaction alerts.
 * Useful for testing or focused processing.
 */
export function buildBankAlertQuery(monthsBack = 3): string {
    const afterDate = new Date();
    afterDate.setMonth(afterDate.getMonth() - monthsBack);
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');

    const bankClauses = BANK_DOMAINS.map((d) => `from:${d}`);

    return `after:${dateStr} {${bankClauses.join(' ')}} {subject:transaction subject:debit subject:credit subject:transfer subject:"credited to" subject:"debited from"}`;
}

/**
 * Build a query for just UPI transaction emails.
 */
export function buildUpiQuery(monthsBack = 3): string {
    const afterDate = new Date();
    afterDate.setMonth(afterDate.getMonth() - monthsBack);
    const dateStr = afterDate.toISOString().split('T')[0].replace(/-/g, '/');

    const upiClauses = [...PAYMENT_DOMAINS, ...BANK_DOMAINS].map((d) => `from:${d}`);

    return `after:${dateStr} {${upiClauses.join(' ')}} subject:UPI`;
}

/**
 * Get all domain patterns for reference (used by filter service for whitelist seeding).
 */
export function getAllFinancialDomains(): string[] {
    return ALL_FINANCIAL_DOMAINS;
}
