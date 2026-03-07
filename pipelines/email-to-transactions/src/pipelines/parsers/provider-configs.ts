import { IRawEmailsDoc } from '@/schema/raw-emails.schema';
import { parseKotakStatement } from './providers/kotak-statement.parser';
import { parseSbiStatement } from './providers/sbi-statement.parser';
import { parseSwiggyFoodEmail } from './providers/swiggy-food.parser';
import { parseSwiggyInstamartEmail } from './providers/swiggy-instamart.parser';
import { parseUberTripEmail } from './providers/uber-trip.parser';
import { parseAppleInvoiceEmail } from './providers/apple-invoice.parser';
import { parseMakeMyTripEmail } from './providers/makemytrip-flight.parser';
import { parsePaytmStatement } from './providers/paytm-statement.parser';
import { parsePhonePeStatement } from './providers/phonepe-statement.parser';

// =============================================================================
// Provider Config — wires email filters → PDF/HTML handling → parser functions
// =============================================================================

export type ParserSource = 'pdf' | 'body_html' | 'body_text' | 'xlsx';

export interface ProviderConfig {
    id: string;
    name: string;

    // Filter: all conditions are ANDed
    filter: {
        fromAddress: string | RegExp;
        subject?: string | RegExp;
    };

    // What to parse
    source: ParserSource;

    // PDF handling (only when source = 'pdf')
    pdf?: {
        pickAttachment: (att: { filename: string; mimeType: string }) => boolean;
        passwords: string[];
    };

    // XLSX handling (only when source = 'xlsx')
    xlsx?: {
        pickAttachment: (att: { filename: string; mimeType: string }) => boolean;
    };

    // Parser function: receives text/html content (or Buffer for xlsx), returns structured data
    parse: (content: string | Buffer) => unknown;
}

// =============================================================================
// Provider Registry
// =============================================================================

const PDF_ATTACHMENT = (att: { filename: string; mimeType: string }) =>
    att.mimeType === 'application/pdf' || att.filename?.endsWith('.pdf');

export const PROVIDER_CONFIGS: ProviderConfig[] = [
    // ── Bank Statements (PDF) ─────────────────────────────────────────
    {
        id: 'kotak_savings_statement',
        name: 'Kotak Bank Savings Statement',
        filter: {
            fromAddress: 'bankstatements@kotak.bank.in',
            subject: /statement for Kotak A\/c/i,
        },
        source: 'pdf',
        pdf: { pickAttachment: PDF_ATTACHMENT, passwords: ['abhi1804'] },
        parse: (text) => parseKotakStatement(text as string),
    },
    {
        id: 'sbi_savings_statement',
        name: 'SBI e-Account Statement',
        filter: {
            fromAddress: /cbssbi\.cas@alerts\.sbi\.(co\.in|bank\.in)/i,
            subject: /e-account statement/i,
        },
        source: 'pdf',
        pdf: { pickAttachment: PDF_ATTACHMENT, passwords: ['38083180497', 'abhi1804'] },
        parse: (text) => parseSbiStatement(text as string),
    },

    // ── Swiggy ────────────────────────────────────────────────────────
    {
        id: 'swiggy_food_delivery',
        name: 'Swiggy Food/Gourmet Order',
        filter: {
            fromAddress: 'noreply@swiggy.in',
            subject: /order was delivered/i,
        },
        source: 'body_html',
        parse: (html) => parseSwiggyFoodEmail(html as string),
    },
    {
        id: 'swiggy_instamart',
        name: 'Swiggy Instamart Order',
        filter: {
            fromAddress: 'no-reply@swiggy.in',
            subject: /instamart order/i,
        },
        source: 'body_html',
        parse: (html) => parseSwiggyInstamartEmail(html as string),
    },

    // ── Uber ──────────────────────────────────────────────────────────
    {
        id: 'uber_trip',
        name: 'Uber Trip Receipt',
        filter: {
            fromAddress: 'noreply@uber.com',
            subject: /trip with Uber/i,
        },
        source: 'body_html',
        parse: (html) => parseUberTripEmail(html as string),
    },

    // ── Apple ─────────────────────────────────────────────────────────
    {
        id: 'apple_invoice',
        name: 'Apple Invoice',
        filter: {
            fromAddress: /apple\.com/i,
            subject: /invoice from Apple/i,
        },
        source: 'body_html',
        parse: (html) => parseAppleInvoiceEmail(html as string),
    },

    // ── MakeMyTrip ────────────────────────────────────────────────────
    {
        id: 'makemytrip_flight',
        name: 'MakeMyTrip Flight E-Ticket',
        filter: {
            fromAddress: /makemytrip/i,
            subject: /E-Ticket/i,
        },
        source: 'body_html',
        parse: (html) => parseMakeMyTripEmail(html as string),
    },
    // ── Paytm ────────────────────────────────────────────────────────
    {
        id: 'paytm_statement',
        name: 'Paytm Monthly Statement',
        filter: {
            fromAddress: 'no-reply@paytm.com',
            subject: /Paytm Statement/i,
        },
        source: 'xlsx',
        xlsx: {
            pickAttachment: (att) =>
                att.filename.endsWith('.xlsx') ||
                (att.mimeType === 'application/zip' && att.filename.endsWith('.xlsx')),
        },
        parse: (buffer) => parsePaytmStatement(buffer as Buffer),
    },

    // ── PhonePe ─────────────────────────────────────────────────────
    {
        id: 'phonepe_statement',
        name: 'PhonePe Transaction Statement',
        filter: {
            fromAddress: 'noreply@phonepe.com',
            subject: /PhonePe transaction statement/i,
        },
        source: 'pdf',
        pdf: {
            pickAttachment: (att) =>
                att.mimeType === 'application/pdf' || att.filename?.endsWith('.pdf'),
            passwords: ['7838237658'],
        },
        parse: (text) => parsePhonePeStatement(text as string),
    },
];

// =============================================================================
// Matching logic
// =============================================================================

export function matchEmailToProvider(email: IRawEmailsDoc): ProviderConfig | null {
    for (const config of PROVIDER_CONFIGS) {
        if (!matchFilter(config.filter, email)) continue;
        return config;
    }
    return null;
}

function matchFilter(filter: ProviderConfig['filter'], email: IRawEmailsDoc): boolean {
    const from = email.fromAddress?.toLowerCase() || '';
    if (typeof filter.fromAddress === 'string') {
        if (!from.includes(filter.fromAddress.toLowerCase())) return false;
    } else {
        if (!filter.fromAddress.test(from)) return false;
    }

    if (filter.subject) {
        const subject = email.subject || '';
        if (typeof filter.subject === 'string') {
            if (!subject.toLowerCase().includes(filter.subject.toLowerCase())) return false;
        } else {
            if (!filter.subject.test(subject)) return false;
        }
    }

    return true;
}
