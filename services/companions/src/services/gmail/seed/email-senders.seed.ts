import { EmailSender, SenderCategory, ExtractionType } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Seed Data — Known Indian financial email senders (~80 entries)
// Each entry maps sender email patterns to categories + processing config
// ─────────────────────────────────────────────────────────────────────────────

interface SeedSender extends Omit<EmailSender, 'matchCount' | 'lastMatchAt'> {}

function sender(
    emailPattern: string,
    senderName: string,
    category: SenderCategory,
    opts: { domain?: string; extraction?: ExtractionType; fields?: string[]; subjects?: string[]; priority?: number } = {}
): SeedSender {
    return {
        emailPattern,
        domainPattern: opts.domain || emailPattern.replace('*@', ''),
        senderName,
        category,
        processingConfig: {
            extractionType: opts.extraction || 'ai',
            expectedFields: opts.fields || [],
            subjectPatterns: opts.subjects || [],
            priority: opts.priority || 0,
        },
        status: 'active',
    };
}

// ─── Banks ───────────────────────────────────────────────────────────────────

const BANKS: SeedSender[] = [
    sender('*@hdfcbank.net', 'HDFC Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance', 'transactionType', 'referenceNumber'],
        subjects: ['Transaction Alert', 'Account Statement', 'Credit Card Statement'],
        priority: 10,
    }),
    sender('*@icicibank.com', 'ICICI Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance', 'transactionType'],
        subjects: ['Transaction Alert', 'Account Statement'],
        priority: 10,
    }),
    sender('*@sbi.co.in', 'State Bank of India', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance'],
        priority: 10,
    }),
    sender('*@onlinesbi.com', 'SBI Online', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 9,
    }),
    sender('*@axisbank.com', 'Axis Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance', 'transactionType'],
        subjects: ['Transaction Alert', 'Salary Credit'],
        priority: 10,
    }),
    sender('*@kotak.com', 'Kotak Mahindra Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance'],
        priority: 9,
    }),
    sender('*@kotakbank.com', 'Kotak Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 9,
    }),
    sender('*@idfcfirstbank.com', 'IDFC FIRST Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4', 'balance'],
        subjects: ['Transaction Alert'],
        priority: 8,
    }),
    sender('*@indusind.com', 'IndusInd Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 7,
    }),
    sender('*@yesbank.in', 'Yes Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 7,
    }),
    sender('*@rblbank.com', 'RBL Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
    sender('*@bankofbaroda.co.in', 'Bank of Baroda', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
    sender('*@pnb.co.in', 'Punjab National Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
    sender('*@canarabank.com', 'Canara Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 5,
    }),
    sender('*@unionbankofindia.co.in', 'Union Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 5,
    }),
    sender('*@federalbank.co.in', 'Federal Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 5,
    }),
    sender('*@bandhanbank.com', 'Bandhan Bank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 5,
    }),
    sender('*@sc.com', 'Standard Chartered', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
    sender('*@citibank.com', 'Citibank', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
    sender('*@hsbc.co.in', 'HSBC India', 'bank', {
        fields: ['amount', 'accountNumberLast4'],
        priority: 6,
    }),
];

// ─── UPI / Payments ──────────────────────────────────────────────────────────

const PAYMENTS: SeedSender[] = [
    sender('*@phonepe.com', 'PhonePe', 'upi', {
        fields: ['amount', 'upiId', 'merchantName', 'transactionType'],
        subjects: ['Payment Successful', 'Money Received', 'Payment Failed'],
        priority: 9,
    }),
    sender('*@paytm.com', 'Paytm', 'upi', {
        fields: ['amount', 'merchantName', 'transactionType'],
        subjects: ['Payment Successful', 'Cashback'],
        priority: 9,
    }),
    sender('*@gpay.in', 'Google Pay', 'upi', {
        fields: ['amount', 'upiId', 'merchantName'],
        priority: 9,
    }),
    sender('*@amazonpay.in', 'Amazon Pay', 'wallet', {
        fields: ['amount', 'merchantName'],
        priority: 7,
    }),
    sender('*@razorpay.com', 'Razorpay', 'upi', {
        fields: ['amount', 'invoiceNumber', 'merchantName'],
        subjects: ['Payment Receipt', 'Invoice'],
        priority: 8,
    }),
    sender('*@billdesk.com', 'BillDesk', 'upi', {
        fields: ['amount', 'referenceNumber'],
        priority: 6,
    }),
    sender('*@cashfree.com', 'Cashfree', 'upi', {
        fields: ['amount', 'referenceNumber'],
        priority: 6,
    }),
    sender('*@cred.club', 'CRED', 'credit_card', {
        fields: ['amount', 'cardLast4'],
        subjects: ['Payment Successful', 'Bill Payment'],
        priority: 7,
    }),
];

// ─── NBFCs / Lending ─────────────────────────────────────────────────────────

const NBFCS: SeedSender[] = [
    sender('*@bajajfinserv.in', 'Bajaj Finserv', 'nbfc', {
        fields: ['amount', 'emiNumber', 'emiTotal', 'referenceNumber'],
        subjects: ['EMI', 'Loan', 'Disbursement'],
        priority: 8,
    }),
    sender('*@homecredit.co.in', 'Home Credit', 'nbfc', {
        fields: ['amount', 'emiNumber'],
        priority: 5,
    }),
    sender('*@tatacapital.com', 'Tata Capital', 'nbfc', {
        fields: ['amount', 'emiNumber'],
        priority: 6,
    }),
    sender('*@piramal.com', 'Piramal Finance', 'nbfc', {
        fields: ['amount', 'emiNumber'],
        priority: 5,
    }),
    sender('*@lendingkart.com', 'Lendingkart', 'nbfc', {
        fields: ['amount', 'emiNumber'],
        priority: 4,
    }),
];

// ─── Insurance ───────────────────────────────────────────────────────────────

const INSURANCE: SeedSender[] = [
    sender('*@licindia.in', 'LIC', 'insurance', {
        fields: ['amount', 'policyNumber', 'description'],
        subjects: ['Premium', 'Policy'],
        priority: 9,
    }),
    sender('*@lic.co.in', 'LIC (alt)', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 9,
    }),
    sender('*@starhealth.in', 'Star Health', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 7,
    }),
    sender('*@hdfclife.com', 'HDFC Life', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 8,
    }),
    sender('*@iciciprulife.com', 'ICICI Prudential Life', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 8,
    }),
    sender('*@maxlifeinsurance.com', 'Max Life Insurance', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 7,
    }),
    sender('*@policybazaar.com', 'Policybazaar', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 7,
    }),
    sender('*@digit.co.in', 'Go Digit Insurance', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 6,
    }),
    sender('*@godigit.com', 'Digit Insurance', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 6,
    }),
    sender('*@acko.com', 'Acko Insurance', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 6,
    }),
    sender('*@tataaia.com', 'Tata AIA', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 6,
    }),
    sender('*@sbilife.co.in', 'SBI Life', 'insurance', {
        fields: ['amount', 'policyNumber'],
        priority: 7,
    }),
];

