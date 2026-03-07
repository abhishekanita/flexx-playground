import { EMAIL_DOMAINS } from './domains';

export interface GmailSearchQuery {
    id: string;
    query: string;
    maxResults?: number; // default 500
}

export const GMAIL_SEARCH_QUERIES_V2: GmailSearchQuery[] = [
    {
        id: 'financial_domains',
        query: buildFromDomainClause([
            ...EMAIL_DOMAINS.BANK,
            ...EMAIL_DOMAINS.INVESTMENT,
            ...EMAIL_DOMAINS.INSURANCE,
            ...EMAIL_DOMAINS.FINTECH,
        ]),
        maxResults: 500,
    },

    {
        id: 'commerce_receipts',
        query: buildFromDomainClause(EMAIL_DOMAINS.COMMERCE),
        maxResults: 500,
    },

    {
        id: 'financial_keywords',
        query: `
        subject:(statement OR invoice OR receipt OR bill OR payment OR emi OR premium OR loan OR order OR booking)
      `
            .replace(/\s+/g, ' ')
            .trim(),
        maxResults: 500,
    },

    {
        id: 'financial_attachments',
        query: `has:attachment filename:(pdf OR csv OR xlsx OR xls)`,
        maxResults: 500,
    },
];

// export const GMAIL_SEARCH_QUERIES: GmailSearchQuery[] = [
//     {
//         id: 'bank_statements',
//         query: buildQuery(['statement', 'bank OR account'], true, EMAIL_DOMAINS.BANK),
//         maxResults: 500,
//     },

//     {
//         id: 'credit_card_statements',
//         query: buildQuery(['"credit card" OR card', 'statement OR bill'], true, EMAIL_DOMAINS.BANK),
//         maxResults: 500,
//     },

//     {
//         id: 'investment_statements',
//         query: buildQuery(['statement OR holding OR transaction OR CAS'], true, EMAIL_DOMAINS.INVESTMENT),
//         maxResults: 500,
//     },

//     {
//         id: 'invoices',
//         query: buildQuery(['invoice OR receipt OR bill OR payment'], false),
//         maxResults: 500,
//     },

//     {
//         id: 'subscriptions',
//         query: buildQuery(['subscription OR renewal OR plan OR membership'], false),
//         maxResults: 500,
//     },

//     {
//         id: 'insurance',
//         query: buildQuery(['insurance OR policy OR premium'], false),
//         maxResults: 500,
//     },

//     {
//         id: 'loans',
//         query: buildQuery(['loan OR emi OR repayment'], false),
//         maxResults: 500,
//     },

//     {
//         id: 'catch_all',
//         query: `subject:(statement OR invoice OR receipt OR bill OR premium OR emi) has:attachment`,
//         maxResults: 500,
//     },
// ];

export function buildFromDomainClause(domains: string[]): string {
    return `{${domains.map(d => `from:${d}`).join(' ')}}`;
}

export function buildQuery(subject: string[], hasAttachments?: boolean, domains?: string[], filename?: string) {
    const parts: string[] = [];

    if (subject?.length) {
        parts.push(subject.map(s => `subject:(${s})`).join(' '));
    }

    if (hasAttachments) {
        parts.push('has:attachment');
    }

    if (domains?.length) {
        parts.push(buildFromDomainClause(domains));
    }

    if (filename) {
        parts.push(`filename:(${filename})`);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
