// =============================================================================
// GMAIL SEARCH QUERIES — Indian Financial Email Discovery
// =============================================================================
//
// Strategy: few wide queries > many narrow ones.
// Gmail deduplicates within a query, we dedup across queries by message ID.
// ~15 queries covers what 100+ individual ones would.
//
// Gmail query length limit is ~1500 chars, so we split large from: lists.
// =============================================================================

export interface GmailSearchQuery {
    id: string;
    query: string;
    maxResults?: number; // default 500
}

// --- Tier 1: Wide keyword queries (run first, catch the bulk) ----------------

const WIDE_QUERIES: GmailSearchQuery[] = [
    {
        id: 'wide_debit_credit',
        query: '(debited OR credited OR "transaction alert" OR "account debited" OR "account credited" OR "has been debited" OR "has been credited") (bank OR "A/c" OR account OR card)',
        maxResults: 500,
    },
    {
        id: 'wide_credit_card',
        query: '("credit card" OR "card statement" OR "spent on your" OR "used at" OR "payment due" OR "bill due" OR "minimum amount due") (card OR statement OR transaction)',
        maxResults: 500,
    },
    {
        id: 'wide_upi_payments',
        query: '(UPI OR "UPI Ref" OR "payment receipt" OR "payment successful" OR "money sent" OR "money received") (paid OR received OR debited OR credited OR transaction)',
        maxResults: 500,
    },
    {
        id: 'wide_investments',
        query: '("mutual fund" OR SIP OR NAV OR "units allotted" OR "contract note" OR "trade confirmation" OR "order executed" OR dividend OR "consolidated account statement" OR folio)',
        maxResults: 500,
    },
    {
        id: 'wide_loans_emi',
        query: '(EMI OR "loan repayment" OR "equated monthly" OR "pre-debit" OR "auto debit" OR NACH OR "e-mandate" OR "loan statement")',
        maxResults: 300,
    },
    {
        id: 'wide_insurance',
        query: '("premium receipt" OR "premium paid" OR "policy renewal" OR "insurance" OR "claim settled") (premium OR policy OR insurance)',
        maxResults: 300,
    },
    {
        id: 'wide_salary_tax',
        query: '("salary credited" OR "salary credit" OR payslip OR "Form 16" OR TDS OR "income tax" OR "ITR refund" OR "tax invoice")',
        maxResults: 300,
    },
];

// --- Tier 2: Merged from: queries (one per category, all domains OR'd) -------

const SENDER_QUERIES: GmailSearchQuery[] = [
    {
        id: 'from_banks',
        query: '{from:hdfcbank.net from:icicibank.com from:sbi.co.in from:axisbank.com from:kotak.com from:idfcfirstbank.com from:yesbank.in from:indusind.com from:federalbank.co.in from:pnb.co.in from:bankofbaroda.in from:canarabank.com from:unionbankofindia.co.in from:aubank.in from:rblbank.com from:bandhanbank.com}',
        maxResults: 500,
    },
    {
        id: 'from_cc_upi',
        query: '{from:sbicard.com from:americanexpress.com from:getonecard.com from:phonepe.com from:paytm.com from:cred.club from:razorpay.com}',
        maxResults: 500,
    },
    {
        id: 'from_investments',
        query: '{from:camsonline.com from:kfintech.com from:groww.in from:kuvera.in from:zerodha.com from:upstox.com from:angelone.in from:hdfcsec.com from:icicidirect.com from:5paisa.com from:etmoney.com from:paytmmoney.com from:dhan.co from:fyers.in}',
        maxResults: 500,
    },
    {
        id: 'from_insurance',
        query: '{from:licindia.in from:licindia.com from:hdfclife.com from:sbilife.co.in from:iciciprulife.com from:maxlifeinsurance.com from:starhealth.in from:nivabupa.com from:careinsurance.com from:bajajallianz.co.in from:tataaig.com}',
        maxResults: 300,
    },
    {
        id: 'from_loans',
        query: '{from:bajajfinserv.in from:bajajfinance.in from:hdbfs.com from:tatacapital.com from:poonawallafincorp.com}',
        maxResults: 200,
    },
    {
        id: 'from_ecommerce',
        query: '{from:amazon.in from:flipkart.com from:swiggy.in from:zomato.com from:zeptonow.com from:blinkit.com from:myntra.com from:nykaa.com from:olacabs.com from:uber.com from:bigbasket.com from:bookmyshow.com from:irctc.co.in from:makemytrip.com}',
        maxResults: 500,
    },
    {
        id: 'from_subscriptions_telco',
        query: '{from:netflix.com from:spotify.com from:hotstar.com from:disneyplus.com from:jio.com from:airtel.in from:payments-noreply@google.com from:googleplay-noreply@google.com}',
        maxResults: 300,
    },
];

// --- Tier 3: Targeted (things only findable by attachment/specific sender) ----

const TARGETED_QUERIES: GmailSearchQuery[] = [
    {
        id: 'bank_statements_pdf',
        query: 'subject:("e-statement" OR "account statement" OR "bank statement") has:attachment filename:pdf',
        maxResults: 200,
    },
    {
        id: 'sbi_kotak_statements',
        query: '(from:cbssbi.cas@alerts.sbi.co.in OR from:cbssbi.cas@alerts.sbi.bank.in OR from:BankStatements@kotak.bank.in OR from:BankStatements@kotak.com) has:attachment',
        maxResults: 100,
    },
    {
        id: 'cc_statements_pdf',
        query: 'subject:("credit card statement" OR "card statement") has:attachment filename:pdf',
        maxResults: 200,
    },
    {
        id: 'contract_notes_pdf',
        query: 'subject:"contract note" has:attachment filename:pdf',
        maxResults: 200,
    },
    {
        id: 'income_tax_official',
        query: 'from:incometax.gov.in',
        maxResults: 100,
    },
    {
        id: 'phonepe_statements',
        query: 'subject:"Your PhonePe transaction statement"',
        maxResults: 100,
    },
    {
        id: 'paytm_statements',
        query: 'from:no-reply@paytm.com subject:"Paytm Statement"',
        maxResults: 100,
    },
];

// =============================================================================
// EXPORTS
// =============================================================================

export const GMAIL_SEARCH_QUERIES: GmailSearchQuery[] = [...WIDE_QUERIES, ...SENDER_QUERIES, ...TARGETED_QUERIES];

export const buildQuery = (q: GmailSearchQuery, after?: Date): string => {
    if (!after) return q.query;
    const dateStr = after.toISOString().slice(0, 10).replace(/-/g, '/');
    return `${q.query} after:${dateStr}`;
};

// const INVOICES_QUERIES = [
//     {
//         id: 'instamart_orders',
//         query: 'from:(noreply@swiggy.in) subject:(Your Instamart) has:attachment',
//         maxResults: 100,
//     },
//     {
//         id: 'swiggy_orders',
//         query: 'from:(noreply@swiggy.in) subject:(Your Swiggy) has:attachment',
//         maxResults: 100,
//     },
// ];