// ─── Investments / Brokers ───────────────────────────────────────────────────

const INVESTMENTS: SeedSender[] = [
    sender('*@zerodha.com', 'Zerodha', 'stock_broker', {
        fields: ['amount', 'description'],
        subjects: ['Contract Note', 'Funds', 'Statement'],
        priority: 9,
    }),
    sender('*@groww.in', 'Groww', 'mutual_fund', {
        fields: ['amount', 'description'],
        subjects: ['SIP', 'Investment', 'Mutual Fund'],
        priority: 9,
    }),
    sender('*@kuvera.in', 'Kuvera', 'mutual_fund', {
        fields: ['amount', 'description'],
        subjects: ['SIP', 'Investment'],
        priority: 8,
    }),
    sender('*@camsonline.com', 'CAMS', 'mutual_fund', {
        fields: ['amount', 'referenceNumber', 'description'],
        subjects: ['Statement', 'Folio', 'Transaction'],
        priority: 8,
    }),
    sender('*@kfintech.com', 'KFintech', 'mutual_fund', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['Statement', 'Folio'],
        priority: 8,
    }),
    sender('*@nsdl.co.in', 'NSDL', 'stock_broker', {
        fields: ['description'],
        subjects: ['CAS', 'Statement'],
        priority: 7,
    }),
    sender('*@cdsl.co.in', 'CDSL', 'stock_broker', {
        fields: ['description'],
        subjects: ['CAS', 'Statement'],
        priority: 7,
    }),
    sender('*@angelone.in', 'Angel One', 'stock_broker', {
        fields: ['amount', 'description'],
        priority: 7,
    }),
    sender('*@upstox.com', 'Upstox', 'stock_broker', {
        fields: ['amount', 'description'],
        priority: 7,
    }),
    sender('*@motilaloswal.com', 'Motilal Oswal', 'stock_broker', {
        fields: ['amount', 'description'],
        priority: 6,
    }),
    sender('*@smallcase.com', 'Smallcase', 'stock_broker', {
        fields: ['amount', 'description'],
        priority: 7,
    }),
];

// ─── Tax & Government ────────────────────────────────────────────────────────

const TAX_GOV: SeedSender[] = [
    sender('*@incometax.gov.in', 'Income Tax Department', 'tax_authority', {
        fields: ['taxYear', 'panNumber', 'amount', 'description'],
        subjects: ['ITR', 'Refund', 'Notice', 'Form 16', 'Form 26AS', 'TDS'],
        priority: 10,
    }),
    sender('*@incometaxindiaefiling.gov.in', 'Income Tax E-filing', 'tax_authority', {
        fields: ['taxYear', 'panNumber'],
        priority: 10,
    }),
    sender('*@gst.gov.in', 'GST Portal', 'tax_authority', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['GST', 'Return'],
        priority: 8,
    }),
    sender('*@epfindia.gov.in', 'EPFO', 'government', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['PF', 'EPF', 'Passbook'],
        priority: 8,
    }),
];

// ─── Food Delivery ───────────────────────────────────────────────────────────

const FOOD: SeedSender[] = [
    sender('*@swiggy.in', 'Swiggy', 'food_delivery', {
        fields: ['amount', 'invoiceNumber', 'merchantName'],
        subjects: ['Order', 'Invoice', 'Receipt'],
        priority: 6,
    }),
    sender('*@swiggy.com', 'Swiggy (alt)', 'food_delivery', {
        fields: ['amount', 'invoiceNumber'],
        priority: 6,
    }),
    sender('*@zomato.com', 'Zomato', 'food_delivery', {
        fields: ['amount', 'invoiceNumber', 'merchantName'],
        subjects: ['Order', 'Invoice', 'Receipt'],
        priority: 6,
    }),
];

// ─── E-commerce ──────────────────────────────────────────────────────────────

const ECOMMERCE: SeedSender[] = [
    sender('*@amazon.in', 'Amazon India', 'ecommerce', {
        fields: ['amount', 'invoiceNumber', 'description'],
        subjects: ['Order', 'Invoice', 'Refund', 'Return'],
        priority: 7,
    }),
    sender('*@flipkart.com', 'Flipkart', 'ecommerce', {
        fields: ['amount', 'invoiceNumber', 'description'],
        subjects: ['Order', 'Invoice', 'Refund'],
        priority: 7,
    }),
    sender('*@myntra.com', 'Myntra', 'ecommerce', {
        fields: ['amount', 'invoiceNumber'],
        subjects: ['Order', 'Invoice'],
        priority: 5,
    }),
];

// ─── Travel ──────────────────────────────────────────────────────────────────

const TRAVEL: SeedSender[] = [
    sender('*@makemytrip.com', 'MakeMyTrip', 'travel', {
        fields: ['amount', 'referenceNumber', 'description'],
        subjects: ['Booking', 'Confirmation', 'E-Ticket'],
        priority: 6,
    }),
    sender('*@goibibo.com', 'Goibibo', 'travel', {
        fields: ['amount', 'referenceNumber'],
        priority: 6,
    }),
    sender('*@irctc.co.in', 'IRCTC', 'travel', {
        fields: ['amount', 'referenceNumber', 'description'],
        subjects: ['Booking', 'E-Ticket', 'Cancellation'],
        priority: 7,
    }),
    sender('*@cleartrip.com', 'Cleartrip', 'travel', {
        fields: ['amount', 'referenceNumber'],
        priority: 5,
    }),
];

// ─── Utilities / Telecom ─────────────────────────────────────────────────────

const UTILITIES: SeedSender[] = [
    sender('*@jio.com', 'Jio', 'utility', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['Recharge', 'Bill', 'Payment'],
        priority: 5,
    }),
    sender('*@airtel.in', 'Airtel', 'utility', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['Recharge', 'Bill'],
        priority: 5,
    }),
    sender('*@vodafone.in', 'Vodafone Idea', 'utility', {
        fields: ['amount', 'referenceNumber'],
        priority: 4,
    }),
    sender('*@bsesdelhi.com', 'BSES Delhi', 'utility', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['Bill', 'Payment'],
        priority: 5,
    }),
    sender('*@tatapower.com', 'Tata Power', 'utility', {
        fields: ['amount', 'referenceNumber'],
        subjects: ['Bill', 'Payment'],
        priority: 5,
    }),
];

// ─── Subscriptions ───────────────────────────────────────────────────────────

const SUBSCRIPTIONS: SeedSender[] = [
    sender('*@netflix.com', 'Netflix', 'other', {
        fields: ['amount', 'invoiceNumber'],
        subjects: ['Payment', 'Invoice', 'Receipt'],
        priority: 3,
    }),
    sender('*@spotify.com', 'Spotify', 'other', {
        fields: ['amount', 'invoiceNumber'],
        subjects: ['Receipt', 'Payment'],
        priority: 3,
    }),
    sender('*@hotstar.com', 'Disney+ Hotstar', 'other', {
        fields: ['amount'],
        priority: 3,
    }),
];

// ─── Export All ──────────────────────────────────────────────────────────────

export const ALL_SEED_SENDERS: SeedSender[] = [
    ...BANKS,
    ...PAYMENTS,
    ...NBFCS,
    ...INSURANCE,
    ...INVESTMENTS,
    ...TAX_GOV,
    ...FOOD,
    ...ECOMMERCE,
    ...TRAVEL,
    ...UTILITIES,
    ...SUBSCRIPTIONS,
];
